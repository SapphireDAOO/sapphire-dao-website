import { createConfig, http, fallback } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { polygonAmoy } from "wagmi/chains";

const apiKey = process.env.NEXT_PUBLIC_INFURA_ID;
const walletConnectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;
const config = createConfig(
  getDefaultConfig({
    chains: [polygonAmoy],
    transports: {
      [polygonAmoy.id]: fallback([
        http(`https://polygon-amoy.infura.io/v3/${apiKey}`),
      ]),
    },
    // Define the application name displayed in wallets
    appName: "Sapphire DAO Invoice",
    // Provide the WalletConnect Project ID for WalletConnect integration
    walletConnectProjectId: walletConnectId,
  })
);
export default config;
