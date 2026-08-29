import type { Address, Hex } from "viem";

// A one-time stealth fee receiver costs a relayer-sponsored delegation tx to
// set up, so the address issued for an invoice is remembered locally until the
// payment/accept that consumes it lands on-chain. Retrying after a rejected
// wallet signature — or after the approval step failed — then resumes on the
// same address instead of burning a fresh one on every attempt.

const STORE_VERSION = 1;
const STORE_KEY = `fee-receivers:v${STORE_VERSION}`;
// One day. An entry only has to outlive a retry of the same accept/payment, so
// a short window keeps an abandoned address from being replayed long after the
// invoice moved on.
const ENTRY_TTL_MS = 1000 * 60 * 60 * 24;

export type ProcessorKind = "simple" | "intermediated";

/**
 * `created` — the stealth address was derived but the Sweeper approval has not
 * landed, so it must not be passed to the contract yet: fees sent there would
 * be unsweepable.
 * `approved` — the approval landed; the address is safe to pass on-chain.
 */
export type FeeReceiverState = "created" | "approved";

export type StoredFeeReceiver = {
  feeReceiver: Address;
  // Public by design — EIP-5564 announces it on-chain. It is what lets the
  // server recompute the stealth key, which is never persisted anywhere.
  ephemeralPublicKey: Hex;
  // The token the approval was granted for; a later attempt paying in a
  // different token needs its own approval on the same address.
  paymentToken: Address;
  state: FeeReceiverState;
  // Set with `approved`: the fee signer's authorization over this
  // (invoice, receiver) pair. The processor verifies it on-chain, so a
  // receiver edited into storage by hand cannot be spent without one.
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
// by callers, which re-run the approval rather than discarding the address.
const isUsable = (entry: StoredFeeReceiver | undefined): boolean =>
  Boolean(
    entry?.feeReceiver &&
      entry?.ephemeralPublicKey &&
      entry?.paymentToken &&
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

/** The fee receiver already issued for this invoice, if one is still usable. */
export const readFeeReceiver = (ref: FeeReceiverRef): StoredFeeReceiver | null =>
  readStore()[entryKey(ref)] ?? null;

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

/** Called once the payment/accept that consumed the address has settled. */
export const clearFeeReceiver = (ref: FeeReceiverRef) => {
  const store = readStore();
  const key = entryKey(ref);
  if (!(key in store)) return;
  delete store[key];
  writeStore(store);
};
