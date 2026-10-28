"use client";

import {
  http,
  webSocket,
  fallback,
  type Chain,
  type Transport,
} from "viem";
import { baseSepolia, hardhat } from "viem/chains";
import { createConfig, createConnector } from "wagmi";
import { metaMask, safe, walletConnect } from "wagmi/connectors";
import { LOCAL_CHAIN_ENABLED } from "@/constants";
import { isMobileBrowser } from "@/lib/walletApp";

const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const APP_NAME = "Sapphire DAO Invoice";

// Wallets check a request against the page it came from, which varies by deploy.
const APP_URL =
  typeof window === "undefined"
    ? "https://app.sapphiredaotesting.com"
    : window.location.origin;

// WalletConnect clients sharing a storage namespace share a relay identity,
// and the relay then misroutes responses between them.
const WALLETCONNECT_STORAGE_PREFIX = "sapphire";

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

const chains: readonly [Chain, ...Chain[]] = withLocalChain
  ? [baseSepolia, hardhat]
  : [baseSepolia];

const transports: Record<number, Transport> = withLocalChain
  ? { [baseSepolia.id]: baseSepoliaTransport, [hardhat.id]: localTransport }
  : { [baseSepolia.id]: baseSepoliaTransport };

const walletConnectParameters = {
  projectId: walletConnectId,
  metadata: {
    name: APP_NAME,
    description: "Invoices and escrow payments on Base",
    url: APP_URL,
    icons: [`${APP_URL}/favicon.ico`],
  },
  telemetryEnabled: false,
};

/**
 * WalletConnect for one wallet app on a phone without an extension. The
 * picker opens the app with its own link, like Uniswap's own wallet.
 */
const walletAppConnector = (id: string, name: string) =>
  createConnector((wagmiConfig) => ({
    ...walletConnect({
      ...walletConnectParameters,
      showQrModal: false,
      customStoragePrefix: `${WALLETCONNECT_STORAGE_PREFIX}-${id}`,
    })(wagmiConfig),
    id,
    name,
  }));

// Wallets in this browser join through EIP-6963 discovery, which wagmi runs by
// default; these cover a phone browser, a desktop without an extension, and Safe.
const createWagmiConfig = () =>
  createConfig({
    chains,
    connectors: [
      metaMask({
        dapp: { name: APP_NAME, url: APP_URL, iconUrl: `${APP_URL}/favicon.ico` },
      }),
      walletConnect({
        ...walletConnectParameters,
        customStoragePrefix: WALLETCONNECT_STORAGE_PREFIX,
      }),
      safe(),
      ...(isMobileBrowser()
        ? [
            walletAppConnector("rainbowWalletConnect", "Rainbow"),
            walletAppConnector("zerionWalletConnect", "Zerion"),
          ]
        : []),
    ],
    ssr: false,
    transports,
  });

type GlobalWithConfig = typeof globalThis & {
  sapphireWagmiConfig?: ReturnType<typeof createWagmiConfig>;
};

const globalForConfig = globalThis as GlobalWithConfig;

const config = globalForConfig.sapphireWagmiConfig ?? createWagmiConfig();

if (process.env.NODE_ENV !== "production") {
  globalForConfig.sapphireWagmiConfig = config;
}

export default config;
