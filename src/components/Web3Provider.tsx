"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import config from "@/config";
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

const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={blackTheme}>
          <SignInProvider>
            <WalletProvider>{children}</WalletProvider>
          </SignInProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default Web3Provider;
