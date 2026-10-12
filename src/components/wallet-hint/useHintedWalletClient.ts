"use client";

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { beginWalletMoment } from "./walletMomentStore";
import type { HintMoment } from "./walletHints";

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

export const useHintedWalletClient = () => {
  const query = useWalletClient();
  const { data } = query;

  const hinted = useMemo(() => (data ? wrapWalletClient(data) : data), [data]);

  return useMemo(() => ({ ...query, data: hinted }), [query, hinted]);
};
