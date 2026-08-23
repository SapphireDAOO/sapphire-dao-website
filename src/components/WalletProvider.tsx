import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  ContractContext,
  type ContractContextData,
} from "@/context/contract-context";
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
  setFee,
  setMinimumInvoiceValue,
  setDecisionWindow,
  setValidPeriod,
} from "@/services/blockchain/SimplePaymentProcessor";
import {
  payIntermediatedInvoice as submitIntermediatedInvoicePayment,
  setMarketplaceAddress,
} from "@/services/blockchain/IntermediatedPaymentProcessor";
import { Address } from "viem";
import { WagmiClient } from "@/services/blockchain/types";
import { INTERMEDIATED_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";

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
    getIntermediatedInvoiceData: fetchIntermediatedInvoiceData,
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

  const invalidateIntermediatedInvoiceQueries = useCallback(() => {
    const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
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

  const handleIntermediatedInvoiceSuccess = useCallback(async () => {
    invalidateIntermediatedInvoiceQueries();
    await refetchInvoiceData?.();
    scheduleInvoiceRefresh();
  }, [
    invalidateIntermediatedInvoiceQueries,
    refetchInvoiceData,
    scheduleInvoiceRefresh,
  ]);

  // Memoized so the context value's identity only changes when its inputs do —
  // an inline object literal here would re-render every ContractContext
  // consumer on every provider render (which live invoice events make
  // frequent), even when nothing they read has changed.
  const contextValue = useMemo<ContractContextData>(
    () => ({
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
        holdPeriodSeconds?: number,
      ) => {
        const created = await createSimpleInvoice(
          wagmiClients,
          invoicePrice,
          chainId,
          setIsLoading,
          storageRef,
          share,
          holdPeriodSeconds,
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
      payIntermediatedInvoice: (
        paymentType: "paySingleInvoice" | "payMetaInvoice",
        price: bigint,
        invoiceId: bigint,
        paymentToken: Address,
      ) =>
        address
          ? submitIntermediatedInvoicePayment(
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
                await handleIntermediatedInvoiceSuccess();
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
      getIntermediatedInvoiceData: (
        invoiceId: bigint,
        type: "smartInvoice" | "metaInvoice",
      ) => fetchIntermediatedInvoiceData(invoiceId, type),
      refetchAllInvoiceData,
      refetchInvoiceData,
      refreshAdminData,
      upsertLocalInvoice,
      setActiveEventTab,
    }),
    [
      isLoading,
      invoiceData,
      liveInvoiceData,
      allInvoiceData,
      invoicePage,
      hasNextPage,
      loadNextPage,
      loadPrevPage,
      wagmiClients,
      chainId,
      address,
      addCreatedSimpleInvoice,
      getInvoiceData,
      getInvoiceOwner,
      fetchIntermediatedInvoiceData,
      refetchAllInvoiceData,
      refetchInvoiceData,
      refreshAdminData,
      upsertLocalInvoice,
      setActiveEventTab,
      handleIntermediatedInvoiceSuccess,
    ],
  );

  return (
    <ContractContext.Provider value={contextValue}>
      {children}
    </ContractContext.Provider>
  );
};

export default WalletProvider;
