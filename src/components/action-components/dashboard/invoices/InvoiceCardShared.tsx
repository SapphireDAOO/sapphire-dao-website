"use client";

import { ExternalLink } from "lucide-react";
import { InfoTip } from "@/components/ui/info-tip";
import { formatAddress } from "@/lib/formatUtils";
import { timeLeft } from "@/lib/timeUtils";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";

const stopProp = (e: React.MouseEvent) => e.stopPropagation();

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

export const renderTx = (txHash?: string, display?: string) => {
  if (!txHash) return <span className="text-gray-500">—</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {display && <span>{display}</span>}
      <a
        href={`https://sepolia.basescan.org/tx/${txHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-[11px] font-medium text-gray-700 transition-colors hover:bg-gray-100"
        onClick={stopProp}
        onMouseDown={stopProp}
      >
        View transaction on Basescan
        <ExternalLink className="h-3 w-3" />
      </a>
    </span>
  );
};

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

    <InfoTip label={`${label} info`}>
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
    </InfoTip>

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
