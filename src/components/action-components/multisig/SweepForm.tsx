"use client";

import { useMemo, useState } from "react";
import { formatUnits, parseUnits, type Address, type Log } from "viem";
import { usePublicClient } from "wagmi";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { SweepPlan, TokenFeeSummary } from "@/model/fees";
import { planSweep } from "@/services/fees/planSweep";
import { proposeSweep } from "@/services/blockchain/Sweeper";
import { formatAddress } from "./decodeCalldata";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";

const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

interface Props {
  tokens: TokenFeeSummary[];
  chainId: number;
  isSigner: boolean;
  onProposed: (logs: readonly Log[]) => void;
}

export default function SweepForm({
  tokens,
  chainId,
  isSigner,
  onProposed,
}: Props) {
  const { data: walletClient } = useHintedWalletClient();
  const publicClient = usePublicClient({ chainId });

  const [tokenId, setTokenId] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [isLoading, setIsLoading] = useState("");

  const token = tokens.find((t) => t.tokenId === tokenId);

  // Parsed on every render so the preview and the proposal always agree on the
  // exact base-unit amount the user asked for.
  const requested = useMemo(() => {
    if (!token || !amount.trim()) return null;
    try {
      const parsed = parseUnits(amount.trim(), token.decimals);
      return parsed > BigInt(0) ? parsed : null;
    } catch {
      return null;
    }
  }, [amount, token]);

  const exceedsBalance = !!token && !!requested && requested > token.balance;

  const plan = useMemo(() => {
    if (!token || !requested || exceedsBalance) return null;
    return planSweep(token.receivers, requested);
  }, [token, requested, exceedsBalance]);

  const handleTokenChange = (value: string) => {
    setTokenId(value);
    setAmount("");
  };

  const handleSweepAll = () => {
    if (!token) return;
    setAmount(formatUnits(token.balance, token.decimals));
  };

  const destinationValid = ADDRESS_PATTERN.test(destination.trim());
  const canPropose =
    !!token &&
    !!plan &&
    plan.shortfall === BigInt(0) &&
    plan.sources.length > 0 &&
    destinationValid &&
    !!walletClient &&
    !!publicClient &&
    !isLoading;

  const handlePropose = async () => {
    if (!token || !plan || !walletClient || !publicClient) return;
    if (!destinationValid) {
      toast.error("Enter a valid destination address");
      return;
    }

    const { ok, receipt } = await proposeSweep(
      { walletClient, publicClient },
      chainId,
      token.sweepToken,
      plan.sources,
      destination.trim() as Address,
      setIsLoading,
    );

    if (ok) {
      if (receipt) onProposed(receipt.logs);
      setAmount("");
    }
  };

  if (tokens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        There are no unswept fees to sweep.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Token</Label>
        <Select value={tokenId} onValueChange={handleTokenChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select token" />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem key={t.tokenId} value={t.tokenId}>
                {t.symbol} — {formatUnits(t.balance, t.decimals)} available
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {token && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="sweepAmount">Amount</Label>
            <button
              type="button"
              onClick={handleSweepAll}
              className="text-xs text-blue-500 hover:underline"
            >
              Sweep all ({formatUnits(token.balance, token.decimals)}{" "}
              {token.symbol})
            </button>
          </div>
          <Input
            id="sweepAmount"
            placeholder={`Amount in ${token.symbol}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {amount.trim() && !requested && !exceedsBalance && (
            <p className="text-xs text-red-600">
              Enter a positive amount with at most {token.decimals} decimal
              places.
            </p>
          )}
          {exceedsBalance && (
            <p className="text-xs text-red-600">
              Only {formatUnits(token.balance, token.decimals)} {token.symbol} is
              held across all fee receivers.
            </p>
          )}
        </div>
      )}

      {token && (
        <div className="space-y-1.5">
          <Label htmlFor="sweepDestination">Destination</Label>
          <Input
            id="sweepDestination"
            placeholder="0x..."
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Every selected receiver sends its share here in one transaction.
          </p>
          {destination.trim() && !destinationValid && (
            <p className="text-xs text-red-600">Not a valid address.</p>
          )}
        </div>
      )}

      {token && plan && <SweepPreview plan={plan} token={token} />}

      {token && (
        <>
          <Button
            className="w-full"
            onClick={handlePropose}
            disabled={!canPropose}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Propose Sweep"
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            The Sweeper only accepts calls from the multisig, so this is
            proposed as a multisig transaction and runs once enough signers
            approve it.
            {!isSigner &&
              " Your connected wallet is not an active signer, so the proposal will be rejected."}
          </p>
        </>
      )}
    </div>
  );
}

function SweepPreview({
  plan,
  token,
}: {
  plan: SweepPlan;
  token: TokenFeeSummary;
}) {
  const drained = plan.sources.filter((s) => s.drained).length;

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {plan.sources.length}{" "}
          {plan.sources.length === 1 ? "receiver" : "receivers"} ·{" "}
          {formatUnits(plan.total, token.decimals)} {token.symbol}
        </p>
        {drained > 0 && (
          <Badge variant="outline" className="font-normal">
            {drained} fully drained
          </Badge>
        )}
      </div>

      {plan.shortfall > BigInt(0) && (
        <p className="text-xs text-red-600">
          The receivers can only cover {formatUnits(plan.total, token.decimals)}{" "}
          {token.symbol} — short by{" "}
          {formatUnits(plan.shortfall, token.decimals)}.
        </p>
      )}

      <div className="max-h-56 overflow-y-auto space-y-1">
        {plan.sources.map((source) => (
          <div
            key={source.address}
            className="flex items-center justify-between text-xs font-mono"
          >
            <a
              href={`https://sepolia.basescan.org/address/${source.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {formatAddress(source.address)}
            </a>
            <span>
              {formatUnits(source.amount, token.decimals)}
              {!source.drained && (
                <span className="text-muted-foreground">
                  {" "}
                  of {formatUnits(source.available, token.decimals)}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
