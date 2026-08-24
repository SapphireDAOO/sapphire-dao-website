import type { Metadata } from "next";
import "@/styles/globals.css";
import "@rainbow-me/rainbowkit/styles.css";
import Web3Provider from "@/components/Web3Provider";
import Navbar from "@/components/Navigation";
import Footer from "@/components/Footer";
import WalletHint from "@/components/wallet-hint/WalletHint";
import { Toaster } from "sonner";

if (typeof globalThis.indexedDB === "undefined") {
  const stubIndexedDB = {
    open: () => {
      const request = {} as IDBOpenDBRequest;

      setTimeout(() => {
        const errorEvent = new Event("error");
        request.onerror?.call(request, errorEvent);
      }, 0);
      return request;
    },
    deleteDatabase: () => {
      const request = {} as IDBOpenDBRequest;
      setTimeout(() => {
        const errorEvent = new Event("error");
        request.onerror?.call(request, errorEvent);
      }, 0);
      return request;
    },
  } as unknown as IDBFactory;
  (globalThis as { indexedDB: IDBFactory }).indexedDB = stubIndexedDB;
}

export const metadata: Metadata = {
  title: "Sapphire DAO App",
  description: "Sapphire DAO application",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
          <WalletHint />
          <Toaster position="bottom-right" richColors />
        </Web3Provider>
      </body>
    </html>
  );
}
