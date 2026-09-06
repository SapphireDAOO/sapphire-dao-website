import {
  CONTRACT_API_URL,
  MAX_FEE_RECEIVERS,
  ZERO_ADDRESS,
  getKnownPaymentToken,
} from "@/constants";
import {
  readFeeReceiver,
  saveFeeReceiver,
  type FeeReceiverRef,
  type InvoiceKind,
} from "@/lib/feeReceiverStore";
import type { Address, Hex } from "viem";

export type FeeReceiverAuthorization = {
  /** Index-aligned with the invoice's sub-invoices; length 1 for a single. */
  feeReceivers: Address[];
  signature: Hex;
};

type CreateResponse = { ephemeralPublicKeys?: Hex[] };
type AuthorizeResponse = { feeReceivers?: Address[]; signature?: Hex };
type ApiError = { error?: string; reason?: string };

const post = async <T>(path: string, body: unknown): Promise<T | null> => {
  try {
    const response = await fetch(`${CONTRACT_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as T & ApiError;
    if (!response.ok) {
      // The status separates the causes the sidecar's own wording does not:
      // 400 is a bad request, 502 an internal sidecar failure (chain error or
      // an unset key), 503 an unconfigured network or an unfunded relayer,
      // 504 a timeout. `reason` carries the sidecar's message.
      console.error(
        `fee receiver ${path} failed (${response.status})`,
        payload?.error ?? "",
        payload?.reason ?? "",
      );
      return null;
    }
    return payload;
  } catch (error) {
    console.error(`fee receiver ${path} failed`, error);
    return null;
  }
};

/**
 * The contract API names tokens by symbol and resolves them through its own
 * table. Native payments are named by omission, which is also what keeps a
 * local symbol that the table may not carry out of the request.
 */
const feeTokenSymbol = (
  chainId: number,
  paymentToken: Address,
): string | undefined => {
  if (paymentToken.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return undefined;
  }
  return getKnownPaymentToken(chainId, paymentToken)?.name ?? undefined;
};

/**
 * Prepares the one-time stealth fee receivers an invoice is paid/accepted
 * with, in the two steps the contract API splits them into:
 *
 * 1. `POST /v1/fee-receivers` derives the addresses, upgrades each to a 7702
 *    delegator and approves the sweeper on it. This spends gas and returns
 *    only the ephemeral public keys, which are the sole way back to the
 *    addresses - so they are written to local storage the moment they arrive,
 *    before anything else is attempted.
 * 2. `POST /v1/fee-receivers/authorization` turns the stored keys back into
 *    addresses and signs over them. No gas, so it runs on every attempt rather
 *    than caching a signature that could go stale against the invoice.
 *
 * An interrupted run therefore resumes on the receivers it already paid for.
 * The entry is dropped only once the payment/accept lands - see
 * `clearFeeReceiver`.
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

  if (!Number.isInteger(count) || count < 1 || count > MAX_FEE_RECEIVERS) {
    console.error(
      `cannot issue ${count} fee receivers; the limit is ${MAX_FEE_RECEIVERS}`,
    );
    return null;
  }

  const symbol = feeTokenSymbol(params.chainId, paymentToken);
  let stored = readFeeReceiver(params);

  // Keys issued for a different shape or a different fee token cannot be
  // spent here: the count is baked into the signed array, and the sweeper
  // approval was granted on one token only.
  if (
    stored &&
    (stored.kind !== kind ||
      stored.ephemeralPublicKeys.length !== count ||
      stored.paymentToken.toLowerCase() !== paymentToken.toLowerCase())
  ) {
    stored = null;
  }

  if (!stored) {
    const created = await post<CreateResponse>("/v1/fee-receivers", {
      processor: params.processor,
      quantity: count,
      paymentToken: symbol,
    });

    const keys = created?.ephemeralPublicKeys;
    if (!Array.isArray(keys) || keys.length !== count) return null;

    // Persist first: the gas is spent whether or not these are kept.
    stored = saveFeeReceiver(params, {
      ephemeralPublicKeys: keys,
      paymentToken,
      kind,
    });
  }

  const authorized = await post<AuthorizeResponse>(
    "/v1/fee-receivers/authorization",
    {
      invoiceId: params.invoiceId.toString(),
      processor: params.processor,
      kind,
      paymentToken: symbol,
      ephemeralPublicKeys: stored.ephemeralPublicKeys,
    },
  );

  if (
    !authorized?.signature ||
    !Array.isArray(authorized.feeReceivers) ||
    authorized.feeReceivers.length !== count
  ) {
    return null;
  }

  return {
    feeReceivers: authorized.feeReceivers,
    signature: authorized.signature,
  };
};
