import { createConfig, http, fallback } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { sepolia } from "wagmi/chains";

const apiKey = process.env.NEXT_PUBLIC_INFURA_ID;
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;
const config = createConfig(
  getDefaultConfig({
    chains: [sepolia],
    transports: {
      [sepolia.id]: fallback([
        http(`https://sepolia.infura.io/v3/${apiKey}`),
      ]),
    },
    // Define the application name displayed in wallets
    appName: "Sapphire DAO Invoice",
    // Provide the WalletConnect Project ID for WalletConnect integration
    walletConnectProjectId: walletConnectId,
  })
);
export default config;
