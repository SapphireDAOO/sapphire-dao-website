"use client";

import { ReactNode, useState, useEffect } from "react";
import Container from "@/components/Container";
import useWalletRestriction from "@/hooks/useWalletRestriction";

interface ProtectedPageProps {
  children: ReactNode;
  allowEmergencyPauser?: boolean;
}

export default function ProtectedPage({
  children,
  allowEmergencyPauser = false,
}: ProtectedPageProps) {
  const {
    isAllowed: isAdmin,
    canAccessGovernance,
    walletConnected,
    isLoading,
  } = useWalletRestriction();
  const isAllowed = allowEmergencyPauser ? canAccessGovernance : isAdmin;
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (!walletConnected || !isLoading) {
      setIsInitialLoading(false);
    }
  }, [walletConnected, isLoading]);

  if (isInitialLoading) {
    return (
      <main>
        <Container>
          <div className="text-center mt-10">
            <h1 className="text-xl font-semibold text-muted-foreground">Loading...</h1>
            <p className="text-muted-foreground mt-2">
              Verifying wallet connection and authorization...
            </p>
          </div>
        </Container>
      </main>
    );
  }

  if (!walletConnected) {
    return (
      <main>
        <Container>
          <div className="text-center mt-10">
            <h1 className="text-xl font-semibold text-destructive">
              No Wallet Detected
            </h1>
            <p className="text-muted-foreground mt-2">
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
            <h1 className="text-xl font-semibold text-destructive">
              Access Denied
            </h1>
            <p className="text-muted-foreground mt-2">
              Your wallet is not authorized to view this page.
            </p>
          </div>
        </Container>
      </main>
    );
  }

  return <>{children}</>;
}
