import { ReactNode, useState } from "react";
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
} from "@/services/blockchain/SimplePaymentProcessor";
import {
  payAdvancedInvoice,
  setMarketplaceAddress,
} from "@/services/blockchain/AdvancedPaymentProcessor";
import { Address } from "viem";
import { WagmiClient } from "@/services/blockchain/type";
import { ETHEREUM_SEPOLIA } from "@/constants";

type Props = {
  children?: ReactNode;
};

const WalletProvider = ({ children }: Props) => {
  const { chain, address } = useAccount();
  const chainId = chain?.id || ETHEREUM_SEPOLIA;
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
    refreshAdminData,
  } = useInvoiceData();

  return (
    <ContractContext.Provider
      value={{
        isLoading,
        invoiceData,
        allInvoiceData,
        createInvoice: (invoicePrice: bigint) =>
          createInvoice(wagmiClients, invoicePrice, chainId, setIsLoading),
        makeInvoicePayment: (amount: bigint, orderId: bigint) =>
          makeInvoicePayment(
            wagmiClients,
            amount,
            orderId,
            chainId,
            setIsLoading
          ),
        payAdvancedInvoice: (
          paymentType: "paySingleInvoice" | "payMetaInvoice",
          price: bigint,
          orderId: bigint,
          paymentToken: Address
        ) =>
          address
            ? payAdvancedInvoice(
                wagmiClients,
                paymentType,
                price,
                orderId,
                paymentToken,
                chainId,
                address,
                setIsLoading
              )
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
