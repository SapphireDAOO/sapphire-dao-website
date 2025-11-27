import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http, fallback } from "viem";
import { sepolia } from "viem/chains";

const apiKey = process.env.NEXT_PUBLIC_INFURA_ID;
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

const config = getDefaultConfig({
  appName: "Sapphire DAO Invoice",
  projectId: walletConnectId,
  chains: [sepolia],
  ssr: true,
  transports: {
    [sepolia.id]: fallback([http(`https://sepolia.infura.io/v3/${apiKey}`)]),
  },
});

export default config;