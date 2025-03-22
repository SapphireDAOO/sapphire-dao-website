"use client";

import { ReactNode, useState, useEffect } from "react";
import Container from "@/components/Container";
import useWalletRestriction from "@/hooks/useWalletRestriction";

interface ProtectedPageProps {
  children: ReactNode;
}

export default function ProtectedPage({ children }: ProtectedPageProps) {
  const { isAllowed, walletConnected } = useWalletRestriction();
  const [isInitialLoading, setIsInitialLoading] = useState(true); // Track initial load

  // Ensure loading state persists until wallet data is fully resolved
  useEffect(() => {
    if (walletConnected !== undefined && isAllowed !== undefined) {
      setIsInitialLoading(false); // Resolved when both are defined
    }
  }, [walletConnected, isAllowed]);

  // Show loading during initial resolution
  if (isInitialLoading) {
    return (
      <main>
        <Container>
          <div className="text-center mt-10">
            <h1 className="text-xl font-semibold text-gray-500">Loading...</h1>
            <p className="text-gray-600 mt-2">
              Verifying wallet connection and authorization...
            </p>
          </div>
        </Container>
      </main>
    );
  }

  // No wallet connected
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

  // Wallet connected but not allowed
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

  // Wallet connected and allowed
  return <>{children}</>;
}
