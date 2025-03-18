"use client";

import { ReactNode } from "react";
import Container from "@/components/Container";
import useWalletRestriction from "@/hooks/useWalletRestriction";

interface ProtectedPageProps {
  children: ReactNode;
}

export default function ProtectedPage({ children }: ProtectedPageProps) {
  const { isAllowed, walletConnected } = useWalletRestriction();

  if (!walletConnected) {
    return (
      <main>
        <Container>
          <div className="text-center mt-10">
            <h1 className="text-xl font-semibold text-red-500">
              No Wallet Detected
            </h1>
            <p className="text-gray-600 mt-2">
              Please connect your Ethereum wallet to access this page.
            </p>
          </div>
        </Container>
      </main>
    );
  }

  if (!isAllowed) {
    return (
      <main>
        <Container>
          <div className="text-center mt-10">
            <h1 className="text-xl font-semibold text-red-500">
              Access Denied
            </h1>
            <p className="text-gray-600 mt-2">
              Your wallet is not authorized to view this page.
            </p>
          </div>
        </Container>
      </main>
    );
  }

  return <>{children}</>;
}
