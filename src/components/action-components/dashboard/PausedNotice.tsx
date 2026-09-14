"use client";

import { ShieldAlert } from "lucide-react";
import { useEmergencyPause } from "@/hooks/useEmergencyPause";
import { formatDurationSeconds, unixToGMT } from "@/utils";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";

export const PausedNotice = () => {
  const { isPaused, pauseExpiry } = useEmergencyPause();
  useSharedSecondTicker(Boolean(isPaused));

  if (!isPaused) return null;

  const expirySeconds = pauseExpiry ? Number(pauseExpiry) : 0;
  const secondsRemaining = expirySeconds
    ? expirySeconds - Math.floor(Date.now() / 1000)
    : 0;

  return (
    <div
      role="status"
      className="mt-6 flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 p-4"
    >
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
      <div className="space-y-1">
        <p className="text-sm font-bold leading-tight text-red-900">
          Payments are paused
          {secondsRemaining > 0 && (
            <span className="font-normal">
              {" "}
              — lapses in {formatDurationSeconds(secondsRemaining)} (
              {unixToGMT(expirySeconds)} UTC)
            </span>
          )}
        </p>
        <p className="text-xs leading-snug text-red-800">
          Creating an invoice, paying, accepting, rejecting, releasing and
          refunding all revert while the pause is in force. Funds already in
          escrow are unaffected and stay where they are. Cancelling an unpaid
          invoice still works.
        </p>
      </div>
    </div>
  );
};
