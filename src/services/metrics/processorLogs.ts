import { getPublicClient } from "wagmi/actions";
import config from "@/config";
import {
  SIMPLE_PAYMENT_PROCESSOR,
  INTERMEDIATED_PAYMENT_PROCESSOR,
  BASE_SEPOLIA,
  LOCALHOST,
} from "@/constants";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";

export type ProcessorSource = "Simple" | "Intermediated";

export interface ProcessorLog {
  eventName?: string;
  args?: Record<string, unknown>;
  transactionHash?: string;
  logIndex?: number;
}

export interface ProcessorLogListener {
  onLogs: (logs: ProcessorLog[]) => void;
  onError?: () => void;
}

interface Stream {
  listeners: Set<ProcessorLogListener>;
  unwatch: () => void;
}

const streams = new Map<string, Stream>();

export const subscribeProcessorLogs = (
  chainId: number,
  source: ProcessorSource,
  listener: ProcessorLogListener,
): (() => void) | null => {
  const address =
    source === "Simple"
      ? SIMPLE_PAYMENT_PROCESSOR[chainId]
      : INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
  const publicClient = getPublicClient(config, {
    chainId: chainId as typeof BASE_SEPOLIA | typeof LOCALHOST,
  });
  if (!publicClient || !address) return null;

  const key = `${chainId}:${address.toLowerCase()}`;
  let stream = streams.get(key);

  if (!stream) {
    const listeners = new Set<ProcessorLogListener>();
    const unwatch = publicClient.watchContractEvent({
      address,
      abi: source === "Simple" ? paymentProcessor : intermediatedPaymentProcessor,
      onLogs: (logs) => {
        for (const each of listeners) {
          each.onLogs(logs as unknown as ProcessorLog[]);
        }
      },
      onError: () => {
        for (const each of listeners) each.onError?.();
      },
    });
    stream = { listeners, unwatch };
    streams.set(key, stream);
  }

  const active = stream;
  active.listeners.add(listener);

  return () => {
    active.listeners.delete(listener);
    if (active.listeners.size > 0) return;
    active.unwatch();
    if (streams.get(key) === active) streams.delete(key);
  };
};
