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
  type InvoiceKind,
  type ProcessorKind,
  type StealthFeeReceiver,
} from "./feeReceiverHelpers";

export const runtime = "nodejs";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
// Compressed or uncompressed secp256k1 point, as the SDK may return either.
const EPHEMERAL_KEY_PATTERN = /^0x[0-9a-fA-F]{66,130}$/;
const MAX_UINT216 = (BigInt(1) << BigInt(216)) - BigInt(1);
// One receiver per sub-invoice, each costing a sponsored delegation tx. Past
// this a meta-invoice payment would sit in the approval loop for minutes, so
// refuse rather than appear to hang.
const MAX_FEE_RECEIVERS = 25;

type FeeReceiverRequest = {
  action?: "create" | "approve";
  invoiceId?: string;
  chainId?: number;
  processor?: ProcessorKind;
  kind?: InvoiceKind;
  paymentToken?: string;
  /** create: how many receivers to derive. Defaults to one. */
  count?: number;
  /** approve: the keys stored at creation, in sub-invoice order. */
  ephemeralPublicKeys?: string[];
};

const badRequest = (error: string) =>
  NextResponse.json({ success: false, error }, { status: 400 });

/**
 * Issues one-time stealth fee receivers for an invoice in two steps the caller
 * drives separately, so a cut-off between them strands nothing:
 *
 * `create` only derives EIP-5564 addresses and touches no chain, letting the
 * caller persist them before any on-chain work is attempted.
 * `approve` takes those addresses back, 7702-delegates each, grants the Sweeper
 * a max approval on the fee token, and only then returns the fee signer's
 * authorization to pass on-chain as `_feeReceiver(s)` / `_data`.
 *
 * The processor verifies that authorization, so withholding it until the
 * approvals have actually landed is what stops an unapproved receiver from
 * reaching the contract — whatever the caller's stored state claims.
 *
 * A meta-invoice needs one receiver per sub-invoice, index-aligned with its
 * `subInvoiceIds`, all covered by a single signature over the whole array.
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

    // The digest differs by kind and a one-sub-invoice meta still needs the
    // array form, so this is never inferred from the receiver count.
    const kind: InvoiceKind = body.kind ?? "single";
    if (kind !== "single" && kind !== "meta") {
      return badRequest("Invalid kind");
    }
    if (kind === "meta" && body.processor !== "intermediated") {
      return badRequest("Meta invoices are intermediated only");
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
      const count = body.count ?? 1;
      if (!Number.isInteger(count) || count < 1 || count > MAX_FEE_RECEIVERS) {
        return badRequest("Invalid count");
      }
      if (kind === "single" && count !== 1) {
        return badRequest("A single invoice takes one fee receiver");
      }

      const receivers = Array.from({ length: count }, () =>
        generateStealthFeeReceiver(),
      );

      return NextResponse.json({
        success: true,
        feeReceivers: receivers.map((r) => r.stealthAccount.address),
        ephemeralPublicKeys: receivers.map((r) => r.ephemeralPublicKey),
        state: "created",
      });
    }

    // The caller hands back the ephemeral keys it stored at creation.
    // Re-deriving from them is what makes accepting caller input safe here:
    // each can only ever resolve to an address the platform's spending and
    // viewing keys control, never to one the caller chose.
    const keys = body.ephemeralPublicKeys;
    if (
      !Array.isArray(keys) ||
      keys.length < 1 ||
      keys.length > MAX_FEE_RECEIVERS ||
      !keys.every((key) => typeof key === "string" && EPHEMERAL_KEY_PATTERN.test(key))
    ) {
      return badRequest("Invalid ephemeralPublicKeys");
    }
    if (kind === "single" && keys.length !== 1) {
      return badRequest("A single invoice takes one fee receiver");
    }

    let receivers: StealthFeeReceiver[];
    try {
      receivers = keys.map((key) => restoreStealthFeeReceiver(key as Hex));
    } catch (error) {
      console.warn("Unusable ephemeral public key", error);
      return badRequest("Invalid ephemeralPublicKeys");
    }

    const approvalToken = resolveApprovalToken(
      chainId,
      body.paymentToken as Address | undefined,
    );

    // The stealth keys are discarded when this request ends, so the delegation
    // and max approval must land before the authorization is handed out. An
    // address approved by an earlier attempt is a no-op here.
    //
    // Sequential, not parallel: every one of these is sponsored by the same
    // relayer EOA, and concurrent sends would race for the same nonce.
    for (const receiver of receivers) {
      await delegateAndApprove(
        receiver.stealthAccount,
        receiver.stealthPrivateKey,
        chainId,
        approvalToken,
      );
    }

    const feeReceivers = receivers.map((r) => r.stealthAccount.address);
    const signature = await signFeeAuthorization(
      processorAddress,
      chainId,
      invoiceId,
      feeReceivers,
      kind,
    );

    return NextResponse.json({
      success: true,
      feeReceivers,
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
