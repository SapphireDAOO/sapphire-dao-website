import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, hardhat } from "viem/chains";

type NotesClients = ReturnType<typeof createNotesClients>;
let cachedClients: NotesClients | null = null;
let cachedClientKey = "";

// use better approach
const normalizePrivateKey = (value: string) =>
  value.startsWith("0x") ? value : `0x${value}`;

// Server-only: set BASE_SEPOLIA_RPC_URL (no NEXT_PUBLIC_ prefix) so a keyed
// RPC endpoint never gets inlined into the client bundle.
const getRpcUrl = (chainId: number) =>
  chainId === hardhat.id
    ? "http://127.0.0.1:8545"
    : process.env.BASE_SEPOLIA_RPC_URL ||
      "https://base-sepolia-rpc.publicnode.com";

const getChain = (chainId: number) =>
  chainId === hardhat.id ? hardhat : baseSepolia;

const createNotesClients = (chainId: number) => {
  const privateKey =
    process.env.NOTES_SIGNER_PRIVATE_KEY || process.env.NOTES_SIGNER;

  if (!privateKey) {
    throw new Error("Missing NOTES_SIGNER_PRIVATE_KEY");
  }

  const account = privateKeyToAccount(
    normalizePrivateKey(privateKey) as `0x${string}`
  );

  const chain = getChain(chainId);
  const transport = http(getRpcUrl(chainId));

  return {
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  };
};

export const getNotesClients = (chainId: number) => {
  const privateKey =
    process.env.NOTES_SIGNER_PRIVATE_KEY || process.env.NOTES_SIGNER;
  const rpcUrl = getRpcUrl(chainId);
  // Chain is part of the key: the same RPC string must not hand back clients
  // pointed at a different chain.
  const clientKey = `${chainId}:${rpcUrl}:${privateKey ?? ""}`;

  if (!cachedClients || cachedClientKey !== clientKey) {
    cachedClients = createNotesClients(chainId);
    cachedClientKey = clientKey;
  }

  return cachedClients;
};

export const parseBigInt = (value: unknown, label: string): bigint => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${label} is required`);
  }
  try {
    return BigInt(value as string);
  } catch {
    throw new Error(`${label} must be a bigint value`);
  }
};
