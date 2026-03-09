import { NextResponse } from "next/server";
import {
  isAddress,
  parseEventLogs,
  parseGwei,
  verifyMessage,
} from "viem";
import { baseSepolia } from "viem/chains";
import { Notes } from "@/abis/Notes";
import { NOTES_CONTRACT } from "@/constants";
import { toEncryptedNoteHex } from "@/utils";
import { getNotesClients, parseBigInt } from "./notesApiHelpers";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const orderId = parseBigInt(body?.orderId, "orderId");
      const author = body?.author as string | undefined;
      const content = String(body?.content ?? "").trim();
      const share = Boolean(body?.share);

      if (!author || !isAddress(author)) {
        return NextResponse.json(
          { success: false, error: "Invalid author address" },
          { status: 400 }
        );
      }

      const signature = body?.signature as string | undefined;
      const timestamp =
        typeof body?.timestamp === "number" ? body.timestamp : undefined;

      if (!signature || timestamp === undefined) {
        return NextResponse.json(
          { success: false, error: "Signature required" },
          { status: 401 }
        );
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return NextResponse.json(
          { success: false, error: "Signature expired" },
          { status: 401 }
        );
      }

      const expectedMessage = `Sapphire DAO: Create note for order ${orderId.toString()}\nAuthor: ${author}\nContent: ${content}\nShare: ${share}\nTimestamp: ${timestamp}`;
      const isValid = await verifyMessage({
        address: author as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }

      if (!content) {
        return NextResponse.json(
          { success: false, error: "Note content is required" },
          { status: 400 }
        );
      }

      const contractAddress = NOTES_CONTRACT[baseSepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 }
        );
      }

      const { walletClient, publicClient } = getNotesClients();
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: Notes,
        functionName: "createNote",
        args: [orderId, author, toEncryptedNoteHex(content), share],
        gas: BigInt(300000),
        maxPriorityFeePerGas: parseGwei("2"),
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      let noteId: string | undefined;
      try {
        const parsed = parseEventLogs({
          abi: Notes,
          eventName: "NoteCreated",
          logs: receipt.logs,
        });
        const created = parsed[0]?.args?.noteId;
        noteId =
          created !== undefined && created !== null
            ? created.toString()
            : undefined;
      } catch {
        noteId = undefined;
      }

      if (noteId === undefined) {
        try {
          const count = await publicClient.readContract({
            address: contractAddress,
            abi: Notes,
            functionName: "getNoteCount",
            args: [orderId],
          });
          if (typeof count === "bigint" && count > BigInt(0)) {
            noteId = (count - BigInt(1)).toString();
          }
        } catch {
          noteId = undefined;
        }
      }

      return NextResponse.json({
        success: true,
        txHash,
        noteId,
      });
    }

    if (action === "setOpened") {
      const orderId = parseBigInt(body?.orderId, "orderId");
      const noteId = parseBigInt(body?.noteId, "noteId");
      const open = Boolean(body?.open);
      const author = body?.author as string | undefined;
      const signature = body?.signature as string | undefined;
      const timestamp =
        typeof body?.timestamp === "number" ? body.timestamp : undefined;

      if (!author || !isAddress(author)) {
        return NextResponse.json(
          { success: false, error: "Invalid author address" },
          { status: 400 }
        );
      }

      if (!signature || timestamp === undefined) {
        return NextResponse.json(
          { success: false, error: "Signature required" },
          { status: 401 }
        );
      }

      const now = Math.floor(Date.now() / 1000);
      if (Math.abs(now - timestamp) > 300) {
        return NextResponse.json(
          { success: false, error: "Signature expired" },
          { status: 401 }
        );
      }

      const expectedMessage = `Sapphire DAO: Set note state for order ${orderId.toString()}\nNoteId: ${noteId.toString()}\nOpen: ${open}\nAuthor: ${author}\nTimestamp: ${timestamp}`;
      const isValid = await verifyMessage({
        address: author as `0x${string}`,
        message: expectedMessage,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return NextResponse.json(
          { success: false, error: "Invalid signature" },
          { status: 401 }
        );
      }

      if (!open) {
        return NextResponse.json({ success: true });
      }

      const contractAddress = NOTES_CONTRACT[baseSepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 }
        );
      }

      const { walletClient, publicClient } = getNotesClients();
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: Notes,
        functionName: "setOpened",
        args: [orderId, author, noteId],
        gas: BigInt(150000),
        maxPriorityFeePerGas: parseGwei("2"),
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      return NextResponse.json({ success: true, txHash });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
