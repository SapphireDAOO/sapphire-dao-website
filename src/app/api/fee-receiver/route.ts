import { NextResponse } from "next/server";
import type { Address } from "viem";
import {
  delegateAndApprove,
  FeeReceiverUnavailableError,
  generateStealthFeeReceiver,
  getProcessorAddress,
  resolveApprovalToken,
  signFeeAuthorization,
  type ProcessorKind,
} from "./feeReceiverHelpers";

export const runtime = "nodejs";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const MAX_UINT216 = (BigInt(1) << BigInt(216)) - BigInt(1);

type FeeReceiverRequest = {
  invoiceId?: string;
  chainId?: number;
  processor?: ProcessorKind;
  paymentToken?: string;
};

/**
 * Issues a one-time stealth fee receiver for an invoice: derives a fresh
 * EIP-5564 stealth address, 7702-delegates it and grants the relayer a max
 * approval on the fee token, and returns the address together with the fee
 * signer's authorization to pass on-chain as `_feeReceiver` / `_data`.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FeeReceiverRequest;

    if (body.processor !== "simple" && body.processor !== "intermediated") {
      return NextResponse.json(
        { success: false, error: "Invalid processor" },
        { status: 400 },
      );
    }

    const chainId = Number(body.chainId);
    const processorAddress = Number.isInteger(chainId)
      ? getProcessorAddress(body.processor, chainId)
      : undefined;
    if (!processorAddress) {
      return NextResponse.json(
        { success: false, error: "Unsupported chain" },
        { status: 400 },
      );
    }

    let invoiceId: bigint;
    try {
      invoiceId = BigInt(body.invoiceId ?? "");
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid invoiceId" },
        { status: 400 },
      );
    }
    if (invoiceId < BigInt(0) || invoiceId > MAX_UINT216) {
      return NextResponse.json(
        { success: false, error: "Invalid invoiceId" },
        { status: 400 },
      );
    }

    if (
      body.paymentToken !== undefined &&
      !ADDRESS_PATTERN.test(body.paymentToken)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid paymentToken" },
        { status: 400 },
      );
    }

    const { stealthAccount, stealthPrivateKey } = generateStealthFeeReceiver();

    const approvalToken = resolveApprovalToken(
      chainId,
      body.paymentToken as Address | undefined,
    );

    // The stealth key is discarded when this request ends, so the delegation
    // and max approval must land before the address is handed out.
    await delegateAndApprove(
      stealthAccount,
      stealthPrivateKey,
      chainId,
      approvalToken,
    );

    const signature = await signFeeAuthorization(
      processorAddress,
      chainId,
      invoiceId,
      stealthAccount.address,
    );

    return NextResponse.json({
      success: true,
      feeReceiver: stealthAccount.address,
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
