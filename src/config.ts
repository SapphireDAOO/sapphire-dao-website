"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  phantomWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, webSocket, fallback } from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { LOCAL_CHAIN_ENABLED } from "@/constants";

const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

type GlobalWithConfig = typeof globalThis & {
  sapphireWagmiConfig?: ReturnType<typeof getDefaultConfig>;
};

const globalForConfig = globalThis as GlobalWithConfig;

const wallets = [
  {
    groupName: "Popular",
    wallets: [
      metaMaskWallet,
      phantomWallet,
      safeWallet,
      rainbowWallet,
      walletConnectWallet,
      zerionWallet,
    ],
  },
];

// See LOCAL_CHAIN_ENABLED: a static export is built as "production"
// regardless of where it will be served.
const withLocalChain = LOCAL_CHAIN_ENABLED;

const baseSepoliaTransport = fallback(
  [
    // Prefer websocket endpoints for live updates, keep HTTP as backup
    webSocket("wss://base-sepolia-rpc.publicnode.com"),
    http("https://base-sepolia-rpc.publicnode.com"),
    http("https://sepolia.base.org"),
  ],
  {
    rank: false, // keep order: websocket first, HTTP as backup
    retryCount: 1,
  },
);

const config =
  globalForConfig.sapphireWagmiConfig ??
  getDefaultConfig({
    appName: "Sapphire DAO Invoice",
    projectId: walletConnectId,
    chains: withLocalChain ? [baseSepolia, hardhat] : [baseSepolia],
    wallets,
    ssr: false,
    transports: withLocalChain
      ? {
          [baseSepolia.id]: baseSepoliaTransport,
          [hardhat.id]: http("http://127.0.0.1:8545"),
        }
      : { [baseSepolia.id]: baseSepoliaTransport },
  });

if (process.env.NODE_ENV !== "production") {
  globalForConfig.sapphireWagmiConfig = config;
}

export default config;
