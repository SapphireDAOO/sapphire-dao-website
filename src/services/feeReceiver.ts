import {
  CONTRACT_API_URL,
  MAX_FEE_RECEIVERS,
  ZERO_ADDRESS,
  getKnownPaymentToken,
} from "@/constants";
import type { Address, Hex } from "viem";

export type ProcessorKind = "simple" | "intermediated";

/**
 * Passed explicitly: a meta-invoice holding
 * one sub-invoice still needs the array form.
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
 * Returns null on failure; callers must abort
 * rather than submit without an authorization.
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
