"use client";

import type { ReactNode } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useConfig, useSwitchChain } from "wagmi";
import { Loader2 } from "lucide-react";
import Container from "@/components/Container";
import { Button } from "@/components/ui/button";
import { useSignIn } from "@/components/SignInProvider";

const GatePanel = ({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) => (
  <main>
    <Container>
      <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="text-gray-600">{body}</p>
        {children}
      </div>
    </Container>
  </main>
);

/** Renders the app only for a wallet signed in with Ethereum. */
const SignInGate = ({ children }: { children: ReactNode }) => {
  const { status, signIn } = useSignIn();
  const [network] = useConfig().chains;
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  switch (status) {
    case "signedIn":
      return <>{children}</>;
    case "connecting":
      return (
        <GatePanel title="Checking your wallet" body="One moment…">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </GatePanel>
      );
    case "walletPending":
      return (
        <GatePanel
          title="Still waiting for your wallet"
          body="If you approved the connection in your wallet app, come back to this tab. Otherwise, connect again."
        >
          <ConnectButton chainStatus="icon" showBalance={false} />
        </GatePanel>
      );
    case "disconnected":
      return (
        <GatePanel
          title="Connect your wallet"
          body="Sapphire DAO is only available to wallets that sign in."
        >
          <ConnectButton chainStatus="icon" showBalance={false} />
        </GatePanel>
      );
    case "unsupported":
      return (
        <GatePanel
          title="This wallet can't sign in"
          body="Smart-contract wallets can't sign in yet. Connect an ordinary wallet instead."
        >
          <ConnectButton chainStatus="icon" showBalance={false} />
        </GatePanel>
      );
    case "wrongNetwork":
      return (
        <GatePanel
          title="Switch network"
          body={`Switch your wallet to ${network.name} to sign in.`}
        >
          {/* Stays enabled: a phone can lose the request, and a tap resends it. */}
          <Button onClick={() => switchChain({ chainId: network.id })}>
            {isSwitching && <Loader2 className="h-4 w-4 animate-spin" />}
            Switch to {network.name}
          </Button>
        </GatePanel>
      );
    case "signingIn":
      return (
        <GatePanel
          title="Sign in with your wallet"
          body="Sign the message in your wallet to continue."
        >
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </GatePanel>
      );
    case "signedOut":
      return (
        <GatePanel
          title="Sign in to continue"
          body="Sign a message with your wallet to prove it's yours. It's free and doesn't move any funds."
        >
          <Button onClick={signIn}>Sign in</Button>
        </GatePanel>
      );
  }
};

export default SignInGate;
