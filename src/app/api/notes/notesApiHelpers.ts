import {
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const normalizePrivateKey = (value: string) =>
  value.startsWith("0x") ? value : `0x${value}`;

const getRpcUrl = () =>
  process.env.BASE_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
  "https://base-sepolia-rpc.publicnode.com";

export const getNotesClients = () => {
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
    publicClient: createPublicClient({ chain: baseSepolia, transport }),
    walletClient: createWalletClient({ account, chain: baseSepolia, transport }),
  };
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
