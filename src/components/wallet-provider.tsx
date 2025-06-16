/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, ReactNode, useCallback } from "react";
import { toast } from "sonner";
import { formatEther } from "ethers";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  type Address,
  encodeFunctionData,
  erc20Abi,
  maxUint256,
  zeroAddress,
} from "viem";
import { createClient } from "urql";
import { ContractContext } from "@/context/contract-context";
import {
  ADVANCE_INVOICE_ADDRESS,
  INVOICE_ADDRESS,
  POLYGON_AMOY,
  THE_GRAPH_API_URL,
  errorMessages,
} from "@/constants";
import {
  UserCreatedInvoice,
  Invoice,
  UserPaidInvoice,
  AllInvoice,
} from "@/model/model";
import { polygonAmoy } from "viem/chains";
import { unixToGMT } from "@/utils";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";

// Props type for the WalletProvider component
type Props = {
  children?: ReactNode; // Allows nested components inside WalletProvider
};

// Create a GraphQL client to fetch invoice data for a specific chain
const client = (chainId: number) =>
  createClient({
    url: THE_GRAPH_API_URL[chainId], // Fetch the API URL from constants using the chainId
  });

const GET_ALL_INVOICES = `
  query {
    invoices {
    contract
    createdAt
    fee
    id
    invoiceId
    paidAt
    paymentTxHash
    price
    releaseHash
    releasedAt
    state
    amountPaid
      seller {
        id
      }
      buyer {
        id
      }
    }
  }
`;

// GraphQL query to fetch invoices for a specific user
const invoiceQuery = `query ($address: String!) {
  user (id: $address) {
    ownedInvoices {
      amountPaid
      contract
      createdAt
      fee
      id
      invoiceId
      paidAt
      paymentTxHash
      price
      releaseHash
      releasedAt
      state
      seller {
        id
      }
    }
    paidInvoices {
      amountPaid
      contract
      createdAt
      fee
      id
      invoiceId
      paidAt
      paymentTxHash
      price
      releaseHash
      releasedAt
      state
      seller {
        id
      }
      buyer {
        id
      }
    }
  }
}`;

const invoiceOwnerQuery = `query Invoice($id: String!) {
  invoice(id: $id) {
    seller {
      id
    }
  }
}`;

// Utility function to fetch and calculate a higher gas price with a 3x multiplier
const fetchGasPrice = async (
  publicClient: any,
  chainId: number
): Promise<bigint> => {
  const gasPrice = await publicClient?.getGasPrice();
  return chainId === POLYGON_AMOY
    ? (gasPrice * BigInt(300)) / BigInt(100)
    : gasPrice;
};

// WalletProvider component that provides contract context to its children
const WalletProvider = ({ children }: Props) => {
  // Extract connected chain and user address
  const { chain, address } = useAccount();
  const chainId = chain?.id || POLYGON_AMOY; // Default to POLYGON_AMOY if no chain is connected
  const { data: walletClient } = useWalletClient(); // Get wallet client for transactions
  const publicClient = usePublicClient(); // Public client to interact with blockchain

  // State variables for loading and invoice data
  const [isLoading, setIsLoading] = useState<string>();
  const [invoiceData, setInvoiceData] = useState<Invoice[]>([]);
  const [allInvoiceData, setAllInvoiceData] = useState<AllInvoice[]>([]);

  // Memoize getAllInvoiceData
  const getAllInvoiceData = useCallback(async () => {
    try {
      const { data, error } = await client(chainId)
        .query(GET_ALL_INVOICES, {})
        .toPromise();

      if (error) {
        console.error("GraphQL Error:", error.message);
        return [];
      }

      if (!data?.invoices) {
        console.warn("No invoice data found.");
        return [];
      }

      // Map over invoices safely
      const invoiceList: AllInvoice[] = data.invoices.map((list: any) => ({
        id: list.invoiceId || "",
        invoiceKey: list.id || "",
        contract: list.contract || "",
        seller: list.seller?.id || "",
        payment: list.paymentTxHash || "",
        createdAt: unixToGMT(list.createdAt) || "-",
        paidAt: unixToGMT(list.paidAt),
        by: list.buyer?.id || "",
        release:
          list.releasedAt && !isNaN(list.releasedAt)
            ? unixToGMT(list.releasedAt)
            : "Pending",
        fee: list.fee || "0",
        state: list.status,
        releaseHash: list.releaseHash,
        status: list.state,
      }));

      return invoiceList;
    } catch (error) {
      console.error("❌ Error fetching invoice data:", error);
      return [];
    }
  }, [chainId]);

  // Memoize refetchAllInvoiceData
  const refetchAllInvoiceData = useCallback(async () => {
    const fetchedInvoices = await getAllInvoiceData();
    setAllInvoiceData(fetchedInvoices);
  }, [getAllInvoiceData]);

  // Memoize getInvoiceData
  const getInvoiceData = useCallback(async () => {
    try {
      const { data, error } = await client(chainId)
        .query(invoiceQuery, { address: address?.toLowerCase() })
        .toPromise();

      if (error) {
        console.log(error.message);
      }

      // Process created invoices
      const createdInvoice: UserCreatedInvoice[] =
        data?.user?.ownedInvoices || [];

      const paidInvoices: UserPaidInvoice[] = data?.user?.paidInvoices || [];

      // Format created invoices to fit with our model
      const createdInvoiceData: UserCreatedInvoice[] = createdInvoice.map(
        (invoice: any) => ({
          id: invoice.invoiceId,
          invoiceKey: invoice.id,
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: invoice.state || "Unknown",
          price: invoice.price ? formatEther(invoice.price) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(invoice.amountPaid)
            : null,
          type: "Seller",
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          seller: invoice.seller === null ? "" : invoice.seller.id,
          releaseHash: invoice.releaseHash,
          releaseAt: invoice.releasedAt,
        })
      );

      // Format paid invoices
      const paidInvoiceData: UserPaidInvoice[] = paidInvoices.map(
        (invoice: any) => ({
          id: invoice.invoiceId,
          invoiceKey: invoice.id,
          createdAt: invoice.createdAt ? unixToGMT(invoice.createdAt) : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: invoice.state || "Unknown",
          price: invoice.price ? formatEther(invoice.price) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(invoice.amountPaid)
            : null,
          type: "Buyer",
          seller: invoice.seller.id,
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          releaseAt: invoice.releasedAt,
          buyer: invoice.buyer === null ? "" : invoice.buyer.id,
        })
      );

      // Combine created and paid invoices into a single list
      const allInvoiceData: (UserCreatedInvoice | UserPaidInvoice)[] = [
        ...createdInvoiceData,
        ...paidInvoiceData,
      ];

      setInvoiceData(allInvoiceData || []);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
    }
  }, [address, chainId]);

  // Memoize onAddress
  const onAddress = useCallback(async () => {
    await getInvoiceData();
  }, [getInvoiceData]);

  // Fetch invoice data when user address or chain changes
  useEffect(() => {
    refetchAllInvoiceData();
    if (!address || !chain) {
      setInvoiceData([]); // Clear data if no address or chain is available
      setAllInvoiceData([]);
    } else {
      onAddress(); // Fetch invoice data for the connected account
    }
  }, [address, chain, refetchAllInvoiceData, onAddress]);

  // Error handler for blockchain operations
  const getError = (error: any) => {
    if (
      error.message.includes("user rejected transaction") ||
      error.message.includes("User denied transaction.")
    ) {
      return; // Ignore user rejection errors
    }

    const errorData = error.error?.data || error?.data;

    // Check for specific error codes and display corresponding messages
    if (errorData) {
      for (const [errorCode, message] of Object.entries(errorMessages)) {
        if (errorData.includes(errorCode)) {
          toast.error(message); // Show error notification
          return;
        }
      }
    }

    const message = error?.data?.message || error?.error?.data?.message;
    toast.error(message || "Something went wrong"); // Show a generic error message
  };

  // Function to create an invoice
  const createInvoice = async (
    invoicePrice: bigint
  ): Promise<Address | undefined> => {
    setIsLoading("createInvoice"); // Set the loading state to indicate the operation in progress

    try {
      // Fetch gas price
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      // Send a transaction to the PaymentProcessor contract to create the invoice
      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "createInvoice",
          args: [invoicePrice],
        }),
        gasPrice,
      });

      // Wait for the transaction to be mined and fetch the receipt
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash: tx!,
      });

      // Check the transaction status and provide feedback to the user
      if (receipt?.status) {
        // Extract the invoice Key from the logs in the transaction receipt
        const invoiceKey = receipt?.logs[0].topics[1];
        toast.success("Invoice successfully created");
        await getInvoiceData();
        return invoiceKey;
      } else {
        toast.error("Error creating invoice, Please try again.");
        return undefined;
      }
    } catch (error) {
      getError(error);
    }
    setIsLoading(""); // Reset the loading state
  };

  const makeInvoicePayment = async (
    amount: bigint,
    invoiceKey: Address
  ): Promise<boolean> => {
    setIsLoading("makeInvoicePayment");

    let success = false;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "makeInvoicePayment",
          args: [invoiceKey],
        }),
        value: amount,
        gasPrice,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash: tx!,
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

  const payAdvancedInvoice = async (
    paymentType: "paySingleInvoice" | "payMetaInvoice",
    amount: bigint,
    invoiceKey: Address,
    paymentToken: Address
  ): Promise<boolean> => {
    setIsLoading(paymentType);

    let success = false;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      // If not native token, ensure approval first
      if (paymentToken !== zeroAddress && amount > BigInt(0)) {
        const approved = await handleApproval(
          paymentToken,
          ADVANCE_INVOICE_ADDRESS[chainId],
          amount,
          address!
        );

        if (!approved) {
          toast.error("Approval failed");
          return false;
        }
      }

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: ADVANCE_INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: advancedPaymentProcessor,
          functionName: paymentType,
          args: [invoiceKey, paymentToken],
        }),
        value: amount,
        gasPrice,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash: tx!,
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

  const sellerAction = async (
    invoiceKey: Address,
    state: boolean
  ): Promise<boolean> => {
    const action = state ? "accepted" : "rejected";

    setIsLoading(action);
    let success = false;
    let progressToastId;

    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "sellerAction",
          args: [invoiceKey, state],
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
        toast.success(`Successfully ${action} the invoice.`);
        await getInvoiceData();
        success = true;
      } else {
        toast.dismiss(progressToastId);
        toast.error("something went wrong, Please try again.");
      }
    } catch (error) {
      toast.dismiss(progressToastId);
      getError(error);
    }
    setIsLoading("");
    return success;
  };

  const cancelInvoice = async (invoiceKey: Address): Promise<boolean> => {
    setIsLoading("cancelInvoice");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "cancelInvoice",
          args: [invoiceKey],
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
        toast.success("Invoice successfully cancelled");
        await getInvoiceData();
        success = true;
      } else {
        toast.dismiss(progressToastId);
        toast.error("something went wrong, Please try again.");
      }
    } catch (error) {
      getError(error);
    }
    setIsLoading("");
    return success;
  };

  const releaseInvoice = async (invoiceKey: Address): Promise<boolean> => {
    setIsLoading("releaseInvoice");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "releaseInvoice",
          args: [invoiceKey],
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
        toast.success("Invoice successfully released");
        await getInvoiceData();
        success = true;
      } else {
        toast.dismiss(progressToastId);
        toast.error("something went wrong, Please try again.");
      }
    } catch (error) {
      toast.dismiss(progressToastId);
      getError(error);
    }
    setIsLoading("");
    return success;
  };

  const refundBuyerAfterWindow = async (
    invoiceKey: Address
  ): Promise<boolean> => {
    setIsLoading("refundBuyerAfterWindow");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "refundBuyerAfterWindow",
          args: [invoiceKey],
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

  const transferOwnership = async (address: Address): Promise<boolean> => {
    setIsLoading("transferOwnership");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);
      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "transferOwnership",
          args: [address],
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

  // const setFeeReceiversAddress = async (address: Address): Promise<boolean> => {
  //   setIsLoading("setFeeReceiversAddress");

  //   let success = false;
  //   let progressToastId;
  //   try {
  //     const gasPrice = await fetchGasPrice(publicClient, chainId);

  //     const tx = await walletClient?.sendTransaction({
  //       chain: polygonAmoy,
  //       to: INVOICE_ADDRESS[chainId],
  //       data: encodeFunctionData({
  //         abi: paymentProcessor,
  //         functionName: "setFeeReceiversAddress",
  //         args: [address],
  //       }),
  //       gasPrice,
  //     });

  //     progressToastId = toast.info("Transaction in progress...", {
  //       duration: Infinity,
  //     });

  //     const receipt = await publicClient?.waitForTransactionReceipt({
  //       hash: tx!,
  //     });

  //     if (receipt?.status) {
  //       toast.dismiss(progressToastId);
  //       toast.success("Fee receiver address updated successfully");
  //       await getInvoiceData();
  //       success = true;
  //     } else {
  //       toast.dismiss(progressToastId);
  //       toast.error("Failed to update fee receiver address. Please try again.");
  //     }
  //   } catch (error) {
  //     toast.dismiss(progressToastId);
  //     getError(error);
  //   }
  //   setIsLoading("");
  //   return success;
  // };

  const setInvoiceHoldPeriod = async (
    invoiceKey: Address,
    holdPeriod: number
  ): Promise<boolean> => {
    setIsLoading("setInvoiceHoldPeriod");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "setInvoiceReleaseTime",
          args: [invoiceKey, holdPeriod],
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
        toast.success("Invoice hold period successfully set");
        await getInvoiceData();
        success = true;
      } else {
        toast.error("Failed to set invoice hold period. Please try again");
      }
    } catch (error) {
      toast.dismiss(progressToastId);
      getError(error);
    }
    setIsLoading("");
    return success;
  };

  const setDefaultHoldPeriod = async (
    newDefaultHoldPeriod: bigint
  ): Promise<boolean> => {
    setIsLoading("setDefaultHoldPeriod");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);
      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "setDefaultHoldPeriod",
          args: [newDefaultHoldPeriod],
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

  // const setFee = async (newFee: bigint): Promise<boolean> => {
  //   setIsLoading("setFee");

  //   let success = false;
  //   let progressToastId;
  //   try {
  //     const gasPrice = await fetchGasPrice(publicClient, chainId);

  //     const tx = await walletClient?.sendTransaction({
  //       chain: polygonAmoy,
  //       to: INVOICE_ADDRESS[chainId],
  //       data: encodeFunctionData({
  //         abi: paymentProcessor,
  //         functionName: "setFeeRate",
  //         args: [newFee],
  //       }),

  //       gasPrice,
  //     });

  //     progressToastId = toast.info("Transaction in progress...", {
  //       duration: Infinity,
  //     });

  //     const receipt = await publicClient?.waitForTransactionReceipt({
  //       hash: tx!,
  //     });

  //     if (receipt?.status) {
  //       toast.dismiss(progressToastId);
  //       toast.success("Successfully set new fee");
  //       await getInvoiceData();
  //       success = true;
  //     } else {
  //       toast.dismiss(progressToastId);
  //       toast.error("Failed to set new fee. Please try again");
  //     }
  //   } catch (error) {
  //     toast.dismiss(progressToastId);
  //     getError(error);
  //   }
  //   setIsLoading("");
  //   return success;
  // };

  const setMinimumInvoiceValue = async (newValue: bigint): Promise<boolean> => {
    setIsLoading("setMinimumInvoiceValue");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: paymentProcessor,
          functionName: "setMinimumInvoiceValue",
          args: [newValue],
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

  const getInvoiceOwner = async (id: string): Promise<string> => {
    const { data, error } = await client(chainId)
      .query(invoiceOwnerQuery, { id })
      .toPromise();

    if (error) {
      console.error("GraphQL Error:", error.message);
      return "";
    }

    return data?.invoice?.seller?.id || "";
  };

  const getAdvancedInvoiceData = async (
    invoiceKey: Address,
    query: string,
    type: "smartInvoice" | "metaInvoice"
  ): Promise<any> => {
    const { data, error } = await client(chainId)
      .query(query, { id: invoiceKey })
      .toPromise();

    if (error) {
      console.error(`[GraphQL Error] ${type}:`, error.message);
      return "";
    }

    return data || "";
  };

  const handleApproval = async (
    tokenAddress: Address,
    spender: Address,
    amount: bigint,
    owner: Address
  ): Promise<boolean> => {
    try {
      const allowance = await publicClient?.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "allowance",
        args: [owner, spender],
      });

      if (allowance && allowance >= amount) return true;

      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: tokenAddress,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [spender, maxUint256],
        }),
        gasPrice,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash: tx!,
      });

      if (receipt?.status === "success") {
        toast.success("Approval successful");
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

  const setFeeReceiversAddress = (): Promise<boolean> => {
    return Promise.resolve(false); // or true, or whatever def
  };

  const setFee = (): Promise<boolean> => {
    return Promise.resolve(false); // or true, or whatever def
  };

  // Contract interactions (e.g., createInvoice, makeInvoicePayment) are implemented below
  // Each function interacts with the blockchain using `walletClient` and `publicClient`
  return (
    <ContractContext.Provider
      value={{
        isLoading,
        invoiceData,
        allInvoiceData,
        createInvoice,
        makeInvoicePayment,
        payAdvancedInvoice,
        sellerAction,
        cancelInvoice,
        releaseInvoice,
        refundBuyerAfterWindow,
        setFeeReceiversAddress,
        setInvoiceHoldPeriod,
        setDefaultHoldPeriod,
        transferOwnership,
        setFee,
        setMinimumInvoiceValue,
        getInvoiceOwner,
        getAdvancedInvoiceData,
        refetchAllInvoiceData: async () => {
          await getAllInvoiceData();
        },
        refetchInvoiceData: async () => {
          await getInvoiceData();
        },
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};
export default WalletProvider;
