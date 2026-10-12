import type { Address } from "viem";
export type { AdminAction, AllInvoice, AllInvoicesData } from "./admin";

export type InvoiceType = {
  // Subgraph-shared fields
  id: string;
  invoiceNonce?: string;
  state?: string;
  createdAt?: string | null;
  paidAt?: string;
  releasedAt?: string;
  seller?: string;
  buyer?: string;
  price?: string | null;
  amountPaid?: string | null;
  releaseHash?: string;
  paymentTxHash?: string;
  fee?: string;
  contract?: string;
  creationTxHash?: string;
  commissionTxHash?: string;
  refundTxHash?: string;
  lastActionTime?: string;
  buyerNote?: string;
  sellerNote?: string;

  // UI-only fields
  invoiceId: bigint;
  status?: string;
  type?: "Seller" | "Buyer" | "IssuedInvoice" | "ReceivedInvoice";
  source?: string;
  holdPeriod?: string | null;
  releaseAt?: string | null;
  cancelAt?: string;
  note?: string;
  history?: History[];
};

export type Invoice = {
  releaseAt?: string | null;
  id: string;
  invoiceId: bigint;
  amountPaid?: string | null;
  createdAt?: string | null;
  paidAt?: string;
  releasedAt?: string;
  price?: string | null;
  status?: string;
  type?: "Seller" | "Buyer" | "IssuedInvoice" | "ReceivedInvoice";
  holdPeriod?: string | null;
  paymentTxHash?: string;
  releaseHash?: string;
  refundTxHash?: string;
  contract?: string;
  expiresAt?: string;
  sellerActionDeadline?: string;
  fee?: string;
  buyer?: string;
  seller?: string;
  source?: string;
  paymentToken?: string;
  cancelAt?: string;
  creationTxHash?: string;
  note?: string;
  history?: History[];
  buyerNote?: string;
  sellerNote?: string;
  sellerAmountReceivedAfterDispute?: string | null;
  buyerAmountReceivedAfterDispute?: string | null;
  amountReleased?: string | null;
  amountRefunded?: string | null;
  disputeSettledTxHash?: string;
};

export interface History {
  status: string;
  time: string;
}

export interface InvoiceCardProps {
  invoice: Invoice;
}

export interface UserCreatedInvoice extends Invoice {
  type?: "Seller";
  source?: "Simple";
}

export interface UserPaidInvoice extends Invoice {
  type?: "Buyer";
  source?: "Simple";
}

export interface UserIssuedInvoiceInvoice extends Invoice {
  type?: "IssuedInvoice";
  source?: "Intermediated";
}

export interface UserReceivedInvoicesInvoice extends Invoice {
  type?: "ReceivedInvoice";
  source?: "Intermediated";
}

export type PaymentCardProps = {
  data: {
    invoiceId: string | bigint;
  } | null;
};

export type ErrorMessages = {
  [key: string]: string;
};

export interface TokenData {
  name: string;
  id: string;
  decimals: number;
}

export interface InvoiceDetails {
  id?: string;
  invoiceId: bigint;
  price: string;
  paymentToken?: Address;
  tokenList: TokenData[];
  status?: string;
}

export interface SmartInvoice {
  id: string;
  invoiceId: string;
  price: string;
  paymentToken: string;
  amountPaid?: string;
  cancelAt?: string;
  contract?: string;
  createdAt?: string;
  escrow?: string;
  expiresAt?: string;
  paidAt?: string;
  releasedAt?: string;
  state?: string;
}

export interface MetaInvoice {
  id: string;
  invoiceId: string;
  price: string;
  contract?: string;
  paymentToken?: string;
}
