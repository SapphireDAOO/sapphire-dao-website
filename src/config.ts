"use client";

import {
  getDefaultConfig,
  getWalletConnectConnector,
  type WalletList,
} from "@rainbow-me/rainbowkit";
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
import { createConnector } from "wagmi";
import { injected } from "wagmi/connectors";
import { LOCAL_CHAIN_ENABLED } from "@/constants";

const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

type GlobalWithConfig = typeof globalThis & {
  sapphireWagmiConfig?: ReturnType<typeof getDefaultConfig>;
};

const globalForConfig = globalThis as GlobalWithConfig;

type CreateWallet = WalletList[number]["wallets"][number];

// Skips the MetaMask SDK: on a phone, WalletConnect's relay keeps the app's
// answer while the browser is in the background, so it arrives on return.
const metaMask: CreateWallet = (options) => {
  const wallet = metaMaskWallet(options);
  if (wallet.installed) {
    return {
      ...wallet,
      createConnector: (details) =>
        createConnector((config) => ({
          ...injected({ target: "metaMask" })(config),
          ...details,
        })),
    };
  }
  return {
    ...wallet,
    mobile: {
      getUri: (uri) => `metamask://wc?uri=${encodeURIComponent(uri)}`,
    },
    createConnector: getWalletConnectConnector({
      projectId: options.projectId,
      walletConnectParameters: options.walletConnectParameters,
    }),
  };
};

// Connecting asks for the account only: a network switch chained onto it
// reopens a phone's wallet app without a tap, which browsers block.
const connectOnly =
  (createWallet: CreateWallet): CreateWallet =>
  (options) => {
    const wallet = createWallet(options);
    return {
      ...wallet,
      createConnector: (details) => (config) => {
        const connector = wallet.createConnector(details)(config);
        return {
          ...connector,
          connect: ((parameters) =>
            connector.connect({
              ...parameters,
              chainId: undefined,
            })) as typeof connector.connect,
        };
      },
    };
  };

const wallets: WalletList = [
  {
    groupName: "Popular",
    wallets: [
      metaMask,
      phantomWallet,
      safeWallet,
      rainbowWallet,
      walletConnectWallet,
      zerionWallet,
    ].map(connectOnly),
  },
];

const withLocalChain = LOCAL_CHAIN_ENABLED;

// Websocket first: viem only subscribes (rather than
// polling) when the first transport is a websocket.
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
    rank: false,
    retryCount: 1,
  },
);

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
