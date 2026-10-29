import type { ErrorMessages, TokenData } from "./model/model";
import type { Address } from "viem";
import { baseSepolia, hardhat } from "viem/chains";

export const BASE_SEPOLIA = baseSepolia.id;
export const LOCALHOST = hardhat.id;
export const ONE_SECOND_MS = 1_000;
export const ONE_DAY_MS = 24 * 60 * 60 * ONE_SECOND_MS;
export const DEFAULT_QUERY_STALE_TIME_MS = 15 * ONE_SECOND_MS;
export const DEFAULT_QUERY_GC_TIME_MS = ONE_DAY_MS;
// How long a payment page shows one price quote before refreshing it.
export const RATE_WINDOW_MS = 30 * ONE_SECOND_MS;

// Mirrors the simple processor's MINIMUM_INVOICE_VALUE, which has no getter.
export const MINIMUM_INVOICE_VALUE = BigInt("5000000000000000");

export const MAX_NOTE_LENGTH = 20;
export const DEFAULT_BLOCK_POLLING_INTERVAL_MS = 12 * ONE_SECOND_MS;

/**
 * `next build` always sets NODE_ENV=production, so an exported
 * build needs NEXT_PUBLIC_LOCAL_CHAIN=true to keep the local chain.
 */
export const LOCAL_CHAIN_ENABLED =
  process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true" ||
  process.env.NODE_ENV !== "production";

// The local API runs beside the dev server, so a phone that loaded
// the app by network address reaches it at that same host.
const LOCAL_API_HOST =
  typeof window === "undefined" ? "localhost" : window.location.hostname;

export const CONTRACT_API_URL = (
  process.env.NEXT_PUBLIC_CONTRACT_API_URL ||
  (LOCAL_CHAIN_ENABLED
    ? `http://${LOCAL_API_HOST}:8080`
    : "https://sapphiredaotesting.com")
).replace(/\/+$/, "");

// The fee-receiver sidecar's per-call limit.
export const MAX_FEE_RECEIVERS = 5;

export const PAYMENT_PROCESSOR_STORAGE: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x58422C5A8959502a2304b2AfF97dAebF30262CA6",
  [LOCALHOST]: "0x9209Fb3710015c3b4c780cef605322457c7C863c",
};

export const SIMPLE_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xbCd3f9AB4e0b09044053102A353C0B710106e08a",
  [LOCALHOST]: "0x75c0f4a0aF42101E64B493B71cEFEbC359B90F25",
};

export const INTERMEDIATED_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x72AD25c3AED936120842B4b2dBcD28744bb412Ed",
  [LOCALHOST]: "0xcDEf5a4084d380CAbf0AD88421843dCb1b1a1298",
};

export const MULTISIG_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xf2EDEf709357e6587DC9600B58A34DA3d54369d1",
  [LOCALHOST]: "0xEE79d9E7EDBEf7c927A6A58EBc2a3b4c927C1384",
};

/** MultiSig.sol's MINIMUM_THRESHOLD. */
export const CONTRACT_MINIMUM_THRESHOLD = 2;

export const NOTES_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x934fa7109ff129Cb70997B6be330401fa5946671",
  [LOCALHOST]: "0xce270FA8D222300a2148477f924669d4b3a0523e",
};

export const MOCK_USDC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x9652aF270a39E8F63Fa801F6293DEb944FdEB5B9",
  [LOCALHOST]: "0x2d19afC50EaaCe1CE730ab2A9a5D87712b0d4bCc",
};

// Must match the processors' `weth()`.
export const WETH_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x4200000000000000000000000000000000000006",
  [LOCALHOST]: "0x4a1E2AB38b64a82ef43fe3fD5921E915BfA4920c",
};

export const SWEEPER_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xCa65Bbd11988Efe078fe98D127cab5145D5050BB",
  [LOCALHOST]: "0x0E078853ef04266c5d09F9cD21DFA761134B13f6",
};

export const MOCK_WBTC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xc3a9d881A859EC02433eb0b6FaDC79F5678627b9",
  [LOCALHOST]: "0xda21fE4Acf85E375bC9eE72C9b00D0aEF6C495C7",
};

export const ZERO_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000";

// The subgraph's PaymentToken entity isn't reliable
// yet, so KNOWN_PAYMENT_TOKENS is the source of truth.
export const ENABLE_SUBGRAPH_PAYMENT_TOKENS = false;

export const KNOWN_PAYMENT_TOKENS: Record<number, TokenData[]> = {
  [BASE_SEPOLIA]: [
    {
      id: MOCK_USDC_CONTRACT[BASE_SEPOLIA],
      name: "mUSDC",
      decimals: 6,
    },
    {
      id: MOCK_WBTC_CONTRACT[BASE_SEPOLIA],
      name: "wBTC",
      decimals: 8,
    },
    {
      id: ZERO_ADDRESS,
      name: "ETH",
      decimals: 18,
    },
  ],
  [LOCALHOST]: [
    {
      id: MOCK_USDC_CONTRACT[LOCALHOST],
      name: "mUSDC",
      decimals: 6,
    },
    {
      id: MOCK_WBTC_CONTRACT[LOCALHOST],
      name: "wBTC",
      decimals: 8,
    },
    {
      id: ZERO_ADDRESS,
      name: "ETH",
      decimals: 18,
    },
  ],
};

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

export const NOTES_SIGNER_ADDRESS =
  process.env.NEXT_PUBLIC_NOTES_SIGNER_ADDRESS;

export const THE_GRAPH_API_URL: Record<number, string> = {
  // Pinned rather than `/version/latest`, so a subgraph
  // publish can't change what the app queries.
  [BASE_SEPOLIA]:
    process.env.NEXT_PUBLIC_THE_GRAPH_API_URL ??
    "https://api.studio.thegraph.com/query/100227/payment-processor-indexer/version/latest",
  [LOCALHOST]:
    process.env.NEXT_PUBLIC_LOCAL_SUBGRAPH_URL ??
    "http://localhost:8000/subgraphs/name/payment-processor-indexer",
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
  "0x1735eabe":
    "InvalidFeeAuthorization: The fee receiver was not authorized by the fee signer.",
  "0xd200485c": "InvalidFeeReceiver: The fee receiver address is invalid.",
  "0xecb8b30d":
    "UnexpectedNativeTransfer: The contract received native currency outside a fee wrap.",
  "0x705a7153":
    "HoldPeriodCanNotBeZero: The hold period must be greater than zero.",
  "0x20d80102": "InvalidFeeSigner: The fee signer address is invalid.",
  // IntermediatedPaymentProcessor errors
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
