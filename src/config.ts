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

// Real-time updates ride on the websocket: viem only opens a subscription
// when the transport is a websocket, or a fallback whose *first* entry is one
// - anything else makes watchEvent poll eth_getLogs on a timer. So the order
// here is not cosmetic, and HTTP stays behind it purely as a fallback for
// when the socket cannot be established.
const BASE_SEPOLIA_WS =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_WS_URL ??
  "wss://base-sepolia-rpc.publicnode.com";
const BASE_SEPOLIA_HTTP =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ??
  "https://base-sepolia-rpc.publicnode.com";

const LOCAL_WS = process.env.NEXT_PUBLIC_LOCAL_WS_URL ?? "ws://127.0.0.1:8545";
const LOCAL_HTTP =
  process.env.NEXT_PUBLIC_LOCAL_RPC_URL ?? "http://127.0.0.1:8545";

const baseSepoliaTransport = fallback(
  [
    webSocket(BASE_SEPOLIA_WS),
    http(BASE_SEPOLIA_HTTP),
    http("https://sepolia.base.org"),
  ],
  {
    rank: false, // keep order: websocket first, HTTP as backup
    retryCount: 1,
  },
);

// A hardhat node serves websockets on its HTTP port, so the local chain gets
// the same live updates as a deployed one instead of falling back to polling.
const localTransport = fallback([webSocket(LOCAL_WS), http(LOCAL_HTTP)], {
  rank: false,
  retryCount: 1,
});

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
          [hardhat.id]: localTransport,
        }
      : { [baseSepolia.id]: baseSepoliaTransport },
  });

if (process.env.NODE_ENV !== "production") {
  globalForConfig.sapphireWagmiConfig = config;
}

export default config;
