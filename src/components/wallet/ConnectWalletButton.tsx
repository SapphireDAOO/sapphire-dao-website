"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useConfig,
  useConnection,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { ChevronDown, Wallet } from "lucide-react";
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
        <Button
          variant="outline"
          className={cn("gap-2 bg-background px-1.5 pr-2.5", className)}
        >
          <span className="relative grid size-6 place-items-center bg-primary/10 text-primary">
            <Wallet className="size-3.5" aria-hidden />
            <span
              aria-hidden
              className={cn(
                "absolute -right-0.5 -top-0.5 size-2 rounded-full ring-2 ring-background",
                wrongNetwork ? "bg-destructive" : "bg-success",
              )}
            />
          </span>
          <span className="font-mono text-xs">{formatAddress(address)}</span>
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
