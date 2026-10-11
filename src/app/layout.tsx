import type { Metadata } from "next";
import "@/styles/globals.css";

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

// The wallet stack (wagmi, RainbowKit, WalletConnect) lives in the (app)
// route group's layout, not here: the home page has no use for it, and
// mounting it at the root made every route ship and boot it.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
