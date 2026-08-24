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
export const DEFAULT_BLOCK_POLLING_INTERVAL_MS = 12 * ONE_SECOND_MS;

export const PAYMENT_PROCESSOR_STORAGE: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x74b1301b8a1DBdF0318bC81dD8c1b1375d0BF9AF",
  [LOCALHOST]: "0x92D4ABA7F268Fc8E43f22d521c836bd4696a564D",
};

export const SIMPLE_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xC785B7f52F591BF0ce80beE45B09e1cf0A972957",
  [LOCALHOST]: "0x3eFd0810C07232Bc4B52c1A812AfB8b4747090A1",
};

export const INTERMEDIATED_PAYMENT_PROCESSOR: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x0EecA9DE862fDFF9147aa1c55f186BB3881478E7",
  [LOCALHOST]: "0x60097C87D117639dE03D8871496A61d530030BA3",
};

export const MULTISIG_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xA42498b1a91cB61B5303Ec0432f27b87B8255B4e",
  [LOCALHOST]: "0xA4191f3b63b758e54F9dA05f651e54343D6e0651",
};

export const NOTES_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x38844FD5258943F0Af0db706CeC75a9233140087",
  [LOCALHOST]: "0xaaC13d0c17962f488daceD051AEd81F8646436f7",
};

export const MOCK_USDC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x9652aF270a39E8F63Fa801F6293DEb944FdEB5B9",
  [LOCALHOST]: "0x30f8a7DDde66968ab043d65B6f82C1CD10C0465F",
};

// Wrapped native token used for fee approvals on native payments. Must match
// the WETH the payment processors were constructed with (`weth()`).
// TODO: replace the Base Sepolia placeholder once the new contracts deploy.
export const WETH_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0x4200000000000000000000000000000000000006",
  [LOCALHOST]: "0x4a1E2AB38b64a82ef43fe3fD5921E915BfA4920c",
};

// Pulls fee tokens out of stealth fee receivers via `transferFrom`; each
// stealth account grants it a max approval when it is created.
// TODO: replace the Base Sepolia placeholder once the new contracts deploy.
export const SWEEPER_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xE72290e8628Cf2B6B8c321F6c688EF02332230be",
  [LOCALHOST]: "0x42fd5c29E76a40E52bD036dB2362BB6c288C7F8A",
};

export const MOCK_WBTC_CONTRACT: Record<number, Address> = {
  [BASE_SEPOLIA]: "0xc3a9d881A859EC02433eb0b6FaDC79F5678627b9",
  [LOCALHOST]: "0x9Ddb55dd822fD7A2f5E47F7560e93EFFb5ac6289",
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
