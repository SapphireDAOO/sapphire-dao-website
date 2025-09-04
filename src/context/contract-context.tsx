/* eslint-disable @typescript-eslint/no-explicit-any */
import { Invoice, AllInvoice, AdminAction } from "@/model/model";
import React from "react";
import type { Address } from "viem";

// This code defines a React Context for managing and interacting with the PaymentProcessor contract,
// providing default values and a structure for contract-related operations within the application.

export interface ContractContextData {
  isLoading: string | undefined;
  invoiceData: Invoice[];
  allInvoiceData: {
    invoices: AllInvoice[];
    actions: AdminAction[];
    marketplaceInvoices: AllInvoice[];
  };
  createInvoice: (invoicePrice: bigint) => Promise<bigint | undefined>;
  makeInvoicePayment: (amount: bigint, orderId: bigint) => Promise<boolean>;
  payAdvancedInvoice: (
    paymentType: "paySingleInvoice" | "payMetaInvoice",
    amount: bigint,
    orderId: bigint,
    paymentToken: Address
  ) => Promise<boolean>;
  getInvoiceOwner: (id: string) => Promise<string>;
  sellerAction: (orderId: bigint, state: boolean) => Promise<boolean>;
  cancelInvoice: (orderId: bigint) => Promise<boolean>;
  releaseInvoice: (orderId: bigint) => Promise<boolean>;
  refundBuyerAfterWindow: (orderId: bigint) => Promise<boolean>;
  setMinimumInvoiceValue: (newValue: bigint) => Promise<boolean>;
  setFeeReceiversAddress: (address: Address) => Promise<boolean>;
  transferOwnership: (address: Address) => Promise<boolean>;
  setInvoiceHoldPeriod: (
    orderId: bigint,
    holdPeriod: bigint
  ) => Promise<boolean>;
  setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) => Promise<boolean>;
  setFee: (newFee: bigint) => Promise<boolean>;
  getAdvancedInvoiceData: (
    orderId: bigint,
    query: string,
    type: "smartInvoice" | "metaInvoice"
  ) => Promise<any>;
  setMarketplaceAddress: (marketplaceAddress: Address) => Promise<any>;
  refetchInvoiceData?: () => Promise<void>;
  refetchAllInvoiceData?: () => Promise<void>;
}

export const contractContextDefaults: ContractContextData = {
  isLoading: undefined,
  invoiceData: [],
  allInvoiceData: {
    invoices: [],
    actions: [],
    marketplaceInvoices: [],
  },
  transferOwnership: async () => Promise.resolve(false),
  createInvoice: async () => Promise.resolve(BigInt(0)),
  makeInvoicePayment: async () => Promise.resolve(false),
  payAdvancedInvoice: async () => Promise.resolve(false),
  sellerAction: async () => Promise.resolve(false),
  cancelInvoice: async () => Promise.resolve(false),
  releaseInvoice: async () => Promise.resolve(false),
  refundBuyerAfterWindow: async () => Promise.resolve(false),
  setFeeReceiversAddress: async () => Promise.resolve(false),
  setInvoiceHoldPeriod: async () => Promise.resolve(false),
  setDefaultHoldPeriod: async () => Promise.resolve(false),
  setMarketplaceAddress: async () => Promise.resolve(""),
  setFee: async () => Promise.resolve(false),
  setMinimumInvoiceValue: async () => Promise.resolve(false),
  refetchInvoiceData: async () => Promise.resolve(),
  refetchAllInvoiceData: async () => Promise.resolve(),
  getInvoiceOwner: async () => Promise.resolve(""),
  getAdvancedInvoiceData: async () => Promise.resolve(""),
};

export const ContractContext = React.createContext<ContractContextData>(
  contractContextDefaults
);
