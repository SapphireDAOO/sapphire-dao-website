"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useSignMessage } from "wagmi";
import { BaseError, ContractFunctionRevertedError, type Address, type Hex } from "viem";
import { BASE_SEPOLIA, NOTES_CONTRACT } from "@/constants";
import { Notes } from "@/abis/Notes";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";
import {
  deriveNoteKeys,
  matchesDerivedKey,
  noteKeyMessage,
  type NoteKeyPair,
} from "@/lib/noteKeys";

// Messaging is opt-in: unlocking prompts a signature, and a wallet that signs
// non-deterministically would derive a key it cannot reuse. Only the choice is
// remembered - the private key lives in memory for the tab's lifetime and is
// re-derived by signing again, never written to storage.

const OPT_IN_KEY = "sapphire.notes.messaging";

const sessionKeys = new Map<string, NoteKeyPair>();
const sessionKey = (address: string, version: number) =>
  `${address.toLowerCase()}:${version}`;

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

/** The note public key an account has published, or null if it has none. */
export const fetchNotePublicKey = async (
  publicClient: { readContract: (args: never) => Promise<unknown> } | undefined,
  chainId: number,
  account: Address,
): Promise<Hex | null> => {
  const contractAddress = NOTES_CONTRACT[chainId];
  if (!publicClient || !contractAddress) return null;

  try {
    const result = (await publicClient.readContract({
      address: contractAddress,
      abi: Notes,
      functionName: "getPublicKey",
      args: [account],
    } as never)) as { key?: Hex } | undefined;

    const key = result?.key;
    return key && key !== "0x" ? key : null;
  } catch {
    return null;
  }
};

/**
 * The contract's own error name, when it is one. A bare "transaction failed"
 * hides the difference between a key that is already published and one the
 * registry refuses, which are opposite problems.
 */
const revertReason = (error: unknown): string | undefined => {
  if (!(error instanceof BaseError)) return undefined;
  const reverted = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError,
  );
  return reverted instanceof ContractFunctionRevertedError
    ? reverted.data?.errorName
    : undefined;
};

/**
 * What actually went wrong when the contract did not reject the call.
 *
 * viem reports a node's refusal to broadcast as though the function reverted,
 * which sends you looking at the contract for a problem that is not there. A
 * stale wallet nonce against a restarted local chain is the common one, and it
 * is worth naming because the fix is in the wallet, not the code.
 */
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

export const useNoteKeys = () => {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const { data: walletClient } = useHintedWalletClient();
  const { signMessageAsync } = useSignMessage();

  const [enabled, setEnabled] = useState(false);
  const [keys, setKeys] = useState<NoteKeyPair | null>(null);
  const [registeredKey, setRegisteredKey] = useState<Hex | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [isBusy, setIsBusy] = useState(false);

  // Read in an effect: touching storage during render would make the first
  // client render disagree with the server markup.
  useEffect(() => setEnabled(readOptIn(address)), [address]);

  // The key version is the contract's, so a bump rotates everyone's keys.
  useEffect(() => {
    const contractAddress = NOTES_CONTRACT[chainId];
    if (!publicClient || !contractAddress) return;

    let canceled = false;
    void publicClient
      .readContract({
        address: contractAddress,
        abi: Notes,
        functionName: "getCurrentVersion",
      })
      .then((value) => {
        if (!canceled) setVersion(Number(value) || 1);
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
    };
  }, [publicClient, chainId]);

  useEffect(() => {
    if (!address) {
      setRegisteredKey(null);
      return;
    }
    let canceled = false;
    void fetchNotePublicKey(publicClient as never, chainId, address).then(
      (key) => {
        if (!canceled) setRegisteredKey(key);
      },
    );
    return () => {
      canceled = true;
    };
  }, [address, chainId, publicClient]);

  // A cached key from earlier in this tab, so unlocking prompts once.
  useEffect(() => {
    if (!address) {
      setKeys(null);
      return;
    }
    setKeys(sessionKeys.get(sessionKey(address, version)) ?? null);
  }, [address, version]);

  /** Prompts the signature and derives this account's keypair. */
  const unlock = useCallback(async (): Promise<NoteKeyPair | null> => {
    if (!address) return null;

    const cached = sessionKeys.get(sessionKey(address, version));
    if (cached) return cached;

    setIsBusy(true);
    try {
      const signature = await signMessageAsync({
        message: noteKeyMessage(address, version),
      });
      const derived = deriveNoteKeys(signature as Hex);
      sessionKeys.set(sessionKey(address, version), derived);
      setKeys(derived);
      return derived;
    } catch (error) {
      console.error("Failed to unlock note keys", error);
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [address, version, signMessageAsync]);

  /**
   * Publishes the derived public key so counterparties can seal notes to it.
   * Sent from the user's own wallet: the contract keys the registry by
   * msg.sender, so a relayer cannot do this on their behalf.
   */
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
      // Simulated first: registration reverts for reasons the user can do
      // nothing about, and finding that out after paying gas - or after a
      // wallet prompt - is worse than finding out now.
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

      setRegisteredKey(derived.publicKey);
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
  }, [address, chainId, keys, publicClient, unlock, walletClient]);

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
    sessionKeys.delete(sessionKey(address, version));
    setKeys(null);
  }, [address, version]);

  // A published key that this signature cannot reproduce means notes sealed to
  // it are unreadable here - a non-deterministic wallet, or a key registered
  // from a different one. Better to say so than to fail note by note.
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
