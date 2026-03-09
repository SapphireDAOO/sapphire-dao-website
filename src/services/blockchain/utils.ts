/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "sonner";
import { errorMessages, POLYGON_AMOY } from "@/constants";
import { Address, encodeFunctionData, erc20Abi } from "viem";
import { baseSepolia } from "viem/chains";

export const fetchGasPrice = async (
  publicClient: any,
  chainId: number
): Promise<bigint> => {
  const fallbackGasPrice = BigInt(1_000_000_000); // 1 gwei
  const gasPrice = (await publicClient?.getGasPrice()) as bigint | undefined;
  let adjusted = gasPrice ?? fallbackGasPrice;

  try {
    const latestBlock = (await publicClient?.getBlock({
      blockTag: "latest",
    })) as { baseFeePerGas?: bigint } | undefined;
    const baseFeePerGas = latestBlock?.baseFeePerGas;

    // Some wallets map `gasPrice` into EIP-1559 fee caps. Ensure the value
    // is safely above base fee to avoid `maxFeePerGas < baseFee` rejections.
    if (typeof baseFeePerGas === "bigint" && baseFeePerGas > BigInt(0)) {
      const priorityBuffer = BigInt(100_000_000); // 0.1 gwei
      const minSafeFeeCap = baseFeePerGas * BigInt(2) + priorityBuffer;
      if (adjusted < minSafeFeeCap) {
        adjusted = minSafeFeeCap;
      }
    }
  } catch {
    // Ignore block read errors and keep the fetched gas price.
  }

  return chainId === POLYGON_AMOY
    ? (adjusted * BigInt(300)) / BigInt(100)
    : adjusted;
};

export const getError = (error: any) => {
  if (
    error.message.includes("user rejected transaction") ||
    error.message.includes("User denied transaction.")
  ) {
    return;
  }
  const errorData = error.error?.data || error?.data;
  if (errorData) {
    for (const [errorCode, message] of Object.entries(errorMessages)) {
      if (errorData.includes(errorCode)) {
        toast.error(message);
        return;
      }
    }
  }
  const message = error?.data?.message || error?.error?.data?.message;
  console.log(error)
  toast.error(message || "Something went wrong");
};

export const handleApproval = async (
  tokenAddress: Address,
  spender: Address,
  amountIntoken: bigint,
  owner: Address,
  walletClient: any,
  publicClient: any,
  chainId: number
): Promise<boolean> => {
  try {
    if (!amountIntoken || amountIntoken <= 0) {
      toast.error("Invalid or failed to fetch token price");
      return false;
    }

    const allowance = await publicClient?.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "allowance",
      args: [owner, spender],
    });

    if (allowance && allowance >= amountIntoken) {
      return true;
    }

    const gasPrice = await fetchGasPrice(publicClient, chainId);
    if (!gasPrice) {
      toast.error("Failed to fetch gas price");
      return false;
    }

    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: tokenAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amountIntoken],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
    });

    if (receipt?.status === "success") {
      toast.success("Approved");
      return true;
    } else {
      toast.error("Approval failed");
      return false;
    }
  } catch (error) {
    console.error("handleApproval error", error);
    getError(error);
    return false;
  }
};
