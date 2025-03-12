import type { Metadata } from "next";
import "@/styles/globals.css";
import Web3Provider from "@/components/Web3Provider";
import Navbar from "@/components/Navigation";
import { Toaster } from "sonner";

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
          <Navbar />
          {children}
          <Toaster position="bottom-right" richColors />
        </Web3Provider>
      </body>
    </html>
  );
}
