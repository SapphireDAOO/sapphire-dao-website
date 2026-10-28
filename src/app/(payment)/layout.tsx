import Web3Provider from "@/components/Web3Provider";
import WalletHint from "@/components/wallet-hint/WalletHint";
import { Toaster } from "sonner";

// Payers arrive from a payment link, often with no wallet yet, so
// these pages skip the app's navigation and its sign-in gate.
export default function PaymentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <Web3Provider promptSignIn={false}>
      {children}
      <WalletHint />
      <Toaster position="bottom-center" richColors />
    </Web3Provider>
  );
}
