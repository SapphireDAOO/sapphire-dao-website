import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { http, webSocket, fallback } from "viem";
import { sepolia } from "viem/chains";

const apiKey = process.env.NEXT_PUBLIC_INFURA_ID;
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

type GlobalWithConfig = typeof globalThis & {
  sapphireWagmiConfig?: ReturnType<typeof getDefaultConfig>;
};

const globalForConfig = globalThis as GlobalWithConfig;

const wallets = [
  {
    groupName: "Popular",
    wallets: [safeWallet, rainbowWallet, metaMaskWallet, walletConnectWallet],
  },
];

const config =
  globalForConfig.sapphireWagmiConfig ??
  getDefaultConfig({
    appName: "Sapphire DAO Invoice",
    projectId: walletConnectId,
    chains: [sepolia],
    wallets,
    ssr: true,
    transports: {
      [sepolia.id]: fallback(
        [
          // Prefer websocket endpoints for live updates, keep HTTP as backup
          webSocket("wss://ethereum-sepolia-rpc.publicnode.com"),
          webSocket("wss://sepolia.gateway.tenderly.co"),
          ...(apiKey
            ? [webSocket(`wss://sepolia.infura.io/ws/v3/${apiKey}`)]
            : []),
          http("https://ethereum-sepolia-rpc.publicnode.com"),
          http("https://sepolia.gateway.tenderly.co"),
          ...(apiKey ? [http(`https://sepolia.infura.io/v3/${apiKey}`)] : []),
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
