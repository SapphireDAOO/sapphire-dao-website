"use client";

import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatAddress } from "@/lib/formatUtils";

const stopProp = (e: React.MouseEvent) => e.stopPropagation();

/** Etherscan address link */
export const renderContractLink = (address?: string) => {
  if (!address) return <span className="text-gray-500">—</span>;
  return (
    <a
      href={`https://sepolia.etherscan.io/address/${address}`}
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
      href={`https://sepolia.etherscan.io/tx/${txHash}`}
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

/** Labelled field row with an info tooltip */
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

    <TooltipProvider delayDuration={150}>
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
        <TooltipContent className="w-60 text-xs p-3 bg-white border border-gray-200 rounded-md shadow-md text-gray-700">
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
    </TooltipProvider>

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
