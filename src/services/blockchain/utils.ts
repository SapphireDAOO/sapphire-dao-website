/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "sonner";
import { errorMessages, LOCAL_CHAIN_ENABLED } from "@/constants";
import { Address, Chain, encodeFunctionData, erc20Abi } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { beginWalletMoment } from "@/components/wallet-hint/walletMomentStore";
import { isUserRejection, WALLET_CANCELLED } from "@/lib/walletErrors";

// LOCAL_CHAIN_ENABLED, not NODE_ENV: a
// static export always builds as production.
const SUPPORTED_CHAINS: Record<number, Chain> = LOCAL_CHAIN_ENABLED
  ? { [baseSepolia.id]: baseSepolia, [hardhat.id]: hardhat }
  : { [baseSepolia.id]: baseSepolia };

export const getChainById = (chainId: number): Chain =>
  SUPPORTED_CHAINS[chainId] ?? baseSepolia;

export const fetchGasPrice = async (
  publicClient: any,
  chainId: number,
): Promise<bigint> => {
  void chainId;
  const fallbackGasPrice = BigInt(1_000_000_000); // 1 gwei
  try {
    const fees = (await publicClient?.estimateFeesPerGas?.()) as
      | {
          gasPrice?: bigint;
          maxFeePerGas?: bigint;
          maxPriorityFeePerGas?: bigint;
        }
      | undefined;

    return fees?.maxFeePerGas ?? fees?.gasPrice ?? fallbackGasPrice;
  } catch {
    return fallbackGasPrice;
  }
};

export const getError = (error: any) => {
  if (isUserRejection(error)) {
    toast(WALLET_CANCELLED);
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
  console.log(error);
  toast.error(message || "Something went wrong");
};

export const handleApproval = async (
  tokenAddress: Address,
  spender: Address,
  amountIntoken: bigint,
  owner: Address,
  walletClient: any,
  publicClient: any,
  chainId: number,
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

    const endMoment = beginWalletMoment("approvingToken");
    let tx: `0x${string}` | undefined;
    try {
      tx = await walletClient?.sendTransaction({
        chain: getChainById(chainId),
        to: tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, amountIntoken],
        }),
        gasPrice,
      });
    } finally {
      endMoment();
    }

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const processingToast = toast.loading(
      "Approval is processing. Keep this tab open while it confirms.",
    );
    let receipt;
    try {
      receipt = await publicClient?.waitForTransactionReceipt({ hash: tx });
    } catch (error) {
      toast.dismiss(processingToast);
      throw error;
    }

    if (receipt?.status === "success") {
      toast.success("Approved", { id: processingToast });
      return true;
    } else {
      toast.error("Approval failed", { id: processingToast });
      return false;
    }
  } catch (error) {
    console.error("handleApproval error", error);
    getError(error);
    return false;
  }
};
