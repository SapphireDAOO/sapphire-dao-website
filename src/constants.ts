import type { ErrorMessages, TokenData } from "./model/model";
import type { Address } from "viem";
import { baseSepolia, hardhat } from "viem/chains";

// remove unused chains
export const BASE_SEPOLIA = baseSepolia.id;
// Local Hardhat/Anvil node (http://127.0.0.1:8545)
export const LOCALHOST = hardhat.id;
export const ONE_SECOND_MS = 1_000;
export const ONE_DAY_MS = 24 * 60 * 60 * ONE_SECOND_MS;
export const DEFAULT_QUERY_STALE_TIME_MS = 15 * ONE_SECOND_MS;
export const DEFAULT_QUERY_GC_TIME_MS = ONE_DAY_MS;

// Every invoice is escrowed for the same fixed window. Sellers do not choose
// it: a per-invoice hold is a term the payer cannot see until the link is
// opened, and one a seller could quietly set to zero.
export const DEFAULT_HOLD_PERIOD_SECONDS = 5 * 60;

export const MAX_NOTE_LENGTH = 20;
export const DEFAULT_BLOCK_POLLING_INTERVAL_MS = 12 * ONE_SECOND_MS;

/**
 * Whether this build should offer the local chain and the local contract API.
 *
 * `next build` sets NODE_ENV=production for every build, including a static
 * export that is only ever served from a laptop - so keying off NODE_ENV alone
 * silently drops the local chain from any exported build. Set
 * NEXT_PUBLIC_LOCAL_CHAIN=true at build time to keep it.
 */
export const LOCAL_CHAIN_ENABLED =
  process.env.NEXT_PUBLIC_LOCAL_CHAIN === "true" ||
  process.env.NODE_ENV !== "production";

// The contract API derives and approves the stealth fee receivers, and signs
// the authorization the processors verify. Override either with
// NEXT_PUBLIC_CONTRACT_API_URL.
export const CONTRACT_API_URL = (
  process.env.NEXT_PUBLIC_CONTRACT_API_URL ||
  (LOCAL_CHAIN_ENABLED
    ? "http://localhost:8080"
    : "https://sapphiredaotesting.com")
).replace(/\/+$/, "");

// The fee-receiver sidecar derives at most this many receivers per call, so a
// meta invoice with more sub-invoices than this cannot be paid in one go.
export const MAX_FEE_RECEIVERS = 5;

export const PAYMENT_PROCESSOR_STORAGE: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xa5a8d53D9138D17F6C94c56846D50a850aFd14c9",
  [LOCALHOST]: "0x9209Fb3710015c3b4c780cef605322457c7C863c",
};

export const SIMPLE_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x0741D5d919900c216Db4184e2cA0aaE6f88f21C3",
  [LOCALHOST]: "0x75c0f4a0aF42101E64B493B71cEFEbC359B90F25",
};

export const INTERMEDIATED_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x5ea98074A1779E1242feefB6df54C6c0a4b16423",
  [LOCALHOST]: "0xcDEf5a4084d380CAbf0AD88421843dCb1b1a1298",
};

export const MULTISIG_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x2AEFE8BDd278fCF4b010111d7aDD8ab50d859419",
  [LOCALHOST]: "0xEE79d9E7EDBEf7c927A6A58EBc2a3b4c927C1384",
};

/**
 * MultiSig.sol's own floor (MINIMUM_THRESHOLD). The contract will not accept a
 * threshold below this even when the signer set is small enough for a majority
 * to be lower.
 */
export const CONTRACT_MINIMUM_THRESHOLD = 2;

export const NOTES_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xE818dA06Ceed4Ac6c6d4871a5Fc0226B8032834e",
  [LOCALHOST]: "0xce270FA8D222300a2148477f924669d4b3a0523e",
};

export const MOCK_USDC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x9652aF270a39E8F63Fa801F6293DEb944FdEB5B9",
  [LOCALHOST]: "0x2d19afC50EaaCe1CE730ab2A9a5D87712b0d4bCc",
};

// Wrapped native token used for fee approvals on native payments. Must match
// the WETH the payment processors were constructed with (`weth()`); verified
// against the deployed Base Sepolia processor.
export const WETH_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x4200000000000000000000000000000000000006",
  [LOCALHOST]: "0x4a1E2AB38b64a82ef43fe3fD5921E915BfA4920c",
};

// Pulls fee tokens out of stealth fee receivers via `transferFrom`; each
// stealth account grants it a max approval when it is created.
export const SWEEPER_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x23F53C2422AF06eb1B98f4B78f11F583a2435F5D",
  [LOCALHOST]: "0x0E078853ef04266c5d09F9cD21DFA761134B13f6",
};

export const MOCK_WBTC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xc3a9d881A859EC02433eb0b6FaDC79F5678627b9",
  [LOCALHOST]: "0xda21fE4Acf85E375bC9eE72C9b00D0aEF6C495C7",
};

export const ZERO_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000";

// Feature flag: the subgraph PaymentToken entity is not reliably available yet,
// so we use a hardcoded list as the source of truth. Flip to `true` once the
// subgraph is ready and the hook will fall back to querying it for unknown tokens.
export const ENABLE_SUBGRAPH_PAYMENT_TOKENS = false;

// Hardcoded source of truth while ENABLE_SUBGRAPH_PAYMENT_TOKENS is false.
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
    "https://api.studio.thegraph.com/query/100227/payment-processor-indexer/version/latest",
  [LOCALHOST]: "http://localhost:8000/subgraphs/name/payment-processor-indexer",
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
