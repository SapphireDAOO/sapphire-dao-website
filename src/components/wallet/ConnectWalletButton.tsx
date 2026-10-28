"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useConfig,
  useConnection,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConnectWalletModal } from "@/components/wallet/ConnectWalletProvider";
import { copyText } from "@/lib/clipboard";
import { formatAddress } from "@/lib/formatUtils";
import { cn } from "@/lib/utils";

/** Connects a wallet, or shows the connected one with its network and actions. */
const ConnectWalletButton = ({ className }: { className?: string }) => {
  const { address, chain, isConnected } = useConnection();
  const [network] = useConfig().chains;
  const { openConnectModal } = useConnectWalletModal();
  const { mutate: disconnect } = useDisconnect();
  const { mutate: switchChain, isPending: isSwitching } = useSwitchChain();

  // The connection is restored after the first render of the static page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !isConnected || !address) {
    return (
      <Button className={className} onClick={openConnectModal}>
        Connect Wallet
      </Button>
    );
  }

  // `chain` is only set on a configured network.
  const wrongNetwork = !chain;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* Its own text colour: the nav sets white text on everything inside it. */}
        <Button
          variant="outline"
          className={cn("gap-2 text-foreground", className)}
        >
          <span
            aria-hidden
            className={cn(
              "h-2 w-2 rounded-full",
              wrongNetwork ? "bg-red-500" : "bg-emerald-500",
            )}
          />
          <span className="font-mono">{formatAddress(address)}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal text-muted-foreground">
          {wrongNetwork ? "Wrong network" : chain.name}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {wrongNetwork && (
          <DropdownMenuItem
            disabled={isSwitching}
            onSelect={() => switchChain({ chainId: network.id })}
          >
            {isSwitching ? "Switching…" : `Switch to ${network.name}`}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onSelect={async () => {
            if (await copyText(address)) toast.success("Address copied!");
            else toast.error("Couldn't copy the address.");
          }}
        >
          Copy address
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => disconnect()}>
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ConnectWalletButton;
