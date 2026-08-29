/* eslint-disable @typescript-eslint/no-explicit-any */
import { toast } from "sonner";
import { encodeFunctionData, Address, zeroAddress } from "viem";
import {
  INTERMEDIATED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
} from "@/constants";
import { fetchGasPrice, getError, handleApproval, getChainById } from "./utils";
import { client } from "@/services/graphql/client";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { WagmiClient } from "./types";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { requestFeeReceiver } from "../feeReceiver";
import { clearFeeReceiver } from "@/lib/feeReceiverStore";

export const payIntermediatedInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  paymentType: "paySingleInvoice" | "payMetaInvoice",
  amount: bigint,
  invoiceId: bigint,
  paymentToken: Address,
  chainId: number,
  owner: Address,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(paymentType);

  let success = false;
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const isNativePayment = paymentToken.toLowerCase() === zeroAddress;
    const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];

    const amountIntoken = (await publicClient?.readContract({
      address: contractAddress,
      abi: intermediatedPaymentProcessor,
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
        chainId,
      );

      if (!approved) {
        toast.error("Approval failed");
        return false;
      }
    }

    let txData: `0x${string}`;
    if (paymentType === "paySingleInvoice") {
      // Paying fixes the fee terms: the server hands out a one-time stealth
      // fee receiver plus the fee signer's authorization over it.
      const feeAuthorization = await requestFeeReceiver({
        invoiceId,
        chainId,
        processor: "intermediated",
        paymentToken,
      });
      if (!feeAuthorization) {
        toast.error("Unable to prepare the fee receiver. Please try again.");
        return false;
      }
      txData = encodeFunctionData({
        abi: intermediatedPaymentProcessor,
        functionName: "payInvoice",
        args: [
          invoiceId,
          paymentToken,
          feeAuthorization.feeReceiver,
          feeAuthorization.signature,
        ],
      });
    } else {
      txData = isNativePayment
        ? encodeFunctionData({
            abi: intermediatedPaymentProcessor,
            functionName: "payMetaInvoiceWithValue",
            args: [invoiceId],
          })
        : encodeFunctionData({
            abi: intermediatedPaymentProcessor,
            functionName: "payMetaInvoice",
            args: [invoiceId, paymentToken],
          });
    }

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
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
      // The fee receiver is spent once the payment lands, so the invoice
      // starts clean if it is ever prepared again.
      if (paymentType === "paySingleInvoice") {
        clearFeeReceiver({ invoiceId, chainId, processor: "intermediated" });
      }
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};

export const setMarketplaceAddress = async (
  { walletClient, publicClient }: WagmiClient,
  marketplaceAddress: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<any> => {
  setIsLoading("setMarketplaceAddress");
  let success = false;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: PAYMENT_PROCESSOR_STORAGE[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "setIntermediatedPlatformsOperator",
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
  } finally {
    setIsLoading("");
  }
  return success;
};

export const getIntermediatedInvoiceData = async (
  invoiceId: bigint,
  query: string,
  type: "smartInvoice" | "metaInvoice",
  chainId: number,
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
