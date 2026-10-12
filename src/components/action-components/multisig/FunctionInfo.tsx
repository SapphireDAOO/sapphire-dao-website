"use client";

import { ExternalLink, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  functionDocsUrl,
  type GovernableContract,
  type GovernableFunction,
} from "./governableFunctions";

/** Callers must sit inside a `TooltipProvider`. */
export const FunctionInfo = ({
  contract,
  fn,
}: {
  contract: GovernableContract;
  fn: GovernableFunction;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        type="button"
        aria-label={`What does ${fn.label} do?`}
        className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Info className="h-3.5 w-3.5 text-muted-foreground transition hover:text-foreground" />
      </button>
    </TooltipTrigger>
    <TooltipContent className="w-72 p-3 text-xs font-normal">
      <p>{fn.hint}</p>
      <a
        href={functionDocsUrl(contract, fn)}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex items-center gap-1 text-blue-600 underline hover:text-blue-800"
      >
        View Docs
        <ExternalLink className="h-3 w-3" />
      </a>
    </TooltipContent>
  </Tooltip>
);

export default FunctionInfo;
