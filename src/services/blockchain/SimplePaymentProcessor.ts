import { toast } from "sonner";
import { Address, encodeFunctionData } from "viem";
import { sepolia } from "viem/chains";
import {
  ADVANCED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
  SIMPLE_PAYMENT_PROCESSOR,
} from "@/constants";
import { fetchGasPrice, getError } from "./utils";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { client } from "../graphql/client";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { invoiceOwnerQuery } from "../graphql/queries";
import { WagmiClient } from "./type";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";

export const createInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  invoicePrice: bigint,
  chainId: number,
  setIsLoading: (value: string) => void
): Promise<bigint | undefined> => {
  setIsLoading("createInvoice");
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);
    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "createInvoice",
        args: [invoicePrice],
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
      toast.success("Invoice successfully created");
      return receipt?.logs[0].topics[1];
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
  orderId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("makeInvoicePayment");

  let success = false;
  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "makeInvoicePayment",
        args: [orderId],
      }),
      value: amount,
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

export const sellerAction = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: bigint,
  state: boolean,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  const action = state ? "acceptPayment" : "rejectPayment";
  setIsLoading(action);
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: action,
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
      // fix
      toast.success(`Successfully ${action} the invoice.`);
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Something went wrong, please try again.");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const cancelInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("cancelInvoice");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "cancelInvoice",
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
      toast.success("Invoice successfully cancelled");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Something went wrong, please try again.");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const releaseInvoice = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("releaseInvoice");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "releaseInvoice",
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
      toast.success("Invoice successfully released");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Something went wrong, please try again.");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const refundBuyerAfterWindow = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("refundBuyerAfterWindow");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "refundBuyer",
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
      toast.success("Refund to buyer successfully processed");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("An unexpected error occurred during refund.");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const transferOwnership = async (
  { walletClient, publicClient }: WagmiClient,
  address: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("transferOwnership");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "transferOwnership",
        args: [address],
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
      toast.success("New Admin updated successfully");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Failed to update Admin. Please try again.");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const setFeeReceiversAddress = async (
  { walletClient, publicClient }: WagmiClient,
  address: Address,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("setFeeReceiversAddress");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "setFeeReceiver",
        args: [address],
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
      toast.success("Fee receiver address updated");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Failed to update fee receiver address. Please try again.");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const setInvoiceHoldPeriod = async (
  { walletClient, publicClient }: WagmiClient,
  orderId: bigint,
  holdPeriod: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>,
  target: string | undefined
): Promise<boolean> => {
  setIsLoading("setInvoiceHoldPeriod");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    if (!target) return false;

    const calldata =
      target === ADVANCED_PAYMENT_PROCESSOR[chainId]
        ? encodeFunctionData({
            abi: advancedPaymentProcessor,
            functionName: "setInvoiceReleaseTime",
            args: [orderId, holdPeriod],
          })
        : encodeFunctionData({
            abi: paymentProcessor,
            functionName: "setInvoiceReleaseTime",
            args: [orderId, Number(holdPeriod)],
          });

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: PaymentProcessorStorage[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "execute",
        args: [target as Address, calldata],
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
      toast.success("Invoice hold period successfully set");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Failed to set invoice hold period. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }

  setIsLoading("");
  return success;
};

export const setDefaultHoldPeriod = async (
  { walletClient, publicClient }: WagmiClient,
  newDefaultHoldPeriod: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("setDefaultHoldPeriod");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: PAYMENT_PROCESSOR_STORAGE[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "setDefaultHoldPeriod",
        args: [newDefaultHoldPeriod],
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
      toast.success("Successfully set new default hold period");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Failed to set new default hold period. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const setFee = async (
  { walletClient, publicClient }: WagmiClient,
  newFee: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("setFee");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: PaymentProcessorStorage,
        functionName: "setFeeRate",
        args: [newFee],
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
      toast.success("Successfully set new fee");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Failed to set new fee. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const setMinimumInvoiceValue = async (
  { walletClient, publicClient }: WagmiClient,
  newValue: bigint,
  chainId: number,
  setIsLoading: (value: string) => void,
  getInvoiceData: () => Promise<void>
): Promise<boolean> => {
  setIsLoading("setMinimumInvoiceValue");
  let success = false;
  let progressToastId: string | number | undefined;

  try {
    const gasPrice = await fetchGasPrice(publicClient, chainId);

    const tx = await walletClient?.sendTransaction({
      chain: sepolia,
      to: SIMPLE_PAYMENT_PROCESSOR[chainId],
      data: encodeFunctionData({
        abi: paymentProcessor,
        functionName: "setMinimumInvoiceValue",
        args: [newValue],
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
      toast.success("Successfully set new minimum invoice value");
      await getInvoiceData();
      success = true;
    } else {
      toast.dismiss(progressToastId);
      toast.error("Failed to set new minimum invoice value. Please try again");
    }
  } catch (error) {
    toast.dismiss(progressToastId);
    getError(error);
  }
  setIsLoading("");
  return success;
};

export const getInvoiceOwner = async (
  id: string,
  chainId: number
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
