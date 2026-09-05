import { ZERO_ADDRESS } from "@/constants";
import {
  readFeeReceiver,
  saveFeeReceiver,
  type FeeReceiverRef,
  type FeeReceiverState,
  type InvoiceKind,
  type StoredFeeReceiver,
} from "@/lib/feeReceiverStore";
import type { Address, Hex } from "viem";

export type FeeReceiverAuthorization = {
  /** Index-aligned with the invoice's sub-invoices; length 1 for a single. */
  feeReceivers: Address[];
  signature: Hex;
};

type FeeReceiverResponse = {
  success?: boolean;
  feeReceivers?: Address[];
  ephemeralPublicKeys?: Hex[];
  state?: FeeReceiverState;
  signature?: Hex;
};

type FeeReceiverRequest = FeeReceiverRef & {
  action: "create" | "approve";
  kind: InvoiceKind;
  paymentToken: Address;
  count?: number;
  ephemeralPublicKeys?: Hex[];
};

const post = async ({
  action,
  invoiceId,
  chainId,
  processor,
  kind,
  paymentToken,
  count,
  ephemeralPublicKeys,
}: FeeReceiverRequest): Promise<FeeReceiverResponse | null> => {
  try {
    const response = await fetch("/api/fee-receiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        invoiceId: invoiceId.toString(),
        chainId,
        processor,
        kind,
        paymentToken,
        count,
        ephemeralPublicKeys,
      }),
    });

    const payload = (await response.json()) as FeeReceiverResponse;
    if (!response.ok || !payload.success) return null;
    return payload;
  } catch (error) {
    console.error(`Failed to ${action} fee receiver`, error);
    return null;
  }
};

/**
 * An approved entry is only spendable once it also carries the signature, and
 * only for the shape it was signed for: the digest covers the whole receiver
 * array, so a different count or kind needs a different signature.
 */
const isSpendable = (
  stored: StoredFeeReceiver | null,
  paymentToken: Address,
  kind: InvoiceKind,
  count: number,
): stored is StoredFeeReceiver & { signature: Hex } =>
  stored?.state === "approved" &&
  Boolean(stored.signature) &&
  stored.kind === kind &&
  stored.feeReceivers.length === count &&
  stored.paymentToken.toLowerCase() === paymentToken.toLowerCase();

/**
 * Prepares the one-time stealth fee receivers an invoice is paid/accepted with,
 * driving the server's two steps through local storage so a cut-off at any
 * point is resumable:
 *
 * 1. Create — the addresses are derived and written to storage as `created`
 *    before any on-chain work is attempted.
 * 2. Approve — the stored addresses are handed back for their 7702 delegation
 *    and Sweeper approval, then recorded as `approved` with the fee signer's
 *    authorization.
 * 3. Use — the addresses passed to the contract are read back from storage, and
 *    only ever from an `approved` entry.
 *
 * So an interrupted run resumes where it stopped: a `created` entry is approved
 * rather than replaced, and an `approved` one is reused as-is rather than
 * paying for a second set. The entry is dropped only once the payment/accept
 * has landed — see `clearFeeReceiver`.
 *
 * A meta-invoice passes `kind: "meta"` and one receiver per sub-invoice, in
 * `subInvoiceIds` order; the contract rejects any other count.
 *
 * Returns null on failure; callers must abort rather than submit without a
 * valid authorization.
 */
export const requestFeeReceiver = async (
  params: FeeReceiverRef & {
    paymentToken?: Address;
    kind?: InvoiceKind;
    count?: number;
  },
): Promise<FeeReceiverAuthorization | null> => {
  const paymentToken = params.paymentToken ?? ZERO_ADDRESS;
  const kind = params.kind ?? "single";
  const count = params.count ?? 1;
  if (!Number.isInteger(count) || count < 1) return null;

  let stored = readFeeReceiver(params);

  // An entry issued for a different shape can never be spent for this one, so
  // it is replaced rather than approved again.
  if (stored && (stored.kind !== kind || stored.feeReceivers.length !== count)) {
    stored = null;
  }

  // Nothing on-chain has happened yet at this point, so addresses lost to a
  // failed response here cost nothing and the next attempt simply derives
  // others.
  if (!stored) {
    const created = await post({
      ...params,
      action: "create",
      kind,
      paymentToken,
      count,
    });
    if (
      !created?.feeReceivers?.length ||
      created.feeReceivers.length !== count ||
      created.ephemeralPublicKeys?.length !== count
    ) {
      return null;
    }

    stored = saveFeeReceiver(params, {
      feeReceivers: created.feeReceivers,
      ephemeralPublicKeys: created.ephemeralPublicKeys,
      paymentToken,
      kind,
      state: "created",
    });
  }

  // Approve whatever storage holds — fresh addresses, ones whose approval was
  // cut off last time, or ones approved for a token this attempt is not paying
  // in. The server settles the on-chain side idempotently.
  if (!isSpendable(stored, paymentToken, kind, count)) {
    const approved = await post({
      ...params,
      action: "approve",
      kind,
      paymentToken,
      ephemeralPublicKeys: stored.ephemeralPublicKeys,
    });
    if (
      approved?.state !== "approved" ||
      approved.feeReceivers?.length !== count ||
      !approved.signature
    ) {
      return null;
    }

    // The addresses the server derived from the ephemeral keys win over the
    // ones in storage: the keys are the source of truth, and only the derived
    // addresses are the ones the returned signature covers.
    stored = saveFeeReceiver(params, {
      ...stored,
      feeReceivers: approved.feeReceivers,
      paymentToken,
      kind,
      state: "approved",
      signature: approved.signature,
    });
  }

  // Read back rather than trusting the value in hand, so the addresses that
  // reach the contract are the ones storage actually holds as approved.
  const ready = readFeeReceiver(params);
  if (!isSpendable(ready, paymentToken, kind, count)) return null;

  return { feeReceivers: ready.feeReceivers, signature: ready.signature };
};
