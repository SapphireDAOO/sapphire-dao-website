import { toast } from "sonner";
import { Address, encodeFunctionData, Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { MULTISIG_CONTRACT } from "@/constants";
import { fetchGasPrice, getError } from "./utils";
import { Multisig } from "@/abis/MultiSig";
import { WagmiClient } from "./types";

export const proposeMultiSigTransaction = async (
  { walletClient, publicClient }: WagmiClient,
  target: Address,
  calldata: Hex,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading("proposeTransaction");
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: MULTISIG_CONTRACT[chainId],
      data: encodeFunctionData({
        abi: Multisig,
        functionName: "proposeTransaction",
        args: [target, BigInt(0), calldata],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
    if (receipt?.status === "success") {
      toast.success("Transaction proposed successfully");
      return true;
    } else {
      toast.error("Failed to propose transaction");
      return false;
    }
  } catch (error) {
    getError(error);
    return false;
  } finally {
    setIsLoading("");
  }
};

export const approveMultiSigTransaction = async (
  { walletClient, publicClient }: WagmiClient,
  txHash: Hex,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(`approve:${txHash}`);
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: MULTISIG_CONTRACT[chainId],
      data: encodeFunctionData({
        abi: Multisig,
        functionName: "approveTransaction",
        args: [txHash as `0x${string}`],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
    if (receipt?.status === "success") {
      toast.success("Transaction approved");
      return true;
    } else {
      toast.error("Approval failed");
      return false;
    }
  } catch (error) {
    getError(error);
    return false;
  } finally {
    setIsLoading("");
  }
};

export const cancelMultiSigTransaction = async (
  { walletClient, publicClient }: WagmiClient,
  txHash: Hex,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(`cancel:${txHash}`);
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: MULTISIG_CONTRACT[chainId],
      data: encodeFunctionData({
        abi: Multisig,
        functionName: "cancelTransaction",
        args: [txHash as `0x${string}`],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
    if (receipt?.status === "success") {
      toast.success("Transaction canceled");
      return true;
    } else {
      toast.error("Cancellation failed");
      return false;
    }
  } catch (error) {
    getError(error);
    return false;
  } finally {
    setIsLoading("");
  }
};

export const executeMultiSigTransaction = async (
  { walletClient, publicClient }: WagmiClient,
  txHash: Hex,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(`execute:${txHash}`);
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: MULTISIG_CONTRACT[chainId],
      data: encodeFunctionData({
        abi: Multisig,
        functionName: "executeTransaction",
        args: [txHash as `0x${string}`],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
    if (receipt?.status === "success") {
      toast.success("Transaction executed successfully");
      return true;
    } else {
      toast.error("Execution failed");
      return false;
    }
  } catch (error) {
    getError(error);
    return false;
  } finally {
    setIsLoading("");
  }
};
