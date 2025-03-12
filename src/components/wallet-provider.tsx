/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";
import { formatEther } from "ethers";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { PaymentProcessor__factory } from "@/typechain";
import { Address, encodeFunctionData } from "viem";
import { createClient } from "urql";
import { ContractContext } from "@/context/contract-context";
import { format } from "date-fns";
import {
  INVOICE_ADDRESS,
  POLYGON_AMOY,
  THE_GRAPH_API_URL,
  errorMessages,
} from "@/constants";
import {
  UserCreatedInvoice,
  Invoice,
  UserPaidInvoice,
  AllUsersInvoice,
} from "@/model/model";
import { polygonAmoy } from "viem/chains";

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
      id
      releasedAt
      paidAt
      paymentTxHash
      contract
      fee
      creator {
        id
      }
      payer {
        id
      }
    }
  }
`;

// GraphQL query to fetch invoices for a specific user
const invoiceQuery = `query ($address: String!) {
  user (id: $address) {
    createdInvoices {
      amountPaid
      createdAt
      id
      paidAt
      price
      status
      holdPeriod
      contract
      paymentTxHash
      releaseHash
      payer {
        id
      }
    }
    paidInvoices {
      amountPaid
      createdAt
      id
      paidAt
      price
      status
      holdPeriod
      contract
      fee
      paymentTxHash
      creator {
        id
      }
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
  const [allInvoiceData, setAllInvoiceData] = useState<AllUsersInvoice[]>([]);

  // Fetch invoice data when user address or chain changes
  useEffect(() => {
    const onAddress = async () => {
      await getInvoiceData();
    };

    if (!address || !chain) {
      setAllInvoiceData([]);
      setInvoiceData([]); // Clear data if no address or chain is available
    } else {
      onAddress(); // Fetch invoice data for the connected account
    }
  }, [address, chain]);

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

  const getAllInvoiceData = async () => {
    try {
      const { data, error } = await client(chainId)
        .query(GET_ALL_INVOICES, {})
        .toPromise();

      if (error) {
        console.log(error.message);
      }

      const allInvoice: AllUsersInvoice[] = data?.invoices || [];

      const allInvoiceData: AllUsersInvoice[] = allInvoice.map(
        (invoice: any) => ({
          id: invoice.id,
          contract: invoice.contract,
          creator: invoice.creator.id,
          paymentTxHash: invoice.paymentTxHash,
          payer: invoice.payer,
          releaseDate: invoice.releasedAt,
          fee: invoice.fee,
        })
      );

      console.log("DATA", allInvoiceData);

      setAllInvoiceData(allInvoiceData);
    } catch (error) {
      console.error("Error fetching invoice data:", error);
    }
  };

  // Fetch invoice data for the connected user
  const getInvoiceData = async () => {
    try {
      const { data, error } = await client(chainId)
        .query(invoiceQuery, { address: address?.toLowerCase() })
        .toPromise();

      if (error) {
        console.log(error.message);
      }

      // Process created invoices
      const createdInvoice: UserCreatedInvoice[] =
        data?.user?.createdInvoices || [];

      const paidInvoices: UserPaidInvoice[] = data?.user?.paidInvoices || [];

      // Format created invoices to fit with out model
      const createdInvoiceData: UserCreatedInvoice[] = createdInvoice.map(
        (invoice: any) => ({
          id: invoice?.id,
          createdAt: invoice.createdAt
            ? format(new Date(invoice.createdAt * 1000), "d/MMM/yy")
            : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: invoice.status || "Unknown",
          price: invoice.price ? formatEther(invoice.price) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(invoice.amountPaid)
            : null,
          type: "Creator",
          holdPeriod: invoice.holdPeriod,
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
          payer: invoice.payer === null ? "" : invoice.payer.id,
          releaseHash: invoice.releaseHash,
        })
      );

      // Format paid invoices
      const paidInvoiceData: UserPaidInvoice[] = paidInvoices.map(
        (invoice: any) => ({
          id: invoice.id,
          createdAt: invoice.createdAt
            ? format(new Date(invoice.createdAt * 1000), "d/MMM/yy")
            : null,
          paidAt: invoice.paidAt || "Not Paid",
          status: invoice.status || "Unknown",
          price: invoice.price ? formatEther(invoice.price) : null,
          amountPaid: invoice.amountPaid
            ? formatEther(invoice.amountPaid)
            : null,
          type: "Payer",
          holdPeriod: invoice.holdPeriod,
          creator: invoice.creator.id,
          contract: invoice.contract,
          paymentTxHash: invoice.paymentTxHash,
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
  };

  // Function to create an invoice
  const createInvoice = async (invoicePrice: bigint): Promise<number> => {
    setIsLoading("createInvoice"); // Set the loading state to indicate the operation in progress

    let id = 0; // Initialize the invoice ID to 0
    try {
      // Fetch gas price
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      // Send a transaction to the PaymentProcessor contract to create the invoice
      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "createInvoice",
          args: [invoicePrice],
        }),

        gasPrice,
      });

      // Wait for the transaction to be mined and fetch the receipt
      const receipt = await publicClient?.waitForTransactionReceipt({
        hash: tx!,
      });

      // Extract the invoice ID from the logs in the transaction receipt
      const hexId = receipt?.logs[0].topics[1];

      id = parseInt(hexId!, 16);

      // Check the transaction status and provide feedback to the user
      if (receipt?.status) {
        toast.success("Invoice successfully created");
        await getInvoiceData();
      } else {
        toast.error("Error creating invoice, Please try again.");
      }
    } catch (error) {
      getError(error);
    }
    setIsLoading(""); // Reset the loading state
    return id; // Return the created invoice ID
  };

  const makeInvoicePayment = async (
    amount: bigint,
    invoiceId: bigint
  ): Promise<boolean> => {
    setIsLoading("makeInvoicePayment");

    let success = false;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "makeInvoicePayment",
          args: [invoiceId],
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

  const creatorsAction = async (
    invoiceId: bigint,
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
          abi: PaymentProcessor__factory.abi,
          functionName: "creatorsAction",
          args: [invoiceId, state],
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

  const cancelInvoice = async (invoiceId: bigint): Promise<boolean> => {
    setIsLoading("cancelInvoice");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "cancelInvoice",
          args: [invoiceId],
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

  const releaseInvoice = async (invoiceId: bigint): Promise<boolean> => {
    setIsLoading("releaseInvoice");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "releaseInvoice",
          args: [invoiceId],
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

  const refundPayerAfterWindow = async (
    invoiceId: bigint
  ): Promise<boolean> => {
    setIsLoading("refundPayerAfterWindow");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "refundPayerAfterWindow",
          args: [invoiceId],
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
        toast.success("Refund to payer successfully processed");
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
          abi: PaymentProcessor__factory.abi,
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

  const setFeeReceiversAddress = async (address: Address): Promise<boolean> => {
    setIsLoading("setFeeReceiversAddress");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "setFeeReceiversAddress",
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
        toast.success("Fee receiver address updated successfully");
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

  const setInvoiceHoldPeriod = async (
    invoiceId: bigint,
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
          abi: PaymentProcessor__factory.abi,
          functionName: "setInvoiceHoldPeriod",
          args: [invoiceId, holdPeriod],
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
          abi: PaymentProcessor__factory.abi,
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

  const setFee = async (newFee: bigint): Promise<boolean> => {
    setIsLoading("setFee");

    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);

      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "setFee",
          args: [newFee],
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

  const withdrawFees = async (): Promise<boolean> => {
    setIsLoading("withdrawFees");
    let success = false;
    let progressToastId;
    try {
      const gasPrice = await fetchGasPrice(publicClient, chainId);
      const tx = await walletClient?.sendTransaction({
        chain: polygonAmoy,
        to: INVOICE_ADDRESS[chainId],
        data: encodeFunctionData({
          abi: PaymentProcessor__factory.abi,
          functionName: "withdrawFees",
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
        toast.success("Successfully withdraw fees");
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

  // Contract interactions (e.g., createInvoice, makeInvoicePayment) are implemented below
  // Each function interacts with the blockchain using `walletClient` and `publicClient`
  return (
    <ContractContext.Provider
      value={{
        isLoading,
        invoiceData,
        createInvoice,
        makeInvoicePayment,
        creatorsAction,
        cancelInvoice,
        releaseInvoice,
        refundPayerAfterWindow,
        setFeeReceiversAddress,
        setInvoiceHoldPeriod,
        setDefaultHoldPeriod,
        transferOwnership,
        setFee,
        withdrawFees,
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
