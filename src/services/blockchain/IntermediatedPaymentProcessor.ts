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
      const feeAuthorization = await requestFeeReceiver({
        invoiceId,
        chainId,
        processor: "intermediated",
        paymentToken,
        kind: "single",
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
          feeAuthorization.feeReceivers[0],
          feeAuthorization.signature,
        ],
      });
    } else {
      // One receiver per sub-invoice, index-aligned
      // with `subInvoiceIds`; any other length reverts.
      const metaInvoice = (await publicClient?.readContract({
        address: contractAddress,
        abi: intermediatedPaymentProcessor,
        functionName: "getMetaInvoice",
        args: [invoiceId],
      })) as { subInvoiceIds?: readonly bigint[] } | undefined;

      const subInvoiceCount = metaInvoice?.subInvoiceIds?.length ?? 0;
      if (subInvoiceCount === 0) {
        toast.error("This meta invoice has no sub-invoices to pay");
        return false;
      }

      const feeAuthorization = await requestFeeReceiver({
        invoiceId,
        chainId,
        processor: "intermediated",
        paymentToken,
        kind: "meta",
        count: subInvoiceCount,
      });
      if (!feeAuthorization) {
        toast.error("Unable to prepare the fee receivers. Please try again.");
        return false;
      }

      txData = isNativePayment
        ? encodeFunctionData({
            abi: intermediatedPaymentProcessor,
            functionName: "payMetaInvoiceWithValue",
            args: [
              invoiceId,
              feeAuthorization.feeReceivers,
              feeAuthorization.signature,
            ],
          })
        : encodeFunctionData({
            abi: intermediatedPaymentProcessor,
            functionName: "payMetaInvoice",
            args: [
              invoiceId,
              paymentToken,
              feeAuthorization.feeReceivers,
              feeAuthorization.signature,
            ],
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
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};

export const setIntermediatedOperator = async (
  { walletClient, publicClient }: WagmiClient,
  intermediatedOperatorAddress: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<any> => {
  setIsLoading("setIntermediatedOperator");
  let success = false;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: PAYMENT_PROCESSOR_STORAGE[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "setIntermediatedPlatformsOperator",
        args: [intermediatedOperatorAddress],
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
