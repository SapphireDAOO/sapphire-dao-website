"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatAddress } from "@/lib/formatUtils";
import { timeLeft } from "@/lib/timeUtils";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";

const stopProp = (e: React.MouseEvent) => e.stopPropagation();

/** Etherscan address link */
export const renderContractLink = (address?: string) => {
  if (!address) return <span className="text-gray-500">—</span>;
  return (
    <a
      href={`https://sepolia.basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800"
      onClick={stopProp}
      onMouseDown={stopProp}
    >
      {formatAddress(address)}
    </a>
  );
};

/** Etherscan transaction link */
export const renderTx = (txHash?: string, display?: string) => {
  if (!txHash) return <span className="text-gray-500">—</span>;
  return (
    <a
      href={`https://sepolia.basescan.org/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800"
      onClick={stopProp}
      onMouseDown={stopProp}
    >
      {display ?? txHash}
    </a>
  );
};

/**
 * A countdown that ticks every second. It holds the ticker itself so the only
 * thing re-rendering each second is this text, not the card around it.
 * Takes timeLeft's arguments: counts to `endAtMs` when given, otherwise to
 * `startAt` (unix seconds).
 */
export const Countdown = ({
  startAt,
  endAtMs,
}: {
  startAt: number | string | null;
  endAtMs?: number;
}) => {
  useSharedSecondTicker(true);
  return <>{timeLeft(startAt, 0, endAtMs)}</>;
};

/**
 * Labelled field row with an info tooltip. Relies on the TooltipProvider
 * around the dashboard list rather than creating one per field.
 */
export const InvoiceField = ({
  label,
  value,
  description,
  link,
}: {
  label: string;
  value: React.ReactNode;
  description: string;
  link?: string;
}) => (
  <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1 mt-1">
    <span className="font-medium text-gray-700">{label}</span>

    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} info`}
          className="cursor-pointer flex items-center focus:outline-none"
          onClick={stopProp}
          onMouseDown={stopProp}
        >
          <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700 transition" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="w-60 p-3 text-xs">
        <p>{description}</p>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 mt-2 inline-block"
          >
            View Details
          </a>
        )}
      </TooltipContent>
    </Tooltip>

    <span>:</span>

    <span className="text-gray-800">
      {value === undefined || value === null || value === "" ? (
        <span className="animate-pulse text-gray-400">Loading…</span>
      ) : (
        value
      )}
    </span>
  </div>
);
