/* eslint-disable @typescript-eslint/no-explicit-any */
import { Invoice, AllInvoice, AdminAction } from "@/model/model";
import React from "react";
import type { Address } from "viem";

// This code defines a React Context for managing and interacting with the PaymentProcessor contract,
// providing default values and a structure for contract-related operations within the application.

export interface ContractContextData {
  isLoading: string | undefined;
  invoiceData: Invoice[];
  liveInvoiceData: Invoice[];
  allInvoiceData: {
    invoices: AllInvoice[];
    actions: AdminAction[];
    marketplaceInvoices: AllInvoice[];
  };
  createInvoice: (
    invoicePrice: bigint,
    storageRef?: string,
    share?: boolean
  ) => Promise<bigint | undefined>;
  makeInvoicePayment: (
    amount: bigint,
    invoiceId: bigint,
    storageRef?: string,
    share?: boolean
  ) => Promise<boolean>;
  payAdvancedInvoice: (
    paymentType: "paySingleInvoice" | "payMetaInvoice",
    amount: bigint,
    invoiceId: bigint,
    paymentToken: Address
  ) => Promise<boolean>;
  getInvoiceOwner: (id: string) => Promise<string>;
  sellerAction: (invoiceId: bigint, state: boolean) => Promise<boolean>;
  cancelInvoice: (invoiceId: bigint) => Promise<boolean>;
  releaseInvoice: (invoiceId: bigint) => Promise<boolean>;
  refundBuyerAfterWindow: (invoiceId: bigint) => Promise<boolean>;
  setMinimumInvoiceValue: (newValue: bigint) => Promise<boolean>;
  setFeeReceiversAddress: (address: Address) => Promise<boolean>;
  transferOwnership: (address: Address) => Promise<boolean>;
  setInvoiceHoldPeriod: (
    invoiceId: bigint,
    holdPeriod: bigint
  ) => Promise<boolean>;
  setDecisionWindow: (newWindow: bigint) => Promise<boolean>;
  setValidPeriod: (newValidPeriod: bigint) => Promise<boolean>;
  setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) => Promise<boolean>;
  setFee: (newFee: bigint) => Promise<boolean>;
  getAdvancedInvoiceData: (
    invoiceId: bigint,
    type: "smartInvoice" | "metaInvoice"
  ) => Promise<any>;
  setMarketplaceAddress: (marketplaceAddress: Address) => Promise<any>;
  invoicePage: number;
  hasNextPage: boolean;
  loadNextPage?: () => Promise<void>;
  loadPrevPage?: () => Promise<void>;
  refetchInvoiceData?: () => Promise<void>;
  refetchAllInvoiceData?: () => Promise<void>;
  refreshAdminData?: (force?: boolean) => Promise<void>;
  upsertLocalInvoice?: (invoice: Invoice) => void;
  setActiveEventTab?: (tab: "simple" | "marketplace") => void;
}

export const contractContextDefaults: ContractContextData = {
  isLoading: undefined,
  invoiceData: [],
  liveInvoiceData: [],
  invoicePage: 0,
  hasNextPage: false,
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
  setDecisionWindow: async () => Promise.resolve(false),
  setValidPeriod: async () => Promise.resolve(false),
  setDefaultHoldPeriod: async () => Promise.resolve(false),
  setMarketplaceAddress: async () => Promise.resolve(""),
  setFee: async () => Promise.resolve(false),
  setMinimumInvoiceValue: async () => Promise.resolve(false),
  refetchInvoiceData: async () => Promise.resolve(),
  refetchAllInvoiceData: async () => Promise.resolve(),
  refreshAdminData: async () => Promise.resolve(),
  upsertLocalInvoice: () => {},
  getInvoiceOwner: async () => Promise.resolve(""),
  getAdvancedInvoiceData: async () => Promise.resolve(""),
  setActiveEventTab: () => {},
};

export const ContractContext = React.createContext<ContractContextData>(
  contractContextDefaults
);
