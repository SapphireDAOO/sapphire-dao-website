"use client";

import { useCallback, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { BASE_SEPOLIA } from "@/constants";
import { useEmergencyPause } from "@/hooks/useEmergencyPause";
import { emergencyPause as sendEmergencyPause } from "@/services/blockchain/PaymentProcessorStorage";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";
import { formatDurationSeconds, unixToGMT } from "@/utils";

const truncateAddress = (address: string | undefined) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading...";

const EmergencyPause = () => {
  useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: walletClient } = useHintedWalletClient();
  const publicClient = usePublicClient({ chainId });

  const {
    isPaused,
    pauseExpiry,
    emergencyPauser,
    pauseDuration,
    canPause,
    refetch,
  } = useEmergencyPause();

  const [loadingAction, setLoadingAction] = useState("");
  // Halting the whole protocol should never be one stray click away.
  const [confirming, setConfirming] = useState(false);

  const isPausing = loadingAction === "emergencyPause";

  const handlePause = useCallback(async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    if (!walletClient || !publicClient) return;

    const ok = await sendEmergencyPause(
      { walletClient, publicClient },
      chainId,
      setLoadingAction,
    );
    setConfirming(false);
    if (ok) await refetch();
  }, [confirming, walletClient, publicClient, chainId, refetch]);

  const expirySeconds = pauseExpiry ? Number(pauseExpiry) : 0;
  const secondsRemaining = expirySeconds
    ? expirySeconds - Math.floor(Date.now() / 1000)
    : 0;

  return (
    <Card className="w-full border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-red-700 dark:text-red-400">
          Emergency Pause
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Immediately halts payment processing. This is sent straight from your
          wallet, not proposed to the multisig, so it takes effect as soon as
          the transaction confirms.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current state */}
        {isPaused === undefined ? (
          <p className="text-sm text-muted-foreground">Loading status...</p>
        ) : isPaused ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
            <div className="space-y-1">
              <p className="text-sm font-bold leading-tight text-red-900 dark:text-red-300">
                Payments are paused
              </p>
              {secondsRemaining > 0 ? (
                <p className="text-xs leading-snug text-red-800 dark:text-red-400">
                  Lapses in {formatDurationSeconds(secondsRemaining)} (
                  {unixToGMT(expirySeconds)} UTC) unless governance lifts or
                  extends it from the multisig page.
                </p>
              ) : (
                <p className="text-xs leading-snug text-red-800 dark:text-red-400">
                  Lifting the pause is a governance action, proposed and
                  approved on the multisig page.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-300 bg-green-50 p-3 dark:border-green-900 dark:bg-green-950/30">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />
            <p className="text-sm font-medium leading-tight text-green-900 dark:text-green-300">
              Payments are running normally
            </p>
          </div>
        )}

        <p className="text-sm font-medium">
          <span className="text-muted-foreground">Emergency Pauser: </span>
          <span className="font-mono text-primary">
            {emergencyPauser ? (
              <a
                href={`https://sepolia.basescan.org/address/${emergencyPauser}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 underline"
              >
                {truncateAddress(emergencyPauser)}
              </a>
            ) : (
              "Loading..."
            )}
          </span>
        </p>

        {confirming && !isPaused && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/30">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400" />
            <div className="space-y-1">
              <p className="text-sm font-bold leading-tight text-red-900 dark:text-red-300">
                Pause all payment processing?
              </p>
              <p className="text-xs leading-snug text-red-800 dark:text-red-400">
                Every invoice action stops for
                {pauseDuration
                  ? ` ${formatDurationSeconds(Number(pauseDuration))}`
                  : " the emergency pause duration"}
                , or until governance lifts it. Only do this to contain an
                active incident.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="destructive"
            onClick={handlePause}
            disabled={!canPause || isPaused !== false || isPausing}
            aria-busy={isPausing}
          >
            {isPausing ? (
              <Loader2 className="inline-flex h-4 w-4 animate-spin" />
            ) : confirming ? (
              "Confirm pause"
            ) : (
              "Pause payments"
            )}
          </Button>

          {confirming && !isPausing && (
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          )}
        </div>

        {!canPause && (
          <p className="text-sm text-muted-foreground">
            Only the emergency pauser address above can trigger this. Connect
            that wallet to enable the button.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default EmergencyPause;
