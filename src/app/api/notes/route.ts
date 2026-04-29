import { NextResponse } from "next/server";
import { isAddress, parseGwei, verifyMessage } from "viem";
import { baseSepolia } from "viem/chains";
import { Notes } from "@/abis/Notes";
import { advancedPaymentProcessor } from "@/abis/AdvancedPaymentProcessor";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import {
  ADVANCED_PAYMENT_PROCESSOR,
  NOTES_CONTRACT,
  SIMPLE_PAYMENT_PROCESSOR,
} from "@/constants";
import { toEncryptedNoteHex } from "@/utils";
import { getNotesClients, parseBigInt } from "./notesApiHelpers";

// this can be moved to a different server. the api will be called here

export const runtime = "nodejs";

const MAX_NOTE_CONTENT_LENGTH = 1_000;
const NOTE_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const NOTE_RATE_LIMIT_MAX = 10;

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

const getClientKey = (req: Request) => {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  return ip;
};

const enforceRateLimit = (
  req: Request,
  author: string,
  action: string,
) => {
  const now = Date.now();

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) rateLimitBuckets.delete(key);
  }

  const key = `${action}:${author.toLowerCase()}:${getClientKey(req)}`;
  const current = rateLimitBuckets.get(key);

  if (!current || current.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + NOTE_RATE_LIMIT_WINDOW_MS,
    });
    return null;
  }

  if (current.count >= NOTE_RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((current.resetAt - now) / 1000);
    return NextResponse.json(
      { success: false, error: "Too many note requests" },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  current.count += 1;
  return null;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const isZeroAddress = (address?: string) =>
  !address || address.toLowerCase() === ZERO_ADDRESS;

const readField = (
  data: unknown,
  field: string,
  fallbackIndexes: number[],
) => {
  if (data && typeof data === "object" && field in data) {
    return (data as Record<string, unknown>)[field];
  }

  if (!Array.isArray(data)) return undefined;

  for (const index of fallbackIndexes) {
    const value = data[index];
    if (value !== undefined && value !== null) return value;
  }

  return undefined;
};

const readBigIntField = (
  data: unknown,
  field: string,
  fallbackIndexes: number[],
) => {
  const value = readField(data, field, fallbackIndexes);
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && value.trim()) {
    try {
      return BigInt(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const readAddressField = (
  data: unknown,
  field: string,
  fallbackIndexes: number[],
) => {
  const value = readField(data, field, fallbackIndexes);
  return typeof value === "string" && isAddress(value) ? value : undefined;
};

const isParty = (
  author: string,
  parties: { seller?: string; buyer?: string } | null,
) => {
  if (!parties) return false;
  const normalizedAuthor = author.toLowerCase();
  return (
    parties.seller?.toLowerCase() === normalizedAuthor ||
    (!isZeroAddress(parties.buyer) &&
      parties.buyer?.toLowerCase() === normalizedAuthor)
  );
};

const readSimpleParties = async (invoiceId: bigint) => {
  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[baseSepolia.id];
  if (!contractAddress) return null;

  const { publicClient } = getNotesClients();
  const data = await publicClient.readContract({
    address: contractAddress,
    abi: paymentProcessor,
    functionName: "getInvoiceData",
    args: [invoiceId],
  });

  const state = readBigIntField(data, "state", [6]);
  if (!state || state === BigInt(0)) return null;

  return {
    seller: readAddressField(data, "seller", [8]),
    buyer: readAddressField(data, "buyer", [9]),
  };
};

const readMarketplaceParties = async (invoiceId: bigint) => {
  const contractAddress = ADVANCED_PAYMENT_PROCESSOR[baseSepolia.id];
  if (!contractAddress) return null;

  const { publicClient } = getNotesClients();
  const data = await publicClient.readContract({
    address: contractAddress,
    abi: advancedPaymentProcessor,
    functionName: "getInvoice",
    args: [invoiceId],
  });

  const state = readBigIntField(data, "state", [5]);
  if (!state || state === BigInt(0)) return null;

  return {
    seller: readAddressField(data, "seller", [10]),
    buyer: readAddressField(data, "buyer", [9]),
  };
};

const isInvoiceParticipant = async (invoiceId: bigint, author: string) => {
  const [simpleResult, marketplaceResult] = await Promise.allSettled([
    readSimpleParties(invoiceId),
    readMarketplaceParties(invoiceId),
  ]);

  const simpleParties =
    simpleResult.status === "fulfilled" ? simpleResult.value : null;
  const marketplaceParties =
    marketplaceResult.status === "fulfilled" ? marketplaceResult.value : null;

  return (
    isParty(author, simpleParties) || isParty(author, marketplaceParties)
  );
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action;

    // could be seperated into different helper functions
    if (action === "create") {
      const invoiceId = parseBigInt(body?.invoiceId, "invoiceId");
      const author = body?.author as string | undefined;
      const content = String(body?.content ?? "").trim();
      const share = Boolean(body?.share);

      if (!author || !isAddress(author)) {
        return NextResponse.json(
          { success: false, error: "Invalid author address" },
          { status: 400 },
        );
      }

      const signature = body?.signature as string | undefined;
      const timestamp =
        typeof body?.timestamp === "number" ? body.timestamp : undefined;

      if (!signature || timestamp === undefined) {
        return NextResponse.json(
          { success: false, error: "Signature required" },
          { status: 401 },
        );
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return NextResponse.json(
          { success: false, error: "Signature expired" },
          { status: 401 },
        );
      }

      // remove this for every signing action, set up a signature when a user signs in
      const expectedMessage = `Sapphire DAO: Create note for order ${invoiceId.toString()}\nAuthor: ${author}\nContent: ${content}\nShare: ${share}\nTimestamp: ${timestamp}`;
      const isValid = await verifyMessage({
        address: author as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 },
        );
      }

      const rateLimit = enforceRateLimit(req, author, action);
      if (rateLimit) return rateLimit;

      if (!content) {
        return NextResponse.json(
          { success: false, error: "Note content is required" },
          { status: 400 },
        );
      }

      if (content.length > MAX_NOTE_CONTENT_LENGTH) {
        return NextResponse.json(
          { success: false, error: "Note content is too long" },
          { status: 413 },
        );
      }

      const contractAddress = NOTES_CONTRACT[baseSepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 },
        );
      }

      const canWrite = await isInvoiceParticipant(invoiceId, author);
      if (!canWrite) {
        return NextResponse.json(
          { success: false, error: "Author is not a participant on this invoice" },
          { status: 403 },
        );
      }

      const { walletClient } = getNotesClients();
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: Notes,
        functionName: "createNote",
        args: [invoiceId, author, toEncryptedNoteHex(content), share],
        gas: BigInt(300000),
        maxPriorityFeePerGas: parseGwei("2"),
      });

      return NextResponse.json({
        success: true,
        txHash,
      });
    }

    if (action === "setOpened") {
      const invoiceId = parseBigInt(body?.invoiceId, "invoiceId");
      const noteId = parseBigInt(body?.noteId, "noteId");
      const open = Boolean(body?.open);
      const author = body?.author as string | undefined;
      const signature = body?.signature as string | undefined;
      const timestamp =
        typeof body?.timestamp === "number" ? body.timestamp : undefined;

      if (!author || !isAddress(author)) {
        return NextResponse.json(
          { success: false, error: "Invalid author address" },
          { status: 400 },
        );
      }

      if (!signature || timestamp === undefined) {
        return NextResponse.json(
          { success: false, error: "Signature required" },
          { status: 401 },
        );
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return NextResponse.json(
          { success: false, error: "Signature expired" },
          { status: 401 },
        );
      }

      const expectedMessage = `Sapphire DAO: Set note state for order ${invoiceId.toString()}\nNoteId: ${noteId.toString()}\nOpen: ${open}\nAuthor: ${author}\nTimestamp: ${timestamp}`;
      const isValid = await verifyMessage({
        address: author as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 },
        );
      }

      const rateLimit = enforceRateLimit(req, author, action);
      if (rateLimit) return rateLimit;

      if (!open) {
        return NextResponse.json({ success: true });
      }

      const contractAddress = NOTES_CONTRACT[baseSepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 },
        );
      }

      const canWrite = await isInvoiceParticipant(invoiceId, author);
      if (!canWrite) {
        return NextResponse.json(
          { success: false, error: "Author is not a participant on this invoice" },
          { status: 403 },
        );
      }

      const { walletClient } = getNotesClients();
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: Notes,
        functionName: "setOpened",
        args: [invoiceId, author, noteId],
        gas: BigInt(150000),
        maxPriorityFeePerGas: parseGwei("2"),
      });

      return NextResponse.json({ success: true, txHash });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
