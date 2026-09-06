import type { Address, Hex } from "viem";

// Ephemeral public keys for an invoice's one-time stealth fee receivers.
//
// Deriving them spends gas: the contract API upgrades each address to a 7702
// delegator and approves the sweeper on it. The call hands back only these
// keys, never the addresses, and the addresses cannot be recovered any other
// way - so losing a key strands the gas that paid for it. They are written
// here the moment they arrive, before anything else is attempted.
//
// A meta-invoice needs one receiver per sub-invoice, in `subInvoiceIds` order.
// A single invoice is an array of one.

// v2 and earlier stored derived addresses and a cached signature, which the
// API no longer returns at this stage; the bump makes those unreadable rather
// than misread.
const STORE_VERSION = 3;
const STORE_KEY = `fee-receivers:v${STORE_VERSION}`;
// A week. Longer than the old entries because these represent spent gas: an
// abandoned invoice resumed a few days later should reuse its receivers rather
// than pay to derive another set.
const ENTRY_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export type ProcessorKind = "simple" | "intermediated";

/**
 * Which authorization the processor verifies. A meta-invoice holding one
 * sub-invoice still needs the array form, so this is carried explicitly rather
 * than inferred from the key count.
 */
export type InvoiceKind = "single" | "meta";

export type StoredFeeReceivers = {
  /** In sub-invoice order. Public by design - EIP-5564 announces them. */
  ephemeralPublicKeys: Hex[];
  // The token the sweeper approval was granted for. Paying in a different one
  // needs its own approval, which means deriving a fresh set.
  paymentToken: Address;
  kind: InvoiceKind;
  updatedAt: number;
};

/** Identifies the invoice the receivers were issued for. */
export type FeeReceiverRef = {
  invoiceId: bigint;
  chainId: number;
  processor: ProcessorKind;
};

type FeeReceiverStore = Record<string, StoredFeeReceivers>;

// The authorization binds (processor, chain, invoice), so an entry is only
// reusable for the same triple.
const entryKey = ({ chainId, processor, invoiceId }: FeeReceiverRef): string =>
  `${chainId}:${processor}:${invoiceId.toString()}`;

const isUsable = (entry: StoredFeeReceivers | undefined): boolean =>
  Boolean(
    entry &&
      Array.isArray(entry.ephemeralPublicKeys) &&
      entry.ephemeralPublicKeys.length > 0 &&
      entry.ephemeralPublicKeys.every(
        (key) => typeof key === "string" && key.startsWith("0x"),
      ) &&
      entry.paymentToken &&
      (entry.kind === "single" || entry.kind === "meta") &&
      Date.now() - entry.updatedAt < ENTRY_TTL_MS,
  );

const readStore = (): FeeReceiverStore => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FeeReceiverStore;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, entry]) => isUsable(entry)),
    );
  } catch {
    return {};
  }
};

const writeStore = (store: FeeReceiverStore) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    // Storage blocked. The keys are lost and the gas with them, but failing
    // the payment here would strand them just the same.
  }
};

/** The keys already issued for this invoice, if still usable. */
export const readFeeReceiver = (
  ref: FeeReceiverRef,
): StoredFeeReceivers | null => readStore()[entryKey(ref)] ?? null;

/** Persists the entry and returns it, so callers can carry it forward. */
export const saveFeeReceiver = (
  ref: FeeReceiverRef,
  receivers: Omit<StoredFeeReceivers, "updatedAt">,
): StoredFeeReceivers => {
  const stored: StoredFeeReceivers = { ...receivers, updatedAt: Date.now() };
  const store = readStore();
  store[entryKey(ref)] = stored;
  writeStore(store);
  return stored;
};

/** Called once the payment/accept that consumed the receivers has settled. */
export const clearFeeReceiver = (ref: FeeReceiverRef) => {
  const store = readStore();
  const key = entryKey(ref);
  if (!(key in store)) return;
  delete store[key];
  writeStore(store);
};
