"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useChainId, usePublicClient, useSignMessage } from "wagmi";
import { BaseError, ContractFunctionRevertedError, type Address, type Hex } from "viem";
import { BASE_SEPOLIA, NOTES_CONTRACT } from "@/constants";
import { Notes } from "@/abis/Notes";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";
import { useViemReadContract } from "@/hooks/useViemReadContract";
import {
  deriveNoteKeys,
  matchesDerivedKey,
  noteKeyMessage,
  type NoteKeyPair,
} from "@/lib/noteKeys";

// Only the opt-in is stored; the private key
// stays in memory and is re-derived by signing.

const OPT_IN_KEY = "sapphire.notes.messaging";

const NOTE_KEY_STALE_TIME_MS = 5 * 60_000;

// Shared by every mounted copy of the hook (one per invoice card), so a key
// unlocked in one place shows up in all of them.
const sessionKeys = new Map<string, NoteKeyPair>();
const pendingUnlocks = new Map<string, Promise<NoteKeyPair | null>>();
const keyListeners = new Set<() => void>();
const sessionKey = (address: string, version: number) =>
  `${address.toLowerCase()}:${version}`;

const setSessionKey = (key: string, pair: NoteKeyPair | null) => {
  if (pair) sessionKeys.set(key, pair);
  else sessionKeys.delete(key);
  keyListeners.forEach((listener) => listener());
};

const subscribeKeys = (listener: () => void) => {
  keyListeners.add(listener);
  return () => {
    keyListeners.delete(listener);
  };
};

const readOptIn = (address?: string): boolean => {
  if (!address || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${OPT_IN_KEY}:${address.toLowerCase()}`) === "1";
  } catch {
    return false;
  }
};

const writeOptIn = (address: string, enabled: boolean) => {
  if (typeof window === "undefined") return;
  try {
    const key = `${OPT_IN_KEY}:${address.toLowerCase()}`;
    if (enabled) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch {
  }
};

const readPublishedKey = (result: unknown): Hex | null => {
  const key = (result as { key?: Hex } | undefined)?.key;
  return key && key !== "0x" ? key : null;
};

export const fetchNotePublicKey = async (
  publicClient: { readContract: (args: never) => Promise<unknown> } | undefined,
  chainId: number,
  account: Address,
): Promise<Hex | null> => {
  const contractAddress = NOTES_CONTRACT[chainId];
  if (!publicClient || !contractAddress) return null;

  try {
    const result = await publicClient.readContract({
      address: contractAddress,
      abi: Notes,
      functionName: "getPublicKey",
      args: [account],
    } as never);

    return readPublishedKey(result);
  } catch {
    return null;
  }
};

const revertReason = (error: unknown): string | undefined => {
  if (!(error instanceof BaseError)) return undefined;
  const reverted = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError,
  );
  return reverted instanceof ContractFunctionRevertedError
    ? reverted.data?.errorName
    : undefined;
};

// viem reports a node's refusal to broadcast as a
// revert, so name the transport problem instead.
const transportReason = (error: unknown): string | undefined => {
  if (!(error instanceof BaseError)) return undefined;

  const text = `${error.shortMessage ?? ""} ${error.details ?? ""}`.toLowerCase();
  if (text.includes("nonce too low") || text.includes("nonce too high")) {
    return "Your wallet's nonce does not match the node, which usually means the local chain was restarted. Clear this account's activity data in your wallet and try again.";
  }
  if (text.includes("user rejected") || text.includes("denied")) {
    return "Signature rejected.";
  }
  return error.shortMessage || undefined;
};

const REGISTER_HINTS: Record<string, string> = {
  PublicKeyAlreadySet: "This account already has a messaging key published.",
  InvalidPublicKey: "The derived key is not the 64 bytes the registry expects.",
  PublicKeyMismatch:
    "The registry only accepts a key whose hash matches your address, so it rejects derived messaging keys. The contract's setPublicKey check has to be relaxed before this can succeed.",
};

export const useNoteKeys = (options?: {
  enabled?: boolean;
}) => {
  const readsEnabled = options?.enabled ?? true;
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  const { data: walletClient } = useHintedWalletClient();
  const { signMessageAsync } = useSignMessage();

  const [enabled, setEnabled] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => setEnabled(readOptIn(address)), [address]);

  const notesContract = NOTES_CONTRACT[chainId];

  const { data: version = 1 } = useViemReadContract<number>({
    abi: Notes,
    address: notesContract,
    functionName: "getCurrentVersion",
    chainId,
    enabled: readsEnabled,
    staleTime: NOTE_KEY_STALE_TIME_MS,
    select: (value) => Number(value) || 1,
  });

  const publicKeyQueryKey = useMemo(
    () => ["note-public-key", chainId, address?.toLowerCase()],
    [chainId, address],
  );
  const { data: registeredKey = null } = useViemReadContract<Hex | null>({
    abi: Notes,
    address: notesContract,
    functionName: "getPublicKey",
    args: address ? [address] : undefined,
    chainId,
    enabled: readsEnabled && Boolean(address),
    queryKey: publicKeyQueryKey,
    staleTime: NOTE_KEY_STALE_TIME_MS,
    select: readPublishedKey,
  });

  const currentKey = address ? sessionKey(address, version) : null;
  const keys = useSyncExternalStore(
    subscribeKeys,
    () => (currentKey ? sessionKeys.get(currentKey) ?? null : null),
    () => null,
  );

  const unlock = useCallback(async (): Promise<NoteKeyPair | null> => {
    if (!address) return null;
    const key = sessionKey(address, version);

    const cached = sessionKeys.get(key);
    if (cached) return cached;

    let pending = pendingUnlocks.get(key);
    if (!pending) {
      pending = signMessageAsync({ message: noteKeyMessage(address, version) })
        .then((signature) => {
          const derived = deriveNoteKeys(signature as Hex);
          setSessionKey(key, derived);
          return derived;
        })
        .catch((error) => {
          console.error("Failed to unlock note keys", error);
          return null;
        })
        .finally(() => pendingUnlocks.delete(key));
      pendingUnlocks.set(key, pending);
    }

    setIsBusy(true);
    try {
      return await pending;
    } finally {
      setIsBusy(false);
    }
  }, [address, version, signMessageAsync]);

  // Sent from the user's own wallet: the registry is keyed by msg.sender.
  const register = useCallback(async (): Promise<{
    ok: boolean;
    reason?: string;
  }> => {
    const contractAddress = NOTES_CONTRACT[chainId];
    if (!address || !walletClient || !publicClient || !contractAddress) {
      return { ok: false, reason: "Wallet is not connected." };
    }

    const derived = keys ?? (await unlock());
    if (!derived) return { ok: false, reason: "Messaging key is locked." };

    setIsBusy(true);
    try {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: contractAddress,
        abi: Notes,
        functionName: "setPublicKey",
        args: [derived.publicKey],
      });

      const hash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        return { ok: false, reason: "The transaction was reverted." };
      }

      queryClient.setQueryData(publicKeyQueryKey, {
        key: derived.publicKey,
        version,
      });
      return { ok: true };
    } catch (error) {
      const name = revertReason(error);
      console.error("Failed to register note public key", name ?? "", error);
      return {
        ok: false,
        reason:
          (name && REGISTER_HINTS[name]) ?? name ?? transportReason(error),
      };
    } finally {
      setIsBusy(false);
    }
  }, [
    address,
    chainId,
    keys,
    publicClient,
    publicKeyQueryKey,
    queryClient,
    unlock,
    version,
    walletClient,
  ]);

  const enable = useCallback(async () => {
    if (!address) return false;
    writeOptIn(address, true);
    setEnabled(true);
    return Boolean(await unlock());
  }, [address, unlock]);

  const disable = useCallback(() => {
    if (!address) return;
    writeOptIn(address, false);
    setEnabled(false);
    setSessionKey(sessionKey(address, version), null);
  }, [address, version]);

  const keyMismatch = Boolean(
    keys && registeredKey && !matchesDerivedKey(registeredKey, keys.publicKey),
  );

  return useMemo(
    () => ({
      enabled,
      isBusy,
      version,
      keys,
      publicKey: keys?.publicKey ?? null,
      registeredKey,
      needsRegistration: Boolean(keys && !registeredKey),
      keyMismatch,
      unlock,
      register,
      enable,
      disable,
    }),
    [
      enabled,
      isBusy,
      version,
      keys,
      registeredKey,
      keyMismatch,
      unlock,
      register,
      enable,
      disable,
    ],
  );
};
