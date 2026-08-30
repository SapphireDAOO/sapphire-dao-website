import { NextResponse } from "next/server";
import { isAddress, parseGwei, verifyMessage } from "viem";
import { baseSepolia } from "viem/chains";
import { Notes } from "@/abis/Notes";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import { paymentProcessor } from "@/abis/PaymentProcessor";
import {
  INTERMEDIATED_PAYMENT_PROCESSOR,
  MAX_NOTE_LENGTH,
  NOTES_CONTRACT,
  SIMPLE_PAYMENT_PROCESSOR,
} from "@/constants";
import { decryptNoteBlob, toEncryptedNoteHex } from "@/lib/noteEncryption";
import { getNotesClients, parseBigInt } from "./notesApiHelpers";

// this can be moved to a different server. the api will be called here

export const runtime = "nodejs";

const NOTE_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const NOTE_RATE_LIMIT_MAX = 10;
// Read-path actions (decrypt/encrypt) fire on every thread open / refresh,
// so they get a higher budget than the on-chain write actions.
const READ_RATE_LIMIT_MAX = 60;
// A read-auth signature stays valid for a day so viewers sign once per
// session instead of on every background refresh.
const READ_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_DECRYPT_BATCH = 50;

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
  max = NOTE_RATE_LIMIT_MAX,
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

  if (current.count >= max) {
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

const readIntermediatedParties = async (invoiceId: bigint) => {
  const contractAddress = INTERMEDIATED_PAYMENT_PROCESSOR[baseSepolia.id];
  if (!contractAddress) return null;

  const { publicClient } = getNotesClients();
  const data = await publicClient.readContract({
    address: contractAddress,
    abi: intermediatedPaymentProcessor,
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
  const [simpleResult, intermediatedResult] = await Promise.allSettled([
    readSimpleParties(invoiceId),
    readIntermediatedParties(invoiceId),
  ]);

  const simpleParties =
    simpleResult.status === "fulfilled" ? simpleResult.value : null;
  const intermediatedParties =
    intermediatedResult.status === "fulfilled" ? intermediatedResult.value : null;

  return (
    isParty(author, simpleParties) || isParty(author, intermediatedParties)
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

      if (content.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Notes are limited to ${MAX_NOTE_LENGTH} characters` },
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

    // Encrypt arbitrary content with the server-held notes key (used for the
    // storageRef note embedded in create/pay transactions). Encryption reveals
    // nothing secret, so it only needs rate limiting.
    if (action === "encrypt") {
      const content = String(body?.content ?? "").trim();

      if (!content) {
        return NextResponse.json(
          { success: false, error: "Content is required" },
          { status: 400 },
        );
      }

      if (content.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          { success: false, error: `Notes are limited to ${MAX_NOTE_LENGTH} characters` },
          { status: 413 },
        );
      }

      const rateLimit = enforceRateLimit(
        req,
        "anon",
        action,
        READ_RATE_LIMIT_MAX,
      );
      if (rateLimit) return rateLimit;

      return NextResponse.json({
        success: true,
        payload: toEncryptedNoteHex(content),
      });
    }

    // Decrypt notes resolved by (invoiceId, noteId) from the chain — never
    // client-supplied ciphertext, or any participant could decrypt blobs
    // lifted from other invoices. Shared notes are public by design (they are
    // shown on pay/checkout pages); private notes decrypt only for their
    // author, proven by a signed read-auth message.
    if (action === "decrypt") {
      const invoiceId = parseBigInt(body?.invoiceId, "invoiceId");
      const rawNoteIds = Array.isArray(body?.noteIds) ? body.noteIds : [];

      if (rawNoteIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "noteIds is required" },
          { status: 400 },
        );
      }

      if (rawNoteIds.length > MAX_DECRYPT_BATCH) {
        return NextResponse.json(
          { success: false, error: "Too many notes requested" },
          { status: 413 },
        );
      }

      const noteIds = rawNoteIds.map((value: unknown) =>
        parseBigInt(value, "noteId"),
      );

      const viewer = body?.viewer as string | undefined;
      const signature = body?.signature as string | undefined;
      const timestamp =
        typeof body?.timestamp === "number" ? body.timestamp : undefined;

      const rateLimit = enforceRateLimit(
        req,
        viewer && isAddress(viewer) ? viewer : "anon",
        action,
        READ_RATE_LIMIT_MAX,
      );
      if (rateLimit) return rateLimit;

      let authorizedViewer: string | undefined;
      if (viewer && isAddress(viewer) && signature && timestamp !== undefined) {
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - timestamp) <= READ_AUTH_MAX_AGE_SECONDS) {
          const expectedMessage = `Sapphire DAO: Read notes for order ${invoiceId.toString()}\nViewer: ${viewer}\nTimestamp: ${timestamp}`;
          const isValid = await verifyMessage({
            address: viewer as `0x${string}`,
            message: expectedMessage,
            signature: signature as `0x${string}`,
          });
          if (isValid) authorizedViewer = viewer.toLowerCase();
        }
      }

      const contractAddress = NOTES_CONTRACT[baseSepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 },
        );
      }

      const { publicClient } = getNotesClients();
      const notes = await Promise.all(
        noteIds.map(async (noteId: bigint) => {
          try {
            const data = await publicClient.readContract({
              address: contractAddress,
              abi: Notes,
              functionName: "getNote",
              args: [invoiceId, noteId],
            });
            const [author, share, content] = data as readonly [
              string,
              boolean,
              `0x${string}`,
              boolean,
              number,
            ];

            const canRead =
              share ||
              (authorizedViewer !== undefined &&
                author.toLowerCase() === authorizedViewer);

            return {
              noteId: noteId.toString(),
              content: canRead ? decryptNoteBlob(content) ?? null : null,
            };
          } catch {
            return { noteId: noteId.toString(), content: null };
          }
        }),
      );

      return NextResponse.json({ success: true, notes });
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
