import { Invoice, AllInvoice } from "@/model/model";
import React from "react";
import { Address } from "viem";

// This code defines a React Context for managing and interacting with the PaymentProcessor contract,
// providing default values and a structure for contract-related operations within the application.

export interface ContractContextData {
  isLoading: string | undefined;
  invoiceData: Invoice[];
  allInvoiceData: AllInvoice[];
  createInvoice: (invoicePrice: bigint) => Promise<number>;
  makeInvoicePayment: (amount: bigint, invoiceId: bigint) => Promise<boolean>;
  getInvoiceOwner: (id: string) => Promise<string>;
  creatorsAction: (invoiceId: bigint, state: boolean) => Promise<boolean>;
  cancelInvoice: (invoiceId: bigint) => Promise<boolean>;
  releaseInvoice: (invoiceId: bigint) => Promise<boolean>;
  refundPayerAfterWindow: (invoiceId: bigint) => Promise<boolean>;
  setMinimumInvoiceValue: (newValue: bigint) => Promise<boolean>;
  setFeeReceiversAddress: (address: Address) => Promise<boolean>;
  transferOwnership: (address: Address) => Promise<boolean>;
  setInvoiceHoldPeriod: (
    invoiceId: bigint,
    holdPeriod: number
  ) => Promise<boolean>;
  setDefaultHoldPeriod: (newDefaultHoldPeriod: bigint) => Promise<boolean>;
  setFee: (newFee: bigint) => Promise<boolean>;
  refetchInvoiceData?: () => Promise<void>;
  refetchAllInvoiceData?: () => Promise<void>;
}

export const contractContextDefaults: ContractContextData = {
  isLoading: undefined,
  invoiceData: [],
  allInvoiceData: [],
  transferOwnership: async () => Promise.resolve(false),
  createInvoice: async () => Promise.resolve(0),
  makeInvoicePayment: async () => Promise.resolve(false),
  creatorsAction: async () => Promise.resolve(false),
  cancelInvoice: async () => Promise.resolve(false),
  releaseInvoice: async () => Promise.resolve(false),
  refundPayerAfterWindow: async () => Promise.resolve(false),
  setFeeReceiversAddress: async () => Promise.resolve(false),
  setInvoiceHoldPeriod: async () => Promise.resolve(false),
  setDefaultHoldPeriod: async () => Promise.resolve(false),
  setFee: async () => Promise.resolve(false),
  setMinimumInvoiceValue: async () => Promise.resolve(false),
  refetchInvoiceData: async () => Promise.resolve(),
  refetchAllInvoiceData: async () => Promise.resolve(),
  getInvoiceOwner: () => Promise.resolve(""),
};
export const ContractContext = React.createContext<ContractContextData>(
  contractContextDefaults
);
