import { toast } from "sonner";
import { encodeFunctionData } from "viem";
import { PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { fetchGasPrice, getChainById, getError } from "./utils";
import { WagmiClient } from "./types";

/**
 * Sent straight from the pauser's wallet rather than proposed:
 * the contract restricts it to the designated pauser.
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

/**
 * `unpause()` is onlyOwner, so this reverts
 * unless the wallet owns the storage contract.
 */
export const emergencyUnpause = async (
  { walletClient, publicClient }: WagmiClient,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading("emergencyUnpause");
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: PAYMENT_PROCESSOR_STORAGE[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "unpause",
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
      toast.success("Pause lifted");
      return true;
    }

    toast.error("Failed to lift the pause");
    return false;
  } catch (error) {
    getError(error);
    return false;
  } finally {
    setIsLoading("");
  }
};
