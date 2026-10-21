"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAccount, useSignMessage } from "wagmi";
import { BaseError, UserRejectedRequestError, type Address } from "viem";
import {
  SessionRejectedError,
  clearSession,
  readSession,
  signIn,
  type SignInSession,
} from "@/services/auth";

export type SignInStatus =
  | "connecting"
  | "disconnected"
  | "unsupported"
  | "wrongNetwork"
  | "signingIn"
  | "signedOut"
  | "signedIn";

type SignInContextValue = {
  status: SignInStatus;
  /** Prompts the connected wallet to sign in, e.g. after declining. */
  signIn: () => void;
  /** Retries once with a fresh sign-in when the API refuses a stored token. */
  withSession: <T>(send: (token: string) => Promise<T>) => Promise<T>;
};

const SignInContext = createContext<SignInContextValue | null>(null);

const isUserRejection = (error: unknown) =>
  error instanceof BaseError &&
  Boolean(error.walk((cause) => cause instanceof UserRejectedRequestError));

const describe = (error: unknown) => {
  if (isUserRejection(error)) return "Sign-in was declined.";
  const reason =
    error instanceof BaseError
      ? error.shortMessage
      : error instanceof Error
        ? error.message
        : "";
  return reason ? `Could not sign in: ${reason}` : "Could not sign in.";
};

// The API only accepts EOA signatures, so a Safe can't sign in.
const SMART_WALLET_CONNECTORS = new Set(["safe"]);

// Module-level, so a remounted provider can't open a second prompt, and one at
// a time, so an account change waits for the open prompt instead of stacking.
let pendingSignIn: { key: string; attempt: Promise<string> } | null = null;
// Prompted once per account per tab on connect; the gate offers a retry.
const prompted = new Set<string>();

const SignInProvider = ({
  children,
  promptOnConnect = true,
}: {
  children: ReactNode;
  /** Off where signing in isn't needed, e.g. checkout. */
  promptOnConnect?: boolean;
}) => {
  const {
    address,
    chain,
    connector,
    isConnected,
    status: accountStatus,
  } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // `chain` is only set on a configured network;
  // the API would refuse any other chain id.
  const chainId = chain?.id;
  const isSmartWallet = SMART_WALLET_CONNECTORS.has(connector?.id ?? "");
  const canSignIn = Boolean(isConnected && address && chainId && !isSmartWallet);
  const accountKey = address?.toLowerCase();

  // Storage is read after mount so the first render matches the static export.
  const [mounted, setMounted] = useState(false);
  const [current, setCurrent] = useState<{
    key: string;
    session: SignInSession | null;
  } | null>(null);
  const [signingInFor, setSigningInFor] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    setCurrent(
      address
        ? { key: address.toLowerCase(), session: readSession(address) }
        : null,
    );
  }, [address]);

  // Ignored if the wallet has moved on to another account meanwhile.
  const syncSession = useCallback((account: Address) => {
    const key = account.toLowerCase();
    setCurrent((prev) =>
      prev?.key === key ? { key, session: readSession(account) } : prev,
    );
  }, []);

  const session = current?.key === accountKey ? current?.session : undefined;

  useEffect(() => {
    if (!session || !address) return;
    const timer = setTimeout(
      () => syncSession(address),
      Math.max(0, session.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [address, session, syncSession]);

  const requestToken = useCallback(
    (account: Address, onChain: number): Promise<string> => {
      const key = account.toLowerCase();
      if (pendingSignIn?.key === key) return pendingSignIn.attempt;
      const previous = pendingSignIn?.attempt.catch(() => undefined);

      setSigningInFor(key);
      const attempt: Promise<string> = Promise.resolve(previous)
        .then(
          () =>
            readSession(account)?.token ??
            signIn({
              address: account,
              chainId: onChain,
              signMessage: (message) => signMessageAsync({ account, message }),
            }).then((session) => session.token),
        )
        .finally(() => {
          if (pendingSignIn?.attempt === attempt) pendingSignIn = null;
          setSigningInFor((prev) => (prev === key ? null : prev));
          syncSession(account);
        });
      pendingSignIn = { key, attempt };
      return attempt;
    },
    [signMessageAsync, syncSession],
  );

  const promptSignIn = useCallback(
    (account: Address, onChain: number) => {
      requestToken(account, onChain).catch((error) => {
        if (isUserRejection(error)) return;
        console.error("Sign-in failed", error);
        toast.error(describe(error));
      });
    },
    [requestToken],
  );

  useEffect(() => {
    if (!promptOnConnect || !canSignIn || !address || !chainId) return;
    const key = address.toLowerCase();
    if (prompted.has(key) || readSession(address)) return;
    prompted.add(key);
    promptSignIn(address, chainId);
  }, [address, canSignIn, chainId, promptOnConnect, promptSignIn]);

  const signInNow = useCallback(() => {
    if (canSignIn && address && chainId) promptSignIn(address, chainId);
  }, [address, canSignIn, chainId, promptSignIn]);

  const withSession = useCallback(
    async <T,>(send: (token: string) => Promise<T>): Promise<T> => {
      if (isSmartWallet) {
        throw new Error(
          "Smart-contract wallets cannot sign in yet. Connect an ordinary wallet instead.",
        );
      }
      if (!canSignIn || !address || !chainId) {
        throw new Error("Connect your wallet on a supported network to sign in.");
      }

      const token = async () => {
        try {
          return await requestToken(address, chainId);
        } catch (error) {
          throw new Error(describe(error));
        }
      };

      const stored = readSession(address)?.token;
      if (!stored) return send(await token());

      // Only a stored token is retried; a fresh one
      // being refused needs no second signature.
      try {
        return await send(stored);
      } catch (error) {
        if (!(error instanceof SessionRejectedError)) throw error;
        clearSession(address);
        return send(await token());
      }
    },
    [address, canSignIn, chainId, isSmartWallet, requestToken],
  );

  let status: SignInStatus;
  if (
    !mounted ||
    accountStatus === "connecting" ||
    accountStatus === "reconnecting"
  ) {
    status = "connecting";
  } else if (!isConnected || !accountKey) {
    status = "disconnected";
  } else if (session === undefined) {
    status = "connecting";
  } else if (session) {
    status = "signedIn";
  } else if (isSmartWallet) {
    status = "unsupported";
  } else if (!chainId) {
    status = "wrongNetwork";
  } else if (signingInFor === accountKey) {
    status = "signingIn";
  } else {
    status = "signedOut";
  }

  const value = useMemo(
    () => ({ status, signIn: signInNow, withSession }),
    [status, signInNow, withSession],
  );

  return (
    <SignInContext.Provider value={value}>{children}</SignInContext.Provider>
  );
};

export const useSignIn = () => {
  const value = useContext(SignInContext);
  if (!value) throw new Error("useSignIn must be used within SignInProvider");
  return value;
};

export default SignInProvider;
