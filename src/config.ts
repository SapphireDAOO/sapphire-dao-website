import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "viem";
import { sepolia } from "viem/chains";

const apiKey = process.env.NEXT_PUBLIC_INFURA_ID;
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

type GlobalWithConfig = typeof globalThis & {
  sapphireWagmiConfig?: ReturnType<typeof getDefaultConfig>;
};

const globalForConfig = globalThis as GlobalWithConfig;

const config =
  globalForConfig.sapphireWagmiConfig ??
  getDefaultConfig({
    appName: "Sapphire DAO Invoice",
    projectId: walletConnectId,
    chains: [sepolia],
    ssr: true,
    transports: {
      [sepolia.id]: fallback([http(`https://sepolia.infura.io/v3/${apiKey}`)]),
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForConfig.sapphireWagmiConfig = config;
}

export default config;
