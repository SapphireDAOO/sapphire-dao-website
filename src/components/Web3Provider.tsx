"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import config from "@/config";
import { ConnectKitProvider } from "connectkit";
import WalletProvider from "./wallet-provider";

// Create a new QueryClient instance for React Query
const queryClient = new QueryClient();

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
        <ConnectKitProvider debugMode>
          <WalletProvider>{children}</WalletProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default Web3Provider;
