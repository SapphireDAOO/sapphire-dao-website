import Web3Provider from "@/components/Web3Provider";
import Navbar from "@/components/Navigation";
import Footer from "@/components/Footer";
import WalletHint from "@/components/wallet-hint/WalletHint";
import SignInGate from "@/components/SignInGate";
import { Toaster } from "sonner";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Web3Provider>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="flex-1">
          <SignInGate>{children}</SignInGate>
        </div>
        <Footer />
      </div>
      <WalletHint />
      <Toaster position="bottom-right" richColors />
    </Web3Provider>
  );
}
