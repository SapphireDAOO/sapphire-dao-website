import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ContractContext } from "@/context/contract-context";
import { useInvoiceData } from "@/hooks/useInvoiceData";
import {
  createInvoice as createSimpleInvoice,
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
import { WagmiClient } from "@/services/blockchain/types";
import { ADVANCED_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";

const INVOICE_REFRESH_DELAY_MS = 5_000;

type Props = {
  children?: ReactNode;
};

const WalletProvider = ({ children }: Props) => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();

  const wagmiClients: WagmiClient = useMemo(
    () => ({ walletClient, publicClient }),
    [walletClient, publicClient],
  );

  const [isLoading, setIsLoading] = useState<string>();

  const {
    invoiceData,
    liveInvoiceData,
    allInvoiceData,
    invoicePage,
    hasNextPage,
    getInvoiceOwner,
    getAdvancedInvoiceData: fetchAdvancedInvoiceData,
    refetchAllInvoiceData,
    refetchInvoiceData,
    loadNextPage,
    loadPrevPage,
    getInvoiceData,
    refreshAdminData,
    addCreatedSimpleInvoice,
    upsertLocalInvoice,
    setActiveEventTab,
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
  }, [
    invalidateAdvancedInvoiceQueries,
    refetchInvoiceData,
    scheduleInvoiceRefresh,
  ]);

  return (
    <ContractContext.Provider
      value={{
        isLoading,
        invoiceData,
        liveInvoiceData,
        allInvoiceData,
        invoicePage,
        hasNextPage,
        loadNextPage,
        loadPrevPage,
        createInvoice: async (
          invoicePrice: bigint,
          storageRef?: string,
          share?: boolean,
        ) => {
          const created = await createSimpleInvoice(
            wagmiClients,
            invoicePrice,
            chainId,
            setIsLoading,
            storageRef,
            share,
          );

          if (created) {
            addCreatedSimpleInvoice(created);
          }

          return created?.invoiceId;
        },
        makeInvoicePayment: (
          amount: bigint,
          invoiceId: bigint,
          storageRef?: string,
          share?: boolean,
        ) =>
          makeInvoicePayment(
            wagmiClients,
            amount,
            invoiceId,
            chainId,
            setIsLoading,
            storageRef,
            share,
          ),
        payAdvancedInvoice: (
          paymentType: "paySingleInvoice" | "payMetaInvoice",
          price: bigint,
          invoiceId: bigint,
          paymentToken: Address,
        ) =>
          address
            ? submitAdvancedInvoicePayment(
                wagmiClients,
                paymentType,
                price,
                invoiceId,
                paymentToken,
                chainId,
                address,
                setIsLoading,
              ).then(async (success) => {
                if (success) {
                  await handleAdvancedInvoiceSuccess();
                }
                return success;
              })
            : Promise.resolve(false),
        setMarketplaceAddress: (address: Address) =>
          setMarketplaceAddress(wagmiClients, address, chainId, setIsLoading),
        sellerAction: (invoiceId: bigint, state: boolean) =>
          sellerAction(wagmiClients, invoiceId, state, chainId, setIsLoading),
        cancelInvoice: (invoiceId: bigint) =>
          cancelInvoice(wagmiClients, invoiceId, chainId, setIsLoading),
        releaseInvoice: (invoiceId: bigint) =>
          releaseInvoice(
            wagmiClients,
            invoiceId,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        refundBuyerAfterWindow: (invoiceId: bigint) =>
          refundBuyerAfterWindow(
            wagmiClients,
            invoiceId,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        transferOwnership: (address: Address) =>
          transferOwnership(
            wagmiClients,
            address,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        setFeeReceiversAddress: (address: Address) =>
          setFeeReceiversAddress(
            wagmiClients,
            address,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        setInvoiceHoldPeriod: (invoiceId: bigint, holdPeriod: bigint) =>
          setInvoiceHoldPeriod(
            wagmiClients,
            invoiceId,
            holdPeriod,
            chainId,
            setIsLoading,
            getInvoiceData,
            invoiceData.find((i) => i.invoiceId.toString() === invoiceId.toString())
              ?.contract,
          ),
        setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) =>
          setDefaultHoldPeriod(
            wagmiClients,
            newDefaultHoldPeriod,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        setDecisionWindow: (newWindow: bigint) =>
          setDecisionWindow(
            wagmiClients,
            newWindow,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        setValidPeriod: (newValidPeriod: bigint) =>
          setValidPeriod(
            wagmiClients,
            newValidPeriod,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        setFee: (newFee: bigint) =>
          setFee(wagmiClients, newFee, chainId, setIsLoading, getInvoiceData),
        setMinimumInvoiceValue: (newValue: bigint) =>
          setMinimumInvoiceValue(
            wagmiClients,
            newValue,
            chainId,
            setIsLoading,
            getInvoiceData,
          ),
        getInvoiceOwner,
        getAdvancedInvoiceData: (
          invoiceId: bigint,
          type: "smartInvoice" | "metaInvoice",
        ) => fetchAdvancedInvoiceData(invoiceId, type),
        refetchAllInvoiceData,
        refetchInvoiceData,
        refreshAdminData,
        upsertLocalInvoice,
        setActiveEventTab,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};

export default WalletProvider;
