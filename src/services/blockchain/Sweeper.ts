// Sweeper calls. `sweep` pulls fee tokens out of the stealth fee receivers via
// the max approval each one granted when it was created, and is restricted to
// the PaymentProcessorStorage owner — the multisig — so sweeps are proposed
// through the multisig rather than sent directly.

import { toast } from "sonner";
import { Address, encodeFunctionData, Hex, TransactionReceipt } from "viem";
import { Sweeper } from "@/abis/Sweeper";
import { SWEEPER_CONTRACT } from "@/constants";
import type { SweepSource } from "@/model/fees";
import { proposeMultiSigTransaction } from "./MultiSig";
import { WagmiClient } from "./types";

/** Calldata for `sweep(token, from[], amounts[], destination)`. */
export const encodeSweepCall = (
  token: Address,
  sources: SweepSource[],
  destination: Address,
): Hex =>
  encodeFunctionData({
    abi: Sweeper,
    functionName: "sweep",
    args: [
      token,
      sources.map((s) => s.address),
      sources.map((s) => s.amount),
      destination,
    ],
  });

/**
 * Proposes the sweep to the multisig. Once enough signers approve, executing
 * the proposal makes the multisig the caller the Sweeper expects.
 */
export const proposeSweep = async (
  clients: WagmiClient,
  chainId: number,
  token: Address,
  sources: SweepSource[],
  destination: Address,
  setIsLoading: (value: string) => void,
): Promise<{ ok: boolean; receipt?: TransactionReceipt }> => {
  const sweeper = SWEEPER_CONTRACT[chainId];
  if (!sweeper) {
    toast.error("Sweeper is not configured for this network");
    return { ok: false };
  }
  if (sources.length === 0) {
    toast.error("Nothing to sweep");
    return { ok: false };
  }

  return proposeMultiSigTransaction(
    clients,
    sweeper,
    encodeSweepCall(token, sources, destination),
    chainId,
    setIsLoading,
  );
};
