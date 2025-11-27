"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import config from "@/config";
import WalletProvider from "./wallet-provider";

// Create a new QueryClient instance for React Query
const queryClient = new QueryClient();

const blackTheme = (() => {
  const base = darkTheme({
    accentColor: "#000000",
    accentColorForeground: "#ffffff",
    borderRadius: "large",
  });

  return {
    ...base,
    colors: {
      ...base.colors,
      accentColor: "#000000",
      accentColorForeground: "#ffffff",
      connectButtonBackground: "#000000",
      connectButtonText: "#ffffff",
      profileForeground: "#0a0a0a",
      modalBackground: "#0a0a0a",
      modalBorder: "#111111",
      generalBorder: "#111111",
    },
  };
})();

/**
 * Web3Provider Component
 * Wraps the application in necessary providers for blockchain and wallet functionality.
 *
 * @param {Object} props - The props for the component.
 * @param {React.ReactNode} props.children - The child components to render inside the provider.
 * @returns {JSX.Element} - A provider-wrapped component tree.
 */
const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={blackTheme}>
          <WalletProvider>{children}</WalletProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default Web3Provider;
