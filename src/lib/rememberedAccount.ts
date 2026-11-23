import type { Address, Chain } from "viem";
import { deserialize } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";

type RememberedAccount = { address: Address; chainId: number };
type StoredConnection = { accounts?: readonly Address[]; chainId?: number };
type StoredState = {
  state?: {
    current?: string | null;
    connections?: Map<string, StoredConnection>;
  };
};

// wagmi's default storage key; it persists its state under `${key}.store`.
const WAGMI_STORE = "wagmi.store";

let remembered: RememberedAccount | null = null;

/**
 * Snapshots the account wagmi last connected. Call it before createConfig:
 * creating the config rewrites the stored state, and WagmiProvider then
 * clears restored connections since the app reconnects the last wallet itself.
 */
export const captureRememberedAccount = (chains: readonly Chain[]) => {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(WAGMI_STORE);
    const state = raw ? deserialize<StoredState>(raw).state : undefined;
    const connection = state?.current
      ? state.connections?.get(state.current)
      : undefined;
    const address = connection?.accounts?.[0];
    if (!address) return;
    const chain = chains.find((c) => c.id === connection?.chainId);
    remembered = { address, chainId: chain?.id ?? BASE_SEPOLIA };
  } catch {
    // Nothing usable stored; the dashboard loads after reconnecting.
  }
};

/** Hands the snapshot out once; later visits already have a live connection. */
export const takeRememberedAccount = () => {
  const account = remembered;
  remembered = null;
  return account;
};
