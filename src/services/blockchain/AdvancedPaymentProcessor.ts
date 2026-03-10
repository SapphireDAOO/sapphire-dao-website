/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "sonner";
import { encodeFunctionData, Address, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";
import {
  ADVANCED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
} from "@/constants";
import { fetchGasPrice, getError, handleApproval } from "./utils";
import { client } from "@/services/graphql/client";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { WagmiClient } from "./types";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";

export const payAdvancedInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  paymentType: "paySingleInvoice" | "payMetaInvoice",
  amount: bigint,
  invoiceId: bigint,
  paymentToken: Address,
  chainId: number,
  owner: Address,
  setIsLoading: (value: string) => void
): Promise<boolean> => {
  setIsLoading(paymentType);

  let success = false;
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const isNativePayment = paymentToken.toLowerCase() === zeroAddress;
    const contractAddress = ADVANCED_PAYMENT_PROCESSOR[chainId];

    const amountIntoken = (await publicClient?.readContract({
      address: contractAddress,
      abi: advancedPaymentProcessor,
      functionName: "getTokenValueFromUsd",
      args: [paymentToken, amount],
    })) as bigint | undefined;

    if (amountIntoken === undefined) {
      toast.error("Failed to compute token amount");
      return false;
    }

    if (!isNativePayment) {
      const approved = await handleApproval(
        paymentToken,
        contractAddress,
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
    }

    const txData =
      paymentType === "paySingleInvoice"
        ? encodeFunctionData({
            abi: advancedPaymentProcessor,
            functionName: "payInvoice",
            args: [invoiceId, paymentToken],
          })
        : isNativePayment
          ? encodeFunctionData({
              abi: advancedPaymentProcessor,
              functionName: "payMetaInvoiceWithValue",
              args: [invoiceId],
            })
          : encodeFunctionData({
              abi: advancedPaymentProcessor,
              functionName: "payMetaInvoice",
              args: [invoiceId, paymentToken],
            });

    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: contractAddress,
      data: txData,
      value: isNativePayment ? amountIntoken : BigInt(0),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
      confirmations: 1,
    });

    if (receipt?.status === "success") {
      success = true;
    }
  } catch (error) {
    getError(error);
  }

  setIsLoading("");
  return success;
};

export const setMarketplaceAddress = async (
  { walletClient, publicClient }: WagmiClient,
  marketplaceAddress: Address,
  chainId: number,
  setIsLoading: (value: string) => void
): Promise<any> => {
  setIsLoading("setMarketplaceAddress");
  let success = false;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: baseSepolia,
      to: PAYMENT_PROCESSOR_STORAGE[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "setMarketplaceAddress",
        args: [marketplaceAddress],
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

    if (receipt?.status) {
      toast.success("Successfully set new address");
      success = true;
    } else {
      toast.error("Failed to set new address. Please try again");
    }
  } catch (error) {
    // toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const getAdvancedInvoiceData = async (
  invoiceId: bigint,
  query: string,
  type: "smartInvoice" | "metaInvoice",
  chainId: number
): Promise<any> => {
  const { data, error } = await client(chainId)
    .query(query, { id: invoiceId.toString() })
    .toPromise();

  if (error) {
    console.error(`[GraphQL Error] ${type}:`, error.message);
    return "";
  }

  return data || "";
};
