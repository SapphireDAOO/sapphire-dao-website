import { ZERO_ADDRESS } from "@/constants";
import {
  readFeeReceiver,
  saveFeeReceiver,
  type FeeReceiverRef,
  type FeeReceiverState,
  type StoredFeeReceiver,
} from "@/lib/feeReceiverStore";
import type { Address, Hex } from "viem";

export type FeeReceiverAuthorization = {
  feeReceiver: Address;
  signature: Hex;
};

type FeeReceiverResponse = {
  success?: boolean;
  feeReceiver?: Address;
  ephemeralPublicKey?: Hex;
  state?: FeeReceiverState;
  signature?: Hex;
};

type FeeReceiverRequest = FeeReceiverRef & {
  action: "create" | "approve";
  paymentToken: Address;
  ephemeralPublicKey?: Hex;
};

const post = async ({
  action,
  invoiceId,
  chainId,
  processor,
  paymentToken,
  ephemeralPublicKey,
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
        paymentToken,
        ephemeralPublicKey,
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

/** An approved entry is only spendable once it also carries its signature. */
const isSpendable = (
  stored: StoredFeeReceiver | null,
  paymentToken: Address,
): stored is StoredFeeReceiver & { signature: Hex } =>
  stored?.state === "approved" &&
  Boolean(stored.signature) &&
  stored.paymentToken.toLowerCase() === paymentToken.toLowerCase();

/**
 * Prepares the one-time stealth fee receiver an invoice is paid/accepted with,
 * driving the server's two steps through local storage so a cut-off at any
 * point is resumable:
 *
 * 1. Create — the address is derived and written to storage as `created`
 *    before any on-chain work is attempted.
 * 2. Approve — the stored address is handed back for its 7702 delegation and
 *    Sweeper approval, then recorded as `approved` with the fee signer's
 *    authorization.
 * 3. Use — the address passed to the contract is read back from storage, and
 *    only ever from an `approved` entry.
 *
 * So an interrupted run resumes where it stopped: a `created` entry is
 * approved rather than replaced, and an `approved` one is reused as-is rather
 * than paying for a second address. The entry is dropped only once the
 * payment/accept has landed — see `clearFeeReceiver`.
 *
 * Returns null on failure; callers must abort rather than submit without a
 * valid authorization.
 */
export const requestFeeReceiver = async (
  params: FeeReceiverRef & { paymentToken?: Address },
): Promise<FeeReceiverAuthorization | null> => {
  const paymentToken = params.paymentToken ?? ZERO_ADDRESS;
  let stored = readFeeReceiver(params);

  // Nothing on-chain has happened yet at this point, so an address lost to a
  // failed response here costs nothing and the next attempt simply derives
  // another.
  if (!stored) {
    const created = await post({ ...params, action: "create", paymentToken });
    if (!created?.feeReceiver || !created.ephemeralPublicKey) return null;

    stored = saveFeeReceiver(params, {
      feeReceiver: created.feeReceiver,
      ephemeralPublicKey: created.ephemeralPublicKey,
      paymentToken,
      state: "created",
    });
  }

  // Approve whatever storage holds — a fresh address, one whose approval was
  // cut off last time, or one approved for a token this attempt is not paying
  // in. The server settles the on-chain side idempotently.
  if (!isSpendable(stored, paymentToken)) {
    const approved = await post({
      ...params,
      action: "approve",
      paymentToken,
      ephemeralPublicKey: stored.ephemeralPublicKey,
    });
    if (
      approved?.state !== "approved" ||
      !approved.feeReceiver ||
      !approved.signature
    ) {
      return null;
    }

    // The address the server derived from the ephemeral key wins over the one
    // in storage: the key is the source of truth, and only the derived address
    // is the one the returned signature covers.
    stored = saveFeeReceiver(params, {
      ...stored,
      feeReceiver: approved.feeReceiver,
      paymentToken,
      state: "approved",
      signature: approved.signature,
    });
  }

  // Read back rather than trusting the value in hand, so the address that
  // reaches the contract is the one storage actually holds as approved.
  const ready = readFeeReceiver(params);
  if (!isSpendable(ready, paymentToken)) return null;

  return { feeReceiver: ready.feeReceiver, signature: ready.signature };
};
