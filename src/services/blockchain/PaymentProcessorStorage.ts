import { toast } from "sonner";
import { encodeFunctionData } from "viem";
import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { fetchGasPrice, getChainById, getError } from "./utils";
import { WagmiClient } from "./types";

/**
 * Trips the emergency pause on PaymentProcessorStorage, halting payment
 * processing until the pause lapses or governance lifts it.
 *
 * Unlike every other admin action this is sent straight from the caller's
 * wallet rather than proposed to the multisig: the contract restricts it to
 * the designated emergency pauser precisely so it can land without waiting
 * for signatures.
 */
export const emergencyPause = async (
  { walletClient, publicClient }: WagmiClient,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading("emergencyPause");
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: PAYMENT_PROCESSOR_STORAGE[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "emergencyPause",
        args: [],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
    if (receipt?.status === "success") {
      toast.success("Emergency pause activated");
      return true;
    }

    toast.error("Failed to activate emergency pause");
    return false;
  } catch (error) {
    getError(error);
    return false;
  } finally {
    setIsLoading("");
  }
};
