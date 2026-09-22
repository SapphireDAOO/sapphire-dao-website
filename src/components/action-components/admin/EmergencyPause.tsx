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
import { ExternalLink, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { BASE_SEPOLIA } from "@/constants";
import { useEmergencyPause } from "@/hooks/useEmergencyPause";
import { usePauseState } from "@/hooks/usePauseState";
import type { PauseActionType } from "@/services/pauseState";
import {
  emergencyPause as sendEmergencyPause,
  emergencyUnpause as sendEmergencyUnpause,
} from "@/services/blockchain/PaymentProcessorStorage";
import { useHintedWalletClient } from "@/components/wallet-hint/useHintedWalletClient";
import { formatDurationSeconds, unixToGMT } from "@/utils";

const LAST_ACTION_LABEL: Record<PauseActionType, string> = {
  PAUSED: "Paused by",
  UNPAUSED: "Unpaused by",
  EMERGENCY_PAUSED: "Emergency paused by",
  EMERGENCY_PAUSE_APPROVED: "Emergency pause approved by",
};

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
  const isUnpausing = loadingAction === "emergencyUnpause";

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

  const handleUnpause = useCallback(async () => {
    if (!walletClient || !publicClient) return;

    const ok = await sendEmergencyUnpause(
      { walletClient, publicClient },
      chainId,
      setLoadingAction,
    );
    if (ok) await refetch();
  }, [walletClient, publicClient, chainId, refetch]);

  const { state: pauseState } = usePauseState();
  const lastAction = pauseState?.lastAction ?? undefined;

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
                  Lapses on its own in {formatDurationSeconds(secondsRemaining)}{" "}
                  ({unixToGMT(expirySeconds)} UTC), or lift it now with the
                  button below.
                </p>
              ) : (
                <p className="text-xs leading-snug text-red-800 dark:text-red-400">
                  This pause holds until it is lifted.
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

        {/* While paused, who did it and in which transaction is the useful
            detail, and only the subgraph has it - the contract exposes the
            current state but no history. Once running again that provenance is
            noise, so it collapses back to the designated pauser. */}
        {isPaused && lastAction ? (
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            <span className="text-muted-foreground">
              {LAST_ACTION_LABEL[lastAction] ?? "Last action"}:
            </span>
            {pauseState?.lastActionBy && (
              <a
                href={`https://sepolia.basescan.org/address/${pauseState.lastActionBy}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-blue-500 underline"
              >
                {truncateAddress(pauseState.lastActionBy)}
              </a>
            )}
            {pauseState?.lastActionAt && (
              <span className="text-xs text-muted-foreground">
                {unixToGMT(Number(pauseState.lastActionAt))} UTC
              </span>
            )}
            {pauseState?.lastActionTx && (
              <a
                href={`https://sepolia.basescan.org/tx/${pauseState.lastActionTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-blue-500 underline"
              >
                tx
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
        ) : (
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
        )}

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
          {isPaused ? (
            /* Nothing to confirm on the way back up: lifting a pause only
               restores normal operation. */
            <Button
              onClick={handleUnpause}
              disabled={!canPause || isUnpausing}
              aria-busy={isUnpausing}
            >
              {isUnpausing ? (
                <Loader2 className="inline-flex h-4 w-4 animate-spin" />
              ) : (
                "Lift pause"
              )}
            </Button>
          ) : (
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
          )}

          {confirming && !isPaused && !isPausing && (
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          )}
        </div>

        {!canPause && (
          <p className="text-sm text-muted-foreground">
            Only the emergency pauser address above can pause or lift the pause.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default EmergencyPause;
