import { ZERO_ADDRESS } from "@/constants";
import type { Address, Hex } from "viem";

export type FeeReceiverAuthorization = {
  feeReceiver: Address;
  signature: Hex;
};

/**
 * Asks the server for a one-time stealth fee receiver for an invoice. The
 * server derives the address, sets up its 7702 delegation and approval, and
 * returns the fee signer's authorization for the (invoiceId, feeReceiver)
 * pair. Returns null on failure — callers must abort the payment rather than
 * submit without a valid authorization.
 */
export const requestFeeReceiver = async (params: {
  invoiceId: bigint;
  chainId: number;
  processor: "simple" | "intermediated";
  paymentToken?: Address;
}): Promise<FeeReceiverAuthorization | null> => {
  if (!params.paymentToken) {
    params.paymentToken = ZERO_ADDRESS;
  }

  try {
    const response = await fetch("/api/fee-receiver", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: params.invoiceId.toString(),
        chainId: params.chainId,
        processor: params.processor,
        paymentToken: params.paymentToken,
      }),
    });

    const payload = (await response.json()) as {
      success?: boolean;
      feeReceiver?: Address;
      signature?: Hex;
    };

    if (
      !response.ok ||
      !payload.success ||
      !payload.feeReceiver ||
      !payload.signature
    ) {
      return null;
    }

    return { feeReceiver: payload.feeReceiver, signature: payload.signature };
  } catch (error) {
    console.error("Failed to fetch fee receiver", error);
    return null;
  }
};
