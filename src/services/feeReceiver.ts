import {
  CONTRACT_API_URL,
  MAX_FEE_RECEIVERS,
  ZERO_ADDRESS,
  getKnownPaymentToken,
} from "@/constants";
import type { Address, Hex } from "viem";

export type ProcessorKind = "simple" | "intermediated";

/**
 * Which authorization the processor verifies. A meta-invoice holding one
 * sub-invoice still needs the array form, so this is passed explicitly rather
 * than inferred from the receiver count.
 */
export type InvoiceKind = "single" | "meta";

export type FeeReceiverAuthorization = {
  /** Index-aligned with the invoice's sub-invoices; length 1 for a single. */
  feeReceivers: Address[];
  signature: Hex;
};

type CreateResponse = {
  feeReceivers?: Address[];
  signature?: Hex;
};
type ApiError = { error?: string; reason?: string };

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
 * Gets the one-time stealth fee receivers an invoice is paid/accepted with,
 * and the fee signer's signature over them, from `POST /v1/fee-receivers`.
 *
 * One request does it all: the API derives the addresses, upgrades each to a
 * 7702 delegator, approves the sweeper on it, waits for those to be mined and
 * then signs. Nothing is kept between attempts; a retry derives a fresh set.
 *
 * Returns null on failure; callers must abort rather than submit without a
 * valid authorization.
 */
export const requestFeeReceiver = async (params: {
  invoiceId: bigint;
  chainId: number;
  processor: ProcessorKind;
  paymentToken?: Address;
  kind?: InvoiceKind;
  count?: number;
}): Promise<FeeReceiverAuthorization | null> => {
  const paymentToken = params.paymentToken ?? ZERO_ADDRESS;
  const kind = params.kind ?? "single";
  const count = params.count ?? 1;

  if (!Number.isInteger(count) || count < 1 || count > MAX_FEE_RECEIVERS) {
    console.error(
      `cannot issue ${count} fee receivers; the limit is ${MAX_FEE_RECEIVERS}`,
    );
    return null;
  }

  let payload: CreateResponse & ApiError;
  try {
    const response = await fetch(`${CONTRACT_API_URL}/v1/fee-receivers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: params.invoiceId.toString(),
        processor: params.processor,
        kind,
        quantity: count,
        paymentToken: feeTokenSymbol(params.chainId, paymentToken),
      }),
    });

    payload = (await response.json()) as CreateResponse & ApiError;
    if (!response.ok) {
      // The status separates the causes the sidecar's own wording does not:
      // 400 is a bad request, 502 an internal sidecar failure (chain error or
      // an unset key), 503 an unconfigured network or an unfunded relayer,
      // 504 a timeout. `reason` carries the sidecar's message.
      console.error(
        `fee receiver request failed (${response.status})`,
        payload?.error ?? "",
        payload?.reason ?? "",
      );
      return null;
    }
  } catch (error) {
    console.error("fee receiver request failed", error);
    return null;
  }

  // The processor reverts on a count that does not match the invoice, so a
  // short or long array is as unusable as none.
  if (
    !payload.signature ||
    !Array.isArray(payload.feeReceivers) ||
    payload.feeReceivers.length !== count
  ) {
    console.error("fee receiver response is missing receivers or a signature");
    return null;
  }

  return {
    feeReceivers: payload.feeReceivers,
    signature: payload.signature,
  };
};
