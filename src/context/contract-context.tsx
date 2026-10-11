/* eslint-disable @typescript-eslint/no-explicit-any */
import { Invoice, AllInvoice, AdminAction } from "@/model/model";
import React from "react";
import type { Address } from "viem";

// React Contexts for managing and interacting with the payment processor
// contracts. Split three ways so a component only re-renders for what it
// reads: the actions are stable for as long as the wallet is, the loading flag
// flips only around a transaction, and the invoice data changes with every
// live event. One combined object re-rendered every card's buttons on each
// invoice update.

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
    share?: boolean
  ) => Promise<boolean>;
  payIntermediatedInvoice: (
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
  getIntermediatedInvoiceData: (
    invoiceId: bigint,
    type: "smartInvoice" | "metaInvoice"
  ) => Promise<any>;
  setIntermediatedOperator: (intermediatedOperatorAddress: Address) => Promise<any>;
  refreshAdminData?: (force?: boolean) => Promise<void>;
  upsertLocalInvoice?: (invoice: Invoice) => void;
  /**
   * Opens the live invoice event subscription for one processor until the
   * returned function is called. Only pages that render invoices from it
   * should hold one.
   */
  watchInvoiceEvents?: (tab: InvoiceEventTab) => () => void;
  /**
   * Calls `listener` with each status change of one simple-processor invoice,
   * whoever it belongs to, until the returned function is called. Rides on
   * the simple feed, so the caller must also hold `watchInvoiceEvents`.
   */
  watchInvoiceStatus?: (
    invoiceId: bigint,
    listener: (status: Invoice["status"]) => void
  ) => () => void;
  /**
   * Registers invoices shown on screen that are not in `invoiceData`, so a
   * live event about one of them updates it rather than being dropped as
   * someone else's. Returns the function that unregisters them.
   */
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

/** The in-flight action key (e.g. `sellerAction:<id>`), or undefined. */
export const ContractLoadingContext = React.createContext<string | undefined>(
  undefined
);

export const InvoiceStateContext = React.createContext<InvoiceState>(
  invoiceStateDefaults
);
