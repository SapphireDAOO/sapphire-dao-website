import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ContractContext } from "@/context/contract-context";
import { useInvoiceData } from "@/hooks/useInvoiceData";
import {
  createInvoice,
  makeInvoicePayment,
  sellerAction,
  cancelInvoice,
  releaseInvoice,
  refundBuyerAfterWindow,
  transferOwnership,
  setFeeReceiversAddress,
  setInvoiceHoldPeriod,
  setDefaultHoldPeriod,
  setFee,
  setMinimumInvoiceValue,
  setDecisionWindow,
  setValidPeriod,
} from "@/services/blockchain/SimplePaymentProcessor";
import {
  payAdvancedInvoice as submitAdvancedInvoicePayment,
  setMarketplaceAddress,
} from "@/services/blockchain/AdvancedPaymentProcessor";
import { Address } from "viem";
import { WagmiClient } from "@/services/blockchain/type";
import { ADVANCED_PAYMENT_PROCESSOR, ETHEREUM_SEPOLIA } from "@/constants";

const INVOICE_REFRESH_DELAY_MS = 5_000;

type Props = {
  children?: ReactNode;
};

const WalletProvider = ({ children }: Props) => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || ETHEREUM_SEPOLIA;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const wagmiClients: WagmiClient = {
    walletClient: walletClient,
    publicClient: publicClient,
  };

  const [isLoading, setIsLoading] = useState<string>();
  const {
    invoiceData,
    allInvoiceData,
    getInvoiceOwner,
    getAdvancedInvoiceData: fetchAdvancedInvoiceData,
    refetchAllInvoiceData,
    refetchInvoiceData,
    getInvoiceData,
    refreshAdminData,
  } = useInvoiceData();

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidateAdvancedInvoiceQueries = useCallback(() => {
    const contractAddress = ADVANCED_PAYMENT_PROCESSOR[chainId];
    queryClient.invalidateQueries({
      queryKey: ["viem-read", chainId, contractAddress],
    });
    queryClient.invalidateQueries({
      queryKey: ["viem-balance", chainId],
    });
  }, [chainId, queryClient]);

  const scheduleInvoiceRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) return;
    refreshTimeoutRef.current = setTimeout(() => {
      refetchInvoiceData?.();
      refreshTimeoutRef.current = null;
    }, INVOICE_REFRESH_DELAY_MS);
  }, [refetchInvoiceData]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const handleAdvancedInvoiceSuccess = useCallback(async () => {
    invalidateAdvancedInvoiceQueries();
    await refetchInvoiceData?.();
    scheduleInvoiceRefresh();
  }, [invalidateAdvancedInvoiceQueries, refetchInvoiceData, scheduleInvoiceRefresh]);

  return (
    <ContractContext.Provider
      value={{
        isLoading,
        invoiceData,
        allInvoiceData,
        createInvoice: (
          invoicePrice: bigint,
          storageRef?: string,
          share?: boolean
        ) =>
          createInvoice(
            wagmiClients,
            invoicePrice,
            chainId,
            setIsLoading,
            storageRef,
            share
          ),
        makeInvoicePayment: (
          amount: bigint,
          orderId: bigint,
          storageRef?: string,
          share?: boolean
        ) =>
          makeInvoicePayment(
            wagmiClients,
            amount,
            orderId,
            chainId,
            setIsLoading,
            storageRef,
            share
          ),
        payAdvancedInvoice: (
          paymentType: "paySingleInvoice" | "payMetaInvoice",
          price: bigint,
          orderId: bigint,
          paymentToken: Address
        ) =>
          address
            ? submitAdvancedInvoicePayment(
                wagmiClients,
                paymentType,
                price,
                orderId,
                paymentToken,
                chainId,
                address,
                setIsLoading
              ).then(async (success) => {
                if (success) {
                  await handleAdvancedInvoiceSuccess();
                }
                return success;
              })
            : Promise.resolve(false),
        setMarketplaceAddress: (address: Address) =>
          setMarketplaceAddress(wagmiClients, address, chainId, setIsLoading),
        sellerAction: (orderId: bigint, state: boolean) =>
          sellerAction(wagmiClients, orderId, state, chainId, setIsLoading),
        cancelInvoice: (orderId: bigint) =>
          cancelInvoice(wagmiClients, orderId, chainId, setIsLoading),
        releaseInvoice: (orderId: bigint) =>
          releaseInvoice(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        refundBuyerAfterWindow: (orderId: bigint) =>
          refundBuyerAfterWindow(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        transferOwnership: (address: Address) =>
          transferOwnership(
            wagmiClients,
            address,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        setFeeReceiversAddress: (address: Address) =>
          setFeeReceiversAddress(
            wagmiClients,
            address,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        setInvoiceHoldPeriod: (orderId: bigint, holdPeriod: bigint) =>
          setInvoiceHoldPeriod(
            wagmiClients,
            orderId,
            holdPeriod,
            chainId,
            setIsLoading,
            getInvoiceData,
            invoiceData.find((i) => i.orderId.toString() === orderId.toString())
              ?.contract
          ),
        setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) =>
          setDefaultHoldPeriod(
            wagmiClients,
            newDefaultHoldPeriod,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        setDecisionWindow: (newWindow: bigint) =>
          setDecisionWindow(
            wagmiClients,
            newWindow,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        setValidPeriod: (newValidPeriod: bigint) =>
          setValidPeriod(
            wagmiClients,
            newValidPeriod,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        setFee: (newFee: bigint) =>
          setFee(wagmiClients, newFee, chainId, setIsLoading, getInvoiceData),
        setMinimumInvoiceValue: (newValue: bigint) =>
          setMinimumInvoiceValue(
            wagmiClients,
            newValue,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        getInvoiceOwner,
        getAdvancedInvoiceData: (
          orderId: bigint,
          query: string,
          type: "smartInvoice" | "metaInvoice"
        ) => fetchAdvancedInvoiceData(orderId, query, type),
        refetchAllInvoiceData,
        refetchInvoiceData,
        refreshAdminData,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};

export default WalletProvider;
