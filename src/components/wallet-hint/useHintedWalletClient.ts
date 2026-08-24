"use client";

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { beginWalletMoment } from "./walletMomentStore";
import type { HintMoment } from "./walletHints";

/**
 * A wallet client that announces when it is waiting on the user.
 *
 * Every method here opens a wallet popup. Wrapping the client rather than
 * editing each call site means new call sites are covered for free — and there
 * are already a dozen spread across the services and multisig components.
 */
const APPROVAL_MOMENTS: Record<string, HintMoment> = {
  sendTransaction: "sendingTransaction",
  sendRawTransaction: "sendingTransaction",
  writeContract: "sendingTransaction",
  deployContract: "sendingTransaction",
  signTransaction: "signing",
  signMessage: "signing",
  signTypedData: "signing",
  switchChain: "switchingChain",
  addChain: "switchingChain",
  requestAddresses: "connecting",
  requestPermissions: "connecting",
};

/** Wraps a viem wallet client so approval-triggering calls raise a hint. */
export const wrapWalletClient = <T extends object>(client: T): T =>
  new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop);
      const moment = typeof prop === "string" ? APPROVAL_MOMENTS[prop] : undefined;
      if (!moment || typeof value !== "function") return value;

      return (...args: unknown[]) => {
        const end = beginWalletMoment(moment);
        try {
          const result = (value as (...args: unknown[]) => unknown).apply(
            target,
            args,
          );
          // Approval methods are async, but guard anyway: a sync return that
          // never settled would pin the hint open.
          return result instanceof Promise
            ? result.finally(end)
            : (end(), result);
        } catch (error) {
          end();
          throw error;
        }
      };
    },
  });

/**
 * Drop-in replacement for wagmi's `useWalletClient` that shows a hint whenever
 * the returned client opens a wallet popup.
 */
export const useHintedWalletClient = () => {
  const query = useWalletClient();
  const { data } = query;

  const hinted = useMemo(() => (data ? wrapWalletClient(data) : data), [data]);

  return useMemo(() => ({ ...query, data: hinted }), [query, hinted]);
};
