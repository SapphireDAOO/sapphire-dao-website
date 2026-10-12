"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useAccount, useAccountEffect, useSignMessage } from "wagmi";
import { BaseError, UserRejectedRequestError, type Address } from "viem";
import {
  SessionRejectedError,
  clearSession,
  readSession,
  signIn,
} from "@/services/auth";

type SignInContextValue = {
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

const SignInProvider = ({ children }: { children: ReactNode }) => {
  const { address, chain, connector, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // `chain` is only set on a configured network;
  // the API would refuse any other chain id.
  const chainId = chain?.id;
  const isSmartWallet = SMART_WALLET_CONNECTORS.has(connector?.id ?? "");
  const canSignIn = Boolean(isConnected && address && chainId && !isSmartWallet);

  const inFlight = useRef(new Map<string, Promise<string>>());
  // Prompted once per account per tab on connect; writing a note asks again.
  const prompted = useRef(new Set<string>());

  const requestToken = useCallback(
    (account: Address, onChain: number): Promise<string> => {
      const key = account.toLowerCase();
      const pending = inFlight.current.get(key);
      if (pending) return pending;

      const attempt = signIn({
        address: account,
        chainId: onChain,
        signMessage: (message) => signMessageAsync({ account, message }),
      })
        .then((session) => session.token)
        .finally(() => inFlight.current.delete(key));
      inFlight.current.set(key, attempt);
      return attempt;
    },
    [signMessageAsync],
  );

  useEffect(() => {
    if (!canSignIn || !address || !chainId) return;
    const key = address.toLowerCase();
    if (prompted.current.has(key) || readSession(address)) return;
    prompted.current.add(key);

    requestToken(address, chainId).catch((error) => {
      if (isUserRejection(error)) return;
      console.error("Sign-in failed", error);
      toast.error(describe(error));
    });
  }, [address, canSignIn, chainId, requestToken]);

  useAccountEffect({
    onDisconnect: () => {
      clearSession();
      prompted.current.clear();
    },
  });

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

  const value = useMemo(() => ({ withSession }), [withSession]);

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
