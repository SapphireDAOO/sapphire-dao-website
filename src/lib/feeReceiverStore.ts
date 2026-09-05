import type { Address, Hex } from "viem";

// A one-time stealth fee receiver costs a relayer-sponsored delegation tx to
// set up, so the addresses issued for an invoice are remembered locally until
// the payment/accept that consumes them lands on-chain. Retrying after a
// rejected wallet signature, or after the approval step failed, then resumes on
// the same addresses instead of burning fresh ones on every attempt.
//
// A meta-invoice needs one receiver per sub-invoice, index-aligned with the
// meta-invoice's `subInvoiceIds`, so entries hold an array. A single invoice is
// simply an array of one.

// v1 stored a single receiver per entry rather than an array; the version bump
// makes those entries unreadable rather than misread.
const STORE_VERSION = 2;
const STORE_KEY = `fee-receivers:v${STORE_VERSION}`;
// One day. An entry only has to outlive a retry of the same accept/payment, so
// a short window keeps abandoned addresses from being replayed long after the
// invoice moved on.
const ENTRY_TTL_MS = 1000 * 60 * 60 * 24;

export type ProcessorKind = "simple" | "intermediated";

/**
 * Which FeeAuthorizationLib overload the processor verifies against. A
 * meta-invoice holding one sub-invoice still needs the array form, so this is
 * carried explicitly rather than inferred from the receiver count.
 */
export type InvoiceKind = "single" | "meta";

/**
 * `created` — the stealth addresses were derived but the Sweeper approvals have
 * not landed, so they must not be passed to the contract yet: fees sent there
 * would be unsweepable.
 * `approved` — the approvals landed; the addresses are safe to pass on-chain.
 */
export type FeeReceiverState = "created" | "approved";

export type StoredFeeReceiver = {
  /** Index-aligned with the invoice's sub-invoices; length 1 for a single. */
  feeReceivers: Address[];
  // Public by design — EIP-5564 announces them on-chain. They are what let the
  // server recompute the stealth keys, which are never persisted anywhere.
  ephemeralPublicKeys: Hex[];
  // The token the approvals were granted for; a later attempt paying in a
  // different token needs its own approvals on the same addresses.
  paymentToken: Address;
  kind: InvoiceKind;
  state: FeeReceiverState;
  // Set with `approved`: the fee signer's authorization over this
  // (invoice, receivers) pair. The processor verifies it on-chain, so
  // receivers edited into storage by hand cannot be spent without one.
  signature?: Hex;
  updatedAt: number;
};

/** Identifies the invoice a fee receiver was issued for. */
export type FeeReceiverRef = {
  invoiceId: bigint;
  chainId: number;
  processor: ProcessorKind;
};

type FeeReceiverStore = Record<string, StoredFeeReceiver>;

// The fee authorization binds (processor, chain, invoice), so an entry is only
// reusable for the same triple.
const entryKey = ({ chainId, processor, invoiceId }: FeeReceiverRef): string =>
  `${chainId}:${processor}:${invoiceId.toString()}`;

// An `approved` entry missing its signature is kept but treated as unfinished
// by callers, which re-run the approval rather than discarding the addresses.
const isUsable = (entry: StoredFeeReceiver | undefined): boolean =>
  Boolean(
    entry &&
      Array.isArray(entry.feeReceivers) &&
      Array.isArray(entry.ephemeralPublicKeys) &&
      entry.feeReceivers.length > 0 &&
      // A mismatch means an address can no longer be re-derived, which would
      // desync the array the signature covers.
      entry.feeReceivers.length === entry.ephemeralPublicKeys.length &&
      entry.paymentToken &&
      (entry.kind === "single" || entry.kind === "meta") &&
      (entry.state === "created" || entry.state === "approved") &&
      Date.now() - entry.updatedAt < ENTRY_TTL_MS,
  );

const readStore = (): FeeReceiverStore => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as FeeReceiverStore;
    if (!parsed || typeof parsed !== "object") return {};

    // Drop expired entries on the way through so abandoned invoices do not
    // grow the store forever.
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
    // ignore storage errors
  }
};

/** The fee receivers already issued for this invoice, if still usable. */
export const readFeeReceiver = (
  ref: FeeReceiverRef,
): StoredFeeReceiver | null => readStore()[entryKey(ref)] ?? null;

/** Persists the entry and returns it, so callers can carry it forward. */
export const saveFeeReceiver = (
  ref: FeeReceiverRef,
  receiver: Omit<StoredFeeReceiver, "updatedAt">,
): StoredFeeReceiver => {
  const stored: StoredFeeReceiver = { ...receiver, updatedAt: Date.now() };
  const store = readStore();
  store[entryKey(ref)] = stored;
  writeStore(store);
  return stored;
};

/** Called once the payment/accept that consumed the addresses has settled. */
export const clearFeeReceiver = (ref: FeeReceiverRef) => {
  const store = readStore();
  const key = entryKey(ref);
  if (!(key in store)) return;
  delete store[key];
  writeStore(store);
};
