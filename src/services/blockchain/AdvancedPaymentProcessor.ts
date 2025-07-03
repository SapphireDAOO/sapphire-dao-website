/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "sonner";
import { encodeFunctionData, Address, zeroAddress } from "viem";
import { sepolia } from "viem/chains";
import { ADVANCED_PAYMENT_PROCESSOR } from "@/constants";
import { fetchGasPrice, getError, handleApproval } from "./utils";
import { client } from "@/services/graphql/client";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { WagmiClient } from "./type";

export const payAdvancedInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  paymentType: "paySingleInvoice" | "payMetaInvoice",
  amount: bigint,
  orderId: Address,
  paymentToken: Address,
  chainId: number,
  owner: Address,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  console.log("Order id", amount, paymentToken);
  setIsLoading(paymentType);


  let success = false;
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const amountIntoken = await publicClient?.readContract({
      address: ADVANCED_PAYMENT_PROCESSOR[chainId],
      abi: advancedPaymentProcessor,
      functionName: "getTokenValueFromUsd",
      args: [paymentToken, amount],
    });

    const approved = await handleApproval(
      paymentToken,
      ADVANCED_PAYMENT_PROCESSOR[chainId],
      amountIntoken,
      owner,
      walletClient,
      publicClient,
      chainId
    );

    if (!approved) {
      toast.error("Approval failed");
      return false;
    }

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: ADVANCED_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: paymentType,
        args: [orderId, paymentToken],
      }),
      value: paymentToken !== zeroAddress ? BigInt(0) : amountIntoken,
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
      toast.success("Invoice Payment Successful");
      await getInvoiceData();
      success = true;
    } else {
      toast.error("Transaction failed. Please try again.");
    }
  } catch (error) {
    getError(error);
  }

  setIsLoading("");
  return success;
};

export const acceptMarketplaceInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("acceptMarketplaceInvoice");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: ADVANCED_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "acceptInvoice",
        args: [orderId],
      }),
      gasPrice,
    });

    progressToastId = toast.info("Transaction in progress...", {
      duration: Infinity,
    });

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx!,
    });

    if (receipt?.status) {
      toast.dismiss(progressToastId);
      toast.success("Order accepted");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("An unexpected error occurred. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const createDispute = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("createDispute");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: ADVANCED_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "createDispute",
        args: [orderId],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    progressToastId = toast.info("Transaction in progress...", {
      duration: Infinity,
    });

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
    });

    if (receipt?.status) {
      toast.dismiss(progressToastId);
      toast.success("Dispute Raised");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("An unexpected error occurred. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const claimExpiredInvoiceRefunds = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("claimExpiredInvoiceRefunds");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: ADVANCED_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "claimExpiredInvoiceRefunds",
        args: [orderId],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    progressToastId = toast.info("Transaction in progress...", {
      duration: Infinity,
    });

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
    });

    if (receipt?.status) {
      toast.dismiss(progressToastId);
      toast.success("Refunded");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("An unexpected error occurred. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const getAdvancedInvoiceData = async (
  orderId: Address,
  query: string,
  type: "smartInvoice" | "metaInvoice",
  chainId: number
): Promise<any> => {
  const { data, error } = await client(chainId)
    .query(query, { id: orderId })
    .toPromise();

  if (error) {
    console.error(`[GraphQL Error] ${type}:`, error.message);
    return "";
  }

  return data || "";
};
