import { ErrorMessages } from "./model/model";
import type { Address } from "viem";
import { baseSepolia } from "viem/chains";

export const POLYGON = 137;
export const POLYGON_AMOY = 80_002;
export const BASE_SEPOLIA = baseSepolia.id;

export const PAYMENT_PROCESSOR_STORAGE: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x7542F386a40FE663121719BC7ac59664a8530C38",
};

export const SIMPLE_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x5214B494598c706a482A36Dc6fece2FdafF3390d",
};

export const ADVANCED_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x96AB8111B8C9eC5f7ec99c398e83F57BDC47b40E",
};

export const NOTES_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x3252Ee213AF17C4d752Aec009AdBA83B93229b31",
};

export const NOTES_SIGNER_ADDRESS =
  process.env.NEXT_PUBLIC_NOTES_SIGNER_ADDRESS;

export const THE_GRAPH_API_URL: Record<number, string> = {
  [BASE_SEPOLIA]:
    "https://api.studio.thegraph.com/query/100227/processor-indexer/version/latest",
};

export const errorMessages: ErrorMessages = {
  // SimplePaymentProcessor errors
  "0x5033f274":
    "ValueIsTooLow: The provided value is below the required minimum.",
  "0x2b8af0bb":
    "AcceptanceWindowExceeded: Action attempted after the acceptance window has expired.",
  "0x6b22feb9":
    "DuplicateTask: A duplicate automation task already exists for this invoice.",
  "0xad2652ac":
    "HoldPeriodHasNotBeenExceeded: The hold period has not yet elapsed.",
  "0x47af6acc":
    "IncorrectPaymentAmount: The payment amount does not match the required invoice price.",
  "0x39141cc3": "InvalidDecisionWindow: The decision window value is invalid.",
  "0x76f4a283": "InvalidHeapPosition: Internal heap position is invalid.",
  "0x1d5b1556":
    "InvalidInvoiceState: The invoice is in an invalid state for this action.",
  "0x074bc935": "InvoiceAlreadyExists: An invoice with this ID already exists.",
  "0xff42dbfc":
    "InvoiceIsNoLongerValid: The invoice is no longer valid (canceled or expired).",
  "0xbb126ff1":
    "InvoiceNotEligibleForRefund: This invoice is not eligible for a refund.",
  "0xea8e4eb5":
    "NotAuthorized: The caller is not authorized to perform this action.",
  "0x020175b1":
    "SellerCannotPayOwnedInvoice: The seller cannot pay their own invoice.",
  "0xc325ae33": "TaskNotFound: No automation task found for this invoice.",
  // AdvancedPaymentProcessor errors
  "0xb12e2421":
    "BuyerCannotBeSeller: The buyer and seller cannot be the same address.",
  "0x815ba404":
    "EmptyMetaInvoice: A meta invoice must contain at least one item.",
  "0xf4d678b8":
    "InsufficientBalance: Insufficient balance to complete this operation.",
  "0x34819f90":
    "InvalidDisputeResolution: The dispute resolution parameters are invalid.",
  "0x487e4409":
    "InvalidInvoiceState: The invoice is in an invalid state for this action.",
  "0xc7632c7d":
    "InvalidMetaInvoicePaymentAmount: The payment amount for this meta invoice is incorrect.",
  "0x214510aa": "InvalidNativePayment: Invalid native token payment.",
  "0x00bfc921": "InvalidPrice: The price provided is invalid.",
  "0x453fb42d":
    "InvalidSellersPayoutShare: The seller's payout share is invalid.",
  "0x715d9228": "InvoiceDoesNotExist: No invoice exists with this ID.",
  "0xf04e9cf0": "InvoiceExpired: The invoice has expired.",
  "0xb09960c1":
    "MetaInvoiceAlreadyExists: A meta invoice with this ID already exists.",
  "0x2c669f0a": "PriceCannotBeZero: The price must be greater than zero.",
  "0xdb8db569": "PriceIsTooLow: The price is below the allowed minimum.",
  "0xab143c06": "Reentrancy: Reentrant call detected.",
  "0x032b3d00": "SequencerDown: The L2 sequencer is currently unavailable.",
  "0x19abf40e": "StalePrice: The price feed data is stale.",
  "0x1087e109":
    "StalePriceFeed: The price feed has not been updated recently enough.",
  "0x6a172882": "UnsupportedToken: This payment token is not supported.",
  // Escrow errors
  "0x82b42900":
    "Unauthorized: An unauthorized address attempted a restricted action.",
};
