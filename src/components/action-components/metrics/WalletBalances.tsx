"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Wallet, ExternalLink } from "lucide-react";
import { formatAddress } from "@/lib/formatUtils";
import { METRIC_PLACEHOLDER } from "./formatMetric";
import { useWalletBalances } from "@/hooks/useWalletBalances";

const explorerAddressUrl = (address: string): string =>
  `https://sepolia.basescan.org/address/${address}`;

export function WalletBalances() {
  const { items } = useWalletBalances();

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="h-4 w-4 text-primary" />
          Wallet &amp; Contract Balances
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div
            key={item.name}
            className="flex items-center justify-between rounded-lg bg-secondary/50 p-3 transition-colors hover:bg-secondary"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{item.name}</span>
                {item.address && (
                  <a
                    href={explorerAddressUrl(item.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`View ${item.name} on the block explorer`}
                    className="text-muted-foreground transition hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {item.address
                  ? formatAddress(item.address)
                  : METRIC_PLACEHOLDER}
              </span>
            </div>
            <div className="text-right">
              {item.isLoading ? (
                <div className="ml-auto h-5 w-20 animate-pulse rounded bg-muted" />
              ) : (
                <>
                  <div className="font-mono font-medium">{item.primary}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.secondary}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
