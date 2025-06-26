/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "sonner";
import { encodeFunctionData, Address, zeroAddress } from "viem";
import { polygonAmoy } from "viem/chains";
import { ADVANCE_INVOICE_ADDRESS } from "@/constants";
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
  setIsLoading(paymentType);
  let success = false;
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const amountIntoken = await publicClient?.readContract({
      address: ADVANCE_INVOICE_ADDRESS[chainId],
      abi: advancedPaymentProcessor,
      functionName: "getTokenValueFromUsd",
      args: [paymentToken, amount],
    });

    const approved = await handleApproval(
      paymentToken,
      ADVANCE_INVOICE_ADDRESS[chainId],
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
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
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
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
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

export const cancelMarketplaceInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("cancelMarketplaceInvoice");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "cancelInvoice",
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
      toast.success("Order canceled");
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

export const requestCancelation = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("requestCancelation");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "requestCancelation",
        args: [orderId],
      }),
      gasPrice,
    });

    progressToastId = toast.info("Transaction in progress...", {
      duration: Infinity,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
    });

    if (receipt?.status) {
      toast.dismiss(progressToastId);
      toast.success("Cancelation requested");
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

export const handleCancelationRequest = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  accept: boolean,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("requestCancelation");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "handleCancelationRequest",
        args: [orderId, accept],
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
      hash: tx!,
    });

    if (receipt?.status) {
      const state = accept ? "granted" : "rejected";
      toast.dismiss(progressToastId);
      toast.success(`Cancelation ${state}`);
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
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
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
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
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

export const resolveDispute = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("resolveDispute");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: polygonAmoy,
      to: ADVANCE_INVOICE_ADDRESS[chainId],
      data: encodeFunctionData({
        abi: advancedPaymentProcessor,
        functionName: "resolveDispute",
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
      const message = !receipt?.logs.length
        ? "Entered resolution"
        : "Dispute Resolved";
      toast.success(message);
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
