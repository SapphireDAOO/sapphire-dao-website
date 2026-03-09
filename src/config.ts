"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, webSocket, fallback } from "viem";
import { baseSepolia } from "viem/chains";

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
      safeWallet,
      rainbowWallet,
      walletConnectWallet,
      zerionWallet,
    ],
  },
];

const config =
  globalForConfig.sapphireWagmiConfig ??
  getDefaultConfig({
    appName: "Sapphire DAO Invoice",
    projectId: walletConnectId,
    chains: [baseSepolia],
    wallets,
    ssr: false,
    transports: {
      [baseSepolia.id]: fallback(
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
        }
      ),
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForConfig.sapphireWagmiConfig = config;
}

export default config;
