/* eslint-disable @typescript-eslint/no-explicit-any */
import { Invoice, AllInvoice, AdminAction } from "@/model/model";
import React from "react";
import type { Address } from "viem";

export type InvoiceEventTab = "simple" | "intermediated";

export interface ContractActions {
  createInvoice: (
    invoicePrice: bigint,
    storageRef?: string,
    share?: boolean,
    holdPeriodSeconds?: number
  ) => Promise<bigint | undefined>;
  makeInvoicePayment: (
    amount: bigint,
    invoiceId: bigint,
    storageRef?: string,
    share?: boolean,
    onSubmitted?: (hash: `0x${string}`) => void
  ) => Promise<boolean>;
  payIntermediatedInvoice: (
    paymentType: "paySingleInvoice" | "payMetaInvoice",
    amount: bigint,
    invoiceId: bigint,
    paymentToken: Address,
    onSubmitted?: (hash: `0x${string}`) => void
  ) => Promise<boolean>;
  getInvoiceOwner: (id: string) => Promise<string>;
  sellerAction: (invoiceId: bigint, state: boolean) => Promise<boolean>;
  cancelInvoice: (invoiceId: bigint) => Promise<boolean>;
  releaseInvoice: (invoiceId: bigint) => Promise<boolean>;
  refundBuyerAfterWindow: (invoiceId: bigint) => Promise<boolean>;
  getIntermediatedInvoiceData: (
    invoiceId: bigint,
    type: "smartInvoice" | "metaInvoice"
  ) => Promise<any>;
  setIntermediatedOperator: (intermediatedOperatorAddress: Address) => Promise<any>;
  refreshAdminData?: (force?: boolean) => Promise<void>;
  upsertLocalInvoice?: (invoice: Invoice) => void;
  watchInvoiceEvents?: (tab: InvoiceEventTab) => () => void;
  /**
   * Rides on the simple feed, so the caller
   * must also hold `watchInvoiceEvents`.
   */
  watchInvoiceStatus?: (
    invoiceId: bigint,
    listener: (status: Invoice["status"]) => void
  ) => () => void;
  trackInvoices?: (invoices: Invoice[]) => () => void;
}

export interface InvoiceState {
  invoiceData: Invoice[];
  liveInvoiceData: Invoice[];
  allInvoiceData: {
    invoices: AllInvoice[];
    actions: AdminAction[];
    intermediatedInvoices: AllInvoice[];
  };
}

export const contractActionsDefaults: ContractActions = {
  createInvoice: async () => Promise.resolve(BigInt(0)),
  makeInvoicePayment: async () => Promise.resolve(false),
  payIntermediatedInvoice: async () => Promise.resolve(false),
  sellerAction: async () => Promise.resolve(false),
  cancelInvoice: async () => Promise.resolve(false),
  releaseInvoice: async () => Promise.resolve(false),
  refundBuyerAfterWindow: async () => Promise.resolve(false),
  setIntermediatedOperator: async () => Promise.resolve(""),
  refreshAdminData: async () => Promise.resolve(),
  upsertLocalInvoice: () => {},
  getInvoiceOwner: async () => Promise.resolve(""),
  getIntermediatedInvoiceData: async () => Promise.resolve(""),
  watchInvoiceEvents: () => () => {},
  watchInvoiceStatus: () => () => {},
  trackInvoices: () => () => {},
};

export const invoiceStateDefaults: InvoiceState = {
  invoiceData: [],
  liveInvoiceData: [],
  allInvoiceData: {
    invoices: [],
    actions: [],
    intermediatedInvoices: [],
  },
};

export const ContractActionsContext = React.createContext<ContractActions>(
  contractActionsDefaults
);

export const ContractLoadingContext = React.createContext<string | undefined>(
  undefined
);

export const InvoiceStateContext = React.createContext<InvoiceState>(
  invoiceStateDefaults
);
