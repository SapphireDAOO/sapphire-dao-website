export type AllInvoice = {
  id: string;
  invoiceId: bigint;
  contract: string;
  seller: string;
  createdAt: string;
  payment: string;
  paidAt: string;
  by: string;
  state?: string;
  release: string;
  fee: string;
  releaseHash: string;
  status: string;
  creationTxHash: string;
  commisionTxHash: string;
  refundTxHash?: string;
};

export type AdminAction = {
  id: string;
  invoiceId: bigint;
  action: string;
  time: string | null;
  type: "Single Invoice" | "Meta Invoice";
  txHash: string;
  balance: string;
};

export type AllInvoicesData = {
  invoices: AllInvoice[];
  actions: AdminAction[];
  marketplaceInvoices: AllInvoice[];
};
