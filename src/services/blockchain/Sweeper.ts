// `sweep` is restricted to the storage owner (the
// multisig), so sweeps are proposed rather than sent.

import { toast } from "sonner";
import { Address, encodeFunctionData, Hex, TransactionReceipt } from "viem";
import { Sweeper } from "@/abis/Sweeper";
import { SWEEPER_CONTRACT } from "@/constants";
import type { SweepSource } from "@/model/fees";
import { proposeMultiSigTransaction } from "./MultiSig";
import { WagmiClient } from "./types";

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
