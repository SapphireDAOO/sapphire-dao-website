"use client";

import { ShieldAlert } from "lucide-react";
import { useEmergencyPause } from "@/hooks/useEmergencyPause";
import { usePauseState } from "@/hooks/usePauseState";
import { formatDurationSeconds, unixToGMT } from "@/utils";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";

export const PausedNotice = () => {
  const { isPaused: chainPaused, pauseExpiry } = useEmergencyPause();
  const { isPaused: indexedPaused, state } = usePauseState();
  const isPaused = chainPaused || indexedPaused;
  useSharedSecondTicker(Boolean(isPaused));

  if (!isPaused) return null;

  const expirySeconds = pauseExpiry
    ? Number(pauseExpiry)
    : Number(state?.emergencyPauseExpiry ?? 0);
  const secondsRemaining = expirySeconds
    ? expirySeconds - Math.floor(Date.now() / 1000)
    : 0;

  return (
    <div
      role="status"
      className="mt-6 flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div className="space-y-1">
        <p className="text-sm font-bold leading-tight text-destructive">
          Payments are paused
          {secondsRemaining > 0 && (
            <span className="font-normal">
              {" "}
              — lapses in {formatDurationSeconds(secondsRemaining)} (
              {unixToGMT(expirySeconds)} UTC)
            </span>
          )}
        </p>
        <p className="text-xs leading-snug text-destructive">
          Creating an invoice, paying, accepting, rejecting, releasing and
          refunding all revert while the pause is in force. Funds already in
          escrow are unaffected and stay where they are. Cancelling an unpaid
          invoice still works.
        </p>
      </div>
    </div>
  );
};
