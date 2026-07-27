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

// remove NEXT_PUBLIC_*
const apiKey = process.env.NEXT_PUBLIC_INFURA_ID;
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

const isProduction = process.env.NODE_ENV === "production";

const baseSepoliaTransport = fallback(
  [
    // Prefer websocket endpoints for live updates, keep HTTP as backup
    webSocket("wss://base-sepolia-rpc.publicnode.com"),
    ...(apiKey
      ? [webSocket(`wss://base-sepolia.infura.io/ws/v3/${apiKey}`)]
      : []),
    http("https://base-sepolia-rpc.publicnode.com"),
    http("https://sepolia.base.org"),
    ...(apiKey ? [http(`https://base-sepolia.infura.io/v3/${apiKey}`)] : []),
  ],
  {
    rank: false, // keep order: public first, Infura last to reduce 429s
    retryCount: 1,
  },
);

const config =
  globalForConfig.sapphireWagmiConfig ??
  getDefaultConfig({
    appName: "Sapphire DAO Invoice",
    projectId: walletConnectId,
    chains: isProduction ? [baseSepolia] : [baseSepolia, hardhat],
    wallets,
    ssr: false,
    transports: isProduction
      ? { [baseSepolia.id]: baseSepoliaTransport }
      : {
          [baseSepolia.id]: baseSepoliaTransport,
          [hardhat.id]: http("http://127.0.0.1:8545"),
        },
  });

if (process.env.NODE_ENV !== "production") {
  globalForConfig.sapphireWagmiConfig = config;
}

export default config;
