// Define the base Invoice type that represents an invoice's properties
export type Invoice = {
  releaseAt?: string | null;
  id: string;
  amountPaid?: string | null;
  createdAt?: string | null;
  paidAt?: string;
  releasedAt?: string;
  price?: string | null;
  status?: string;
  type?: "Payer" | "Creator";
  holdPeriod?: string | null;
  paymentTxHash?: string;
  releaseHash?: string;
  contract?: string;
  fee?: string;
  payer?: string;
  creator?: string;
};

export type AllInvoice = {
  id: string;
  contract: string;
  creator: string;
  createdAt: string;
  payment: string;
  paidAt:string
  by: string;
  state: string;
  release: string;
  fee: string;
  releaseHash: string;
  status: string
};

// Specialized invoice type for invoices created by the user
export interface UserCreatedInvoice extends Invoice {
  type?: "Creator"; // Specifies that the invoice type is "Creator"
}

// Specialized invoice type for invoices paid by the user
export interface UserPaidInvoice extends Invoice {
  type?: "Payer"; // Specifies that the invoice type is "Payer"
}

// Props for a Payment Card component, containing basic invoice details
export type PaymentCardProps = {
  data: {
    id: string; // Unique identifier for the invoice
    price: string; // Price associated with the invoice
    status: string; // Status of the invoice (e.g., "paid", "created", "unpaid")
  };
};

// Type for mapping error keys to corresponding error messages
export type ErrorMessages = {
  [key: string]: string; // A key-value pair where the key is the error key, and the value is the corresponding error message
};
