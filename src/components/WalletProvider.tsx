import { ReactNode, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import {
  ContractActionsContext,
  ContractLoadingContext,
  InvoiceStateContext,
  type ContractActions,
  type InvoiceState,
} from "@/context/contract-context";
import { useInvoiceData } from "@/hooks/useInvoiceData";
import {
  createInvoice as createSimpleInvoice,
  makeInvoicePayment,
  sellerAction,
  cancelInvoice,
  releaseInvoice,
  refundBuyerAfterWindow,
} from "@/services/blockchain/SimplePaymentProcessor";
import {
  payIntermediatedInvoice as submitIntermediatedInvoicePayment,
  setIntermediatedOperator,
} from "@/services/blockchain/IntermediatedPaymentProcessor";
import { Address } from "viem";
import { WagmiClient } from "@/services/blockchain/types";
import { INTERMEDIATED_PAYMENT_PROCESSOR, BASE_SEPOLIA } from "@/constants";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";

type Props = {
  children?: ReactNode;
};

const WalletProvider = ({ children }: Props) => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || BASE_SEPOLIA;
  const { data: walletClient } = useHintedWalletClient();
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
    getInvoiceOwner,
    getIntermediatedInvoiceData: fetchIntermediatedInvoiceData,
    refreshAdminData,
    addCreatedSimpleInvoice,
    upsertLocalInvoice,
    watchInvoiceEvents,
    watchInvoiceStatus,
    trackInvoices,
  } = useInvoiceData();

  const invalidateIntermediatedInvoiceQueries = useCallback(() => {
    const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[chainId];
    queryClient.invalidateQueries({
      queryKey: ["viem-read", chainId, contractAddress],
    });
    queryClient.invalidateQueries({
      queryKey: ["viem-balance", chainId],
    });
  }, [chainId, queryClient]);

  const actions = useMemo<ContractActions>(
    () => ({
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
        onSubmitted?: (hash: `0x${string}`) => void,
      ) =>
        makeInvoicePayment(
          wagmiClients,
          amount,
          invoiceId,
          chainId,
          setIsLoading,
          storageRef,
          share,
          onSubmitted,
        ),
      payIntermediatedInvoice: (
        paymentType: "paySingleInvoice" | "payMetaInvoice",
        price: bigint,
        invoiceId: bigint,
        paymentToken: Address,
        onSubmitted?: (hash: `0x${string}`) => void,
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
              onSubmitted,
            ).then((success) => {
              if (success) {
                invalidateIntermediatedInvoiceQueries();
              }
              return success;
            })
          : Promise.resolve(false),
      setIntermediatedOperator: (address: Address) =>
        setIntermediatedOperator(wagmiClients, address, chainId, setIsLoading),
      sellerAction: (invoiceId: bigint, state: boolean) =>
        sellerAction(wagmiClients, invoiceId, state, chainId, setIsLoading),
      cancelInvoice: (invoiceId: bigint) =>
        cancelInvoice(wagmiClients, invoiceId, chainId, setIsLoading),
      releaseInvoice: (invoiceId: bigint) =>
        releaseInvoice(wagmiClients, invoiceId, chainId, setIsLoading),
      refundBuyerAfterWindow: (invoiceId: bigint) =>
        refundBuyerAfterWindow(wagmiClients, invoiceId, chainId, setIsLoading),
      getInvoiceOwner,
      getIntermediatedInvoiceData: (
        invoiceId: bigint,
        type: "smartInvoice" | "metaInvoice",
      ) => fetchIntermediatedInvoiceData(invoiceId, type),
      refreshAdminData,
      upsertLocalInvoice,
      watchInvoiceEvents,
      watchInvoiceStatus,
      trackInvoices,
    }),
    [
      wagmiClients,
      chainId,
      address,
      addCreatedSimpleInvoice,
      getInvoiceOwner,
      fetchIntermediatedInvoiceData,
      refreshAdminData,
      upsertLocalInvoice,
      watchInvoiceEvents,
      watchInvoiceStatus,
      trackInvoices,
      invalidateIntermediatedInvoiceQueries,
    ],
  );

  const invoiceState = useMemo<InvoiceState>(
    () => ({ invoiceData, liveInvoiceData, allInvoiceData }),
    [invoiceData, liveInvoiceData, allInvoiceData],
  );

  return (
    <ContractActionsContext.Provider value={actions}>
      <ContractLoadingContext.Provider value={isLoading}>
        <InvoiceStateContext.Provider value={invoiceState}>
          {children}
        </InvoiceStateContext.Provider>
      </ContractLoadingContext.Provider>
    </ContractActionsContext.Provider>
  );
};

export default WalletProvider;
