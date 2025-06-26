import { ReactNode, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { POLYGON_AMOY } from "@/constants";
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
} from "@/services/blockchain/SimplePaymentProcessor";
import {
  payAdvancedInvoice,
  acceptMarketplaceInvoice,
  cancelMarketplaceInvoice,
  requestCancelation,
  handleCancelationRequest,
  createDispute,
  claimExpiredInvoiceRefunds,
  resolveDispute,
} from "@/services/blockchain/AdvancedPaymentProcessor";
import { Address } from "viem";
import { WagmiClient } from "@/services/blockchain/type";

type Props = {
  children?: ReactNode;
};

const WalletProvider = ({ children }: Props) => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || POLYGON_AMOY;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

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
  } = useInvoiceData();

  return (
    <ContractContext.Provider
      value={{
        isLoading,
        invoiceData,
        allInvoiceData,
        createInvoice: (invoicePrice: bigint) =>
          createInvoice(wagmiClients, invoicePrice, chainId, setIsLoading),
        makeInvoicePayment: (amount: bigint, invoiceKey: Address) =>
          makeInvoicePayment(
            wagmiClients,
            amount,
            invoiceKey,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        payAdvancedInvoice: (
          paymentType: "paySingleInvoice" | "payMetaInvoice",
          price: bigint,
          invoiceKey: Address,
          paymentToken: Address
        ) =>
          address
            ? payAdvancedInvoice(
                wagmiClients,
                paymentType,
                price,
                invoiceKey,
                paymentToken,
                chainId,
                address,
                setIsLoading,
                getInvoiceData
              )
            : Promise.resolve(false),
        sellerAction: (invoiceKey: Address, state: boolean) =>
          sellerAction(
            wagmiClients,
            invoiceKey,
            state,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        cancelInvoice: (invoiceKey: Address) =>
          cancelInvoice(
            wagmiClients,
            invoiceKey,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        releaseInvoice: (invoiceKey: Address) =>
          releaseInvoice(
            wagmiClients,
            invoiceKey,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        refundBuyerAfterWindow: (invoiceKey: Address) =>
          refundBuyerAfterWindow(
            wagmiClients,
            invoiceKey,
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
        setInvoiceHoldPeriod: (invoiceKey: Address, holdPeriod: number) =>
          setInvoiceHoldPeriod(
            wagmiClients,
            invoiceKey,
            holdPeriod,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) =>
          setDefaultHoldPeriod(
            wagmiClients,
            newDefaultHoldPeriod,
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
          invoiceKey: Address,
          query: string,
          type: "smartInvoice" | "metaInvoice"
        ) => fetchAdvancedInvoiceData(invoiceKey, query, type),
        acceptMarketplaceInvoice: (orderId: Address) =>
          acceptMarketplaceInvoice(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        cancelMarketplaceInvoice: (orderId: Address) =>
          cancelMarketplaceInvoice(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        requestCancelation: (orderId: Address) =>
          requestCancelation(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        handleCancelationRequest: (orderId: Address, accept: boolean) =>
          handleCancelationRequest(
            wagmiClients,
            orderId,
            accept,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        createDispute: (orderId: Address) =>
          createDispute(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        claimExpiredInvoiceRefunds: (orderId: Address) =>
          claimExpiredInvoiceRefunds(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        resolveDispute: (orderId: Address) =>
          resolveDispute(
            wagmiClients,
            orderId,
            chainId,
            setIsLoading,
            getInvoiceData
          ),
        refetchAllInvoiceData,
        refetchInvoiceData,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
};

export default WalletProvider;
