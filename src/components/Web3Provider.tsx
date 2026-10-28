"use client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConfig } from "wagmi";
import config from "@/config";
import ConnectWalletProvider from "@/components/wallet/ConnectWalletProvider";
import { reconnectRecentWallet } from "@/lib/mountReconnect";
import WalletProvider from "./WalletProvider";
import SignInProvider from "./SignInProvider";
import {
  DEFAULT_QUERY_GC_TIME_MS,
  DEFAULT_QUERY_STALE_TIME_MS,
} from "@/constants";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_QUERY_STALE_TIME_MS,
      gcTime: DEFAULT_QUERY_GC_TIME_MS,
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

const MountReconnect = () => {
  const wagmiConfig = useConfig();
  useEffect(() => {
    void reconnectRecentWallet(wagmiConfig);
  }, [wagmiConfig]);
  return null;
};

const Web3Provider = ({
  children,
  promptSignIn = true,
}: {
  children: React.ReactNode;
  promptSignIn?: boolean;
}) => {
  return (
    // wagmi's own reconnect starts every wallet; MountReconnect starts the last one.
    <WagmiProvider config={config} reconnectOnMount={false}>
      <QueryClientProvider client={queryClient}>
        <MountReconnect />
        <ConnectWalletProvider>
          <SignInProvider promptOnConnect={promptSignIn}>
            <WalletProvider>{children}</WalletProvider>
          </SignInProvider>
        </ConnectWalletProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default Web3Provider;
