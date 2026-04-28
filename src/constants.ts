import type { ErrorMessages, TokenData } from "./model/model";
import type { Address } from "viem";
import { baseSepolia } from "viem/chains";

// remove unused chains
export const BASE_SEPOLIA = baseSepolia.id;
export const ONE_SECOND_MS = 1_000;
export const ONE_DAY_MS = 24 * 60 * 60 * ONE_SECOND_MS;
export const DEFAULT_QUERY_STALE_TIME_MS = 15 * ONE_SECOND_MS;
export const DEFAULT_QUERY_GC_TIME_MS = ONE_DAY_MS;
export const DEFAULT_BLOCK_POLLING_INTERVAL_MS = 12 * ONE_SECOND_MS;

export const PAYMENT_PROCESSOR_STORAGE: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x13676A686fA96408a70ACBDa6312b330D11Ce390",
};

export const SIMPLE_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xd70c10C73a716F85d97b5619dADfb6B1b6b6a706",
};

export const ADVANCED_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x792AF6DF4f32Ac3b8C2745dEE42f9e08090C0746",
};

export const MULTISIG_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x331798Ef8A2a46b6e6A5864ba7F03016b875F193",
};

export const NOTES_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x8391a68c01834d252C1dFf975A621e8F99020b65",
};

export const MOCK_USDC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x41A196b1fF165419A1320F029E689A41F30c70b0",
};

export const MOCK_WBTC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x8Cdaf12598d71cad44e91FB1c05d565a383e3dba",
};


// query should come from the subgraph
export const KNOWN_PAYMENT_TOKENS: Record<number, TokenData[]> = {
  [BASE_SEPOLIA]: [
    {
      id: MOCK_USDC_CONTRACT[BASE_SEPOLIA],
      name: "MockUsdc",
      decimals: 6,
    },
    {
      id: MOCK_WBTC_CONTRACT[BASE_SEPOLIA],
      name: "MockWbtc",
      decimals: 8,
    },
  ],
};

// this should be in utils
export const getKnownPaymentToken = (
  chainId: number,
  tokenId?: string | null,
): TokenData | null => {
  if (!tokenId) return null;

  return (
    KNOWN_PAYMENT_TOKENS[chainId]?.find(
      (token) => token.id.toLowerCase() === tokenId.toLowerCase(),
    ) ?? null
  );
};

// this should be in utils
export const mergeKnownPaymentTokens = (
  chainId: number,
  tokens: TokenData[] = [],
): TokenData[] => {
  const merged = new Map<string, TokenData>();

  for (const token of tokens) {
    if (!token?.id) continue;
    merged.set(token.id.toLowerCase(), token);
  }

  for (const token of KNOWN_PAYMENT_TOKENS[chainId] ?? []) {
    if (!token?.id) continue;
    const key = token.id.toLowerCase();
    if (!merged.has(key)) {
      merged.set(key, token);
    }
  }

  return [...merged.values()];
};

export const NOTES_SIGNER_ADDRESS =
  process.env.NEXT_PUBLIC_NOTES_SIGNER_ADDRESS;

export const THE_GRAPH_API_URL: Record<number, string> = {
  [BASE_SEPOLIA]:
    "https://api.studio.thegraph.com/query/100227/payment-processor/version/latest",
};

// review errors and seperate using contract address as key(maybe)
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
  "0xbab7ca35": "InvalidSeller: The seller address is invalid.",
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
  "0x667ecf9d":
    "EscrowWithdrawFailed: The escrow withdrawal could not be completed.",
  "0x82b42900":
    "Unauthorized: An unauthorized address attempted a restricted action.",
};
