import { NextResponse } from "next/server";
import type { Address, Hex } from "viem";
import {
  delegateAndApprove,
  FeeReceiverUnavailableError,
  generateStealthFeeReceiver,
  getProcessorAddress,
  resolveApprovalToken,
  restoreStealthFeeReceiver,
  signFeeAuthorization,
  type ProcessorKind,
  type StealthFeeReceiver,
} from "./feeReceiverHelpers";

export const runtime = "nodejs";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
// Compressed or uncompressed secp256k1 point, as the SDK may return either.
const EPHEMERAL_KEY_PATTERN = /^0x[0-9a-fA-F]{66,130}$/;
const MAX_UINT216 = (BigInt(1) << BigInt(216)) - BigInt(1);

type FeeReceiverRequest = {
  action?: "create" | "approve";
  invoiceId?: string;
  chainId?: number;
  processor?: ProcessorKind;
  paymentToken?: string;
  ephemeralPublicKey?: string;
};

const badRequest = (error: string) =>
  NextResponse.json({ success: false, error }, { status: 400 });

/**
 * Issues a one-time stealth fee receiver for an invoice in two steps the
 * caller drives separately, so a cut-off between them strands nothing:
 *
 * `create` only derives an EIP-5564 address and touches no chain, letting the
 * caller persist it before any on-chain work is attempted.
 * `approve` takes that address back, 7702-delegates it, grants the Sweeper a
 * max approval on the fee token, and only then returns the fee signer's
 * authorization to pass on-chain as `_feeReceiver` / `_data`.
 *
 * The processor verifies that authorization, so withholding it until the
 * approval has actually landed is what stops an unapproved receiver from
 * reaching the contract — whatever the caller's stored state claims.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeeReceiverRequest;

    if (body.action !== "create" && body.action !== "approve") {
      return badRequest("Invalid action");
    }

    if (body.processor !== "simple" && body.processor !== "intermediated") {
      return badRequest("Invalid processor");
    }

    const chainId = Number(body.chainId);
    const processorAddress = Number.isInteger(chainId)
      ? getProcessorAddress(body.processor, chainId)
      : undefined;
    if (!processorAddress) {
      return badRequest("Unsupported chain");
    }

    let invoiceId: bigint;
    try {
      invoiceId = BigInt(body.invoiceId ?? "");
    } catch {
      return badRequest("Invalid invoiceId");
    }
    if (invoiceId < BigInt(0) || invoiceId > MAX_UINT216) {
      return badRequest("Invalid invoiceId");
    }

    if (
      body.paymentToken !== undefined &&
      !ADDRESS_PATTERN.test(body.paymentToken)
    ) {
      return badRequest("Invalid paymentToken");
    }

    if (body.action === "create") {
      const { stealthAccount, ephemeralPublicKey } =
        generateStealthFeeReceiver();

      return NextResponse.json({
        success: true,
        feeReceiver: stealthAccount.address,
        ephemeralPublicKey,
        state: "created",
      });
    }

    // The caller hands back the ephemeral key it stored at creation.
    // Re-deriving from it is what makes accepting caller input safe here: it
    // can only ever resolve to an address the platform's spending and viewing
    // keys control, never to one the caller chose.
    if (
      !body.ephemeralPublicKey ||
      !EPHEMERAL_KEY_PATTERN.test(body.ephemeralPublicKey)
    ) {
      return badRequest("Invalid ephemeralPublicKey");
    }

    let receiver: StealthFeeReceiver;
    try {
      receiver = restoreStealthFeeReceiver(body.ephemeralPublicKey as Hex);
    } catch (error) {
      console.warn("Unusable ephemeral public key", error);
      return badRequest("Invalid ephemeralPublicKey");
    }

    // The stealth key is discarded when this request ends, so the delegation
    // and max approval must land before the authorization is handed out. An
    // address approved by an earlier attempt is a no-op here.
    await delegateAndApprove(
      receiver.stealthAccount,
      receiver.stealthPrivateKey,
      chainId,
      resolveApprovalToken(chainId, body.paymentToken as Address | undefined),
    );

    const signature = await signFeeAuthorization(
      processorAddress,
      chainId,
      invoiceId,
      receiver.stealthAccount.address,
    );

    return NextResponse.json({
      success: true,
      feeReceiver: receiver.stealthAccount.address,
      state: "approved",
      signature,
    });
  } catch (error) {
    console.error("fee-receiver route error", error);
    if (error instanceof FeeReceiverUnavailableError) {
      return NextResponse.json(
        {
          success: false,
          code: error.code,
          error: "Fee relayer is not funded on the selected network",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to prepare fee receiver" },
      { status: 500 },
    );
  }
}
