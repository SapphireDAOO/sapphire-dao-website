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
  };
  createInvoice: (invoicePrice: bigint) => Promise<Address | undefined>;
  makeInvoicePayment: (amount: bigint, invoiceKey: Address) => Promise<boolean>;
  payAdvancedInvoice: (
    paymentType: "paySingleInvoice" | "payMetaInvoice",
    amount: bigint,
    invoiceKey: Address,
    paymentToken: Address
  ) => Promise<boolean>;
  getInvoiceOwner: (id: string) => Promise<string>;
  sellerAction: (invoiceKey: Address, state: boolean) => Promise<boolean>;
  cancelInvoice: (invoiceKey: Address) => Promise<boolean>;
  releaseInvoice: (invoiceKey: Address) => Promise<boolean>;
  refundBuyerAfterWindow: (invoiceKey: Address) => Promise<boolean>;
  setMinimumInvoiceValue: (newValue: bigint) => Promise<boolean>;
  setFeeReceiversAddress: (address: Address) => Promise<boolean>;
  transferOwnership: (address: Address) => Promise<boolean>;
  setInvoiceHoldPeriod: (
    invoiceKey: Address,
    holdPeriod: number
  ) => Promise<boolean>;
  setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) => Promise<boolean>;
  setFee: (newFee: bigint) => Promise<boolean>;
  getAdvancedInvoiceData: (
    invoiceKey: Address,
    query: string,
    type: "smartInvoice" | "metaInvoice"
  ) => Promise<any>;
  resolveDispute: (orderId: Address) => Promise<boolean>;
  acceptMarketplaceInvoice: (orderId: Address) => Promise<boolean>;
  cancelMarketplaceInvoice: (orderId: Address) => Promise<boolean>;
  requestCancelation: (orderId: Address) => Promise<boolean>;
  handleCancelationRequest: (
    orderId: Address,
    accept: boolean
  ) => Promise<boolean>;
  createDispute: (orderId: Address) => Promise<boolean>;
  claimExpiredInvoiceRefunds: (orderId: Address) => Promise<boolean>;
  refetchInvoiceData?: () => Promise<void>;
  refetchAllInvoiceData?: () => Promise<void>;
}

export const contractContextDefaults: ContractContextData = {
  isLoading: undefined,
  invoiceData: [],
  allInvoiceData: {
    invoices: [],
    actions: [],
  },
  transferOwnership: async () => Promise.resolve(false),
  createInvoice: async () => Promise.resolve("0x"),
  makeInvoicePayment: async () => Promise.resolve(false),
  payAdvancedInvoice: async () => Promise.resolve(false),
  sellerAction: async () => Promise.resolve(false),
  cancelInvoice: async () => Promise.resolve(false),
  releaseInvoice: async () => Promise.resolve(false),
  refundBuyerAfterWindow: async () => Promise.resolve(false),
  setFeeReceiversAddress: async () => Promise.resolve(false),
  setInvoiceHoldPeriod: async () => Promise.resolve(false),
  setDefaultHoldPeriod: async () => Promise.resolve(false),
  setFee: async () => Promise.resolve(false),
  setMinimumInvoiceValue: async () => Promise.resolve(false),
  refetchInvoiceData: async () => Promise.resolve(),
  refetchAllInvoiceData: async () => Promise.resolve(),
  getInvoiceOwner: async () => Promise.resolve(""),
  getAdvancedInvoiceData: async () => Promise.resolve(""),
  resolveDispute: async () => Promise.resolve(false),
  acceptMarketplaceInvoice: async () => Promise.resolve(false),
  cancelMarketplaceInvoice: async () => Promise.resolve(false),
  requestCancelation: async () => Promise.resolve(false),
  handleCancelationRequest: async () => Promise.resolve(false),
  createDispute: async () => Promise.resolve(false),
  claimExpiredInvoiceRefunds: () => Promise.resolve(false),
};

export const ContractContext = React.createContext<ContractContextData>(
  contractContextDefaults
);
