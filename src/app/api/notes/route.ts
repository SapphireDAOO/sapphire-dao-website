import { NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseEventLogs,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { Notes } from "@/abis/Notes";
import { NOTES_CONTRACT } from "@/constants";
import { toEncryptedNoteHex } from "@/utils";

export const runtime = "nodejs";

const normalizePrivateKey = (value: string) =>
  value.startsWith("0x") ? value : `0x${value}`;

const getRpcUrl = () =>
  process.env.SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

const parseBigInt = (value: unknown, label: string) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} is required`);
  }

  try {
    return BigInt(value as string);
  } catch {
    throw new Error(`${label} must be a bigint value`);
  }
};

const getClients = () => {
  const privateKey =
    process.env.NOTES_SIGNER_PRIVATE_KEY || process.env.NOTES_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error("Missing NOTES_SIGNER_PRIVATE_KEY");
  }

  const account = privateKeyToAccount(
    normalizePrivateKey(privateKey) as `0x${string}`
  );

  const transport = http(getRpcUrl());

  return {
    account,
    publicClient: createPublicClient({ chain: sepolia, transport }),
    walletClient: createWalletClient({ account, chain: sepolia, transport }),
  };
};

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

      if (!content) {
        return NextResponse.json(
          { success: false, error: "Note content is required" },
          { status: 400 }
        );
      }

      const contractAddress = NOTES_CONTRACT[sepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 }
        );
      }

      const { walletClient, publicClient } = getClients();
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: Notes,
        functionName: "createNote",
        args: [orderId, author, toEncryptedNoteHex(content), share],
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
        noteId = created ? created.toString() : undefined;
      } catch {
        noteId = undefined;
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

      const contractAddress = NOTES_CONTRACT[sepolia.id];
      if (!contractAddress) {
        return NextResponse.json(
          { success: false, error: "Notes contract not configured" },
          { status: 500 }
        );
      }

      const { walletClient, publicClient } = getClients();
      const txHash = await walletClient.writeContract({
        address: contractAddress,
        abi: Notes,
        functionName: "setOpened",
        args: [orderId, noteId, open],
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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
