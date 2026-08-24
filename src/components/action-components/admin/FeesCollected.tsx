"use client";

import { formatUnits } from "viem";
import { useChainId } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw } from "lucide-react";
import { BASE_SEPOLIA, getKnownPaymentToken } from "@/constants";
import { useFeeBalances } from "@/hooks/useFeeBalances";
import {
  formatAddress,
  formatTimestamp,
} from "@/components/action-components/multisig/decodeCalldata";

/**
 * Platform fees that have been credited to fee receivers but not yet swept,
 * totalled per token. Sweeping them is a multisig action and lives on the
 * multisig page.
 */
export default function FeesCollected() {
  const chainId = useChainId() || BASE_SEPOLIA;
  const { tokens, sweeps, truncated, isLoading, error, notIndexed, refresh } =
    useFeeBalances();

  const totalReceivers = tokens.reduce((sum, t) => sum + t.receiverCount, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Fees Collected</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Unswept platform fees held across {totalReceivers} fee{" "}
              {totalReceivers === 1 ? "receiver" : "receivers"}.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading && tokens.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              Loading fee balances…
            </p>
          )}

          {!isLoading && error && (
            <p className="text-sm text-muted-foreground py-4">
              {notIndexed
                ? "Fee receivers are not indexed by this subgraph deployment yet, so balances cannot be shown."
                : error}
            </p>
          )}

          {!isLoading && !error && tokens.length === 0 && (
            <p className="text-sm text-muted-foreground py-4">
              No unswept fees. Fee receivers are credited when an invoice&apos;s
              fee is paid out at release or dispute settlement.
            </p>
          )}

          {tokens.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Unswept</TableHead>
                  <TableHead className="text-right">Accrued</TableHead>
                  <TableHead className="text-right">Swept</TableHead>
                  <TableHead className="text-right">Receivers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((token) => (
                  <TableRow key={token.tokenId}>
                    <TableCell>
                      <div className="font-medium">{token.symbol}</div>
                      <a
                        href={`https://sepolia.basescan.org/address/${token.sweepToken}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-blue-500 underline"
                      >
                        {formatAddress(token.sweepToken)}
                      </a>
                      {token.sweepToken.toLowerCase() !==
                        token.tokenId.toLowerCase() && (
                        <p className="text-xs text-muted-foreground">
                          held as wrapped native
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatUnits(token.balance, token.decimals)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatUnits(token.accrued, token.decimals)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {formatUnits(token.swept, token.decimals)}
                    </TableCell>
                    <TableCell className="text-right">
                      {token.receiverCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {truncated && (
            <p className="text-xs text-muted-foreground mt-3">
              Showing the largest balances only — more fee receivers exist than
              this view loads, so the totals are a lower bound.
            </p>
          )}
        </CardContent>
      </Card>

      {sweeps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Sweeps</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">When</TableHead>
                  <TableHead className="text-center">From</TableHead>
                  <TableHead className="text-center">To</TableHead>
                  <TableHead className="text-center">Amount</TableHead>
                  <TableHead className="text-center">Token</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sweeps.map((sweep) => {
                  const known = getKnownPaymentToken(chainId, sweep.token.id);
                  const decimals = known?.decimals ?? sweep.token.decimal ?? 18;
                  const symbol = known?.name ?? sweep.token.name ?? "";
                  return (
                    <TableRow key={sweep.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <a
                          href={`https://sepolia.basescan.org/tx/${sweep.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-foreground hover:underline"
                        >
                          {formatTimestamp(sweep.timestamp)}
                        </a>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <a
                          href={`https://sepolia.basescan.org/address/${sweep.feeReceiver.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 underline"
                        >
                          {formatAddress(sweep.feeReceiver.address)}
                        </a>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        <a
                          href={`https://sepolia.basescan.org/address/${sweep.destination}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 underline"
                        >
                          {formatAddress(sweep.destination)}
                        </a>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums whitespace-nowrap">
                        {formatUnits(BigInt(sweep.amount), decimals)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {symbol}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
