import { toast } from "sonner";
import {
  Address,
  decodeEventLog,
  encodeFunctionData,
  type Hex,
  type Log,
} from "viem";
import { SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import { fetchGasPrice, getError, getChainById } from "./utils";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { client } from "../graphql/client";
import { invoiceOwnerQuery } from "../graphql/queries";
import { WagmiClient } from "./types";
import { requestFeeReceiver } from "../feeReceiver";

const asStorageRefHex = (storageRef?: string): `0x${string}` => {
  const trimmed = storageRef?.trim();
  if (!trimmed) return "0x";
  if (!trimmed.startsWith("0x")) {
    throw new Error("Invoice note must be sealed before it is submitted");
  }
  return trimmed as `0x${string}`;
};

export type CreatedSimpleInvoice = {
  invoiceId: bigint;
  invoiceNonce: bigint;
  expiresAt: bigint;
  price: bigint;
  seller: Address;
  txHash: Hex;
};

export const createInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  invoicePrice: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  storageRef?: string,
  share?: boolean,
): Promise<CreatedSimpleInvoice | undefined> => {
  setIsLoading("createInvoice");
  const storageRefHex = asStorageRefHex(storageRef);
  const shareFlag = Boolean(share && storageRef?.trim());
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "createInvoice",
        args: [invoicePrice, storageRefHex, shareFlag],
      }),
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return undefined;
    }

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
    });

    if (receipt?.status) {
      const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId]?.toLowerCase();
      const createdLog = receipt.logs.find(
        (log: Log) => log.address.toLowerCase() === contractAddress,
      );

      if (!createdLog) {
        toast.error(
          "The invoice was created, but its details could not be read. Refresh your dashboard to see it.",
        );
        return undefined;
      }

      const { args } = decodeEventLog({
        abi: paymentProcessor,
        data: createdLog.data,
        topics: createdLog.topics,
        eventName: "InvoiceCreated",
      });

      return {
        invoiceId: args.invoiceId,
        invoiceNonce: args.invoiceNonce,
        expiresAt: BigInt(args.expiresAt),
        price: args.price,
        seller: args.seller,
        txHash: tx,
      };
    } else {
      toast.error("Error creating invoice, Please try again.");
      return undefined;
    }
  } catch (error) {
    getError(error);
    return undefined;
  } finally {
    setIsLoading("");
  }
};

export const makeInvoicePayment = async (
  { walletClient, publicClient }: WagmiClient,
  amount: bigint,
  invoiceId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  storageRef?: string,
  share?: boolean,
  onSubmitted?: (hash: `0x${string}`) => void,
): Promise<boolean> => {
  setIsLoading("makeInvoicePayment");

  let success = false;
  const storageRefHex = asStorageRefHex(storageRef);
  const shareFlag = Boolean(share && storageRef?.trim());
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "pay",
        args: [invoiceId, storageRefHex, shareFlag],
      }),
      value: amount,
      gasPrice,
    });

    if (!tx) {
      toast.error("Transaction failed to initiate");
      return false;
    }
    onSubmitted?.(tx);

    const receipt = await publicClient?.waitForTransactionReceipt({
      hash: tx,
      confirmations: 1,
    });

    if (receipt?.status === "success") {
      success = true;
    } else {
      toast.error("Transaction failed. Please try again.");
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};

export const sellerAction = async (
  { walletClient, publicClient }: WagmiClient,
  invoiceId: bigint,
  state: boolean,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  const action = state ? "Accepted" : "Rejected";
  setIsLoading(`${action}:${invoiceId.toString()}`);
  let success = false;

  try {
    // Accepting is the only point here that issues a
    // fee receiver; nothing else would consume one.
    let data: Hex;
    if (state) {
      const feeAuthorization = await requestFeeReceiver({
        invoiceId,
        chainId,
        processor: "simple",
        kind: "single",
      });
      if (!feeAuthorization) {
        toast.error("Unable to prepare the fee receiver. Please try again.");
        return false;
      }

      data = encodeFunctionData({
        abi: paymentProcessor,
        functionName: "acceptPayment",
        args: [
          invoiceId,
          feeAuthorization.feeReceivers[0],
          feeAuthorization.signature,
        ],
      });
    } else {
      data = encodeFunctionData({
        abi: paymentProcessor,
        functionName: "rejectPayment",
        args: [invoiceId],
      });
    }

    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data,
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

    if (receipt?.status) {
      success = true;
    } else {
      toast.error("Something went wrong, please try again.");
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};

export const cancelInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  invoiceId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(`cancelInvoice:${invoiceId.toString()}`);
  let success = false;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "cancelInvoice",
        args: [invoiceId],
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
      success = true;
    } else {
      toast.error("Something went wrong, please try again.");
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};

export const releaseInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  invoiceId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(`releaseInvoice:${invoiceId.toString()}`);
  let success = false;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "release",
        args: [invoiceId],
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
      toast.success("Invoice successfully released");
      success = true;
    } else {
      toast.error("Something went wrong, please try again.");
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};

export const refundBuyerAfterWindow = async (
  { walletClient, publicClient }: WagmiClient,
  invoiceId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
): Promise<boolean> => {
  setIsLoading(`refundBuyerAfterWindow:${invoiceId.toString()}`);
  let success = false;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: getChainById(chainId),
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "refundBuyer",
        args: [invoiceId],
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
      toast.success("Refund to buyer successfully processed");
      success = true;
    } else {
      toast.error("An unexpected error occurred during refund.");
    }
  } catch (error) {
    getError(error);
  } finally {
    setIsLoading("");
  }
  return success;
};





export const getInvoiceOwner = async (
  id: string,
  chainId: number,
): Promise<string> => {
  const { data, error } = await client(chainId)
    .query(invoiceOwnerQuery, { id })
    .toPromise();

  if (error) {
    console.error("GraphQL Error:", error.message);
    return "";
  }

  return data?.invoice?.seller?.id || "";
};
