"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { MultiSigTransaction } from "@/model/multisig";
import {
  decodeMultiSigCalldata,
  decodeCancelTargetHash,
  formatAddress,
  formatTimestamp,
} from "./decodeCalldata";
import TransactionDetail from "./TransactionDetail";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border-yellow-200",
  APPROVED: "bg-blue-100 text-blue-800 border-blue-200",
  EXECUTED: "bg-green-100 text-green-800 border-green-200",
  CANCELED: "bg-red-100 text-red-800 border-red-200",
};

const CANCEL_PROPOSAL_BADGE: Record<string, string> = {
  PENDING: "bg-orange-50 text-orange-700 border-orange-200",
  APPROVED: "bg-orange-100 text-orange-800 border-orange-300",
  EXECUTED: "bg-red-50 text-red-700 border-red-200",
};

interface Props {
  transactions: MultiSigTransaction[];
  threshold: number;
  isSigner: boolean;
  isLoading: boolean;
  page: number;
  hasNextPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export default function TransactionList({
  transactions,
  threshold,
  isSigner,
  isLoading,
  page,
  hasNextPage,
  onNextPage,
  onPrevPage,
}: Props) {
  const [selectedTx, setSelectedTx] = useState<MultiSigTransaction | null>(null);

  // Decode calldata once per transactions array change
  const decodedMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof decodeMultiSigCalldata>>();
    for (const tx of transactions) {
      map.set(tx.id, decodeMultiSigCalldata(tx.data));
    }
    return map;
  }, [transactions]);

  // Map: original txHash (lowercase) → cancel proposal tx
  const cancelProposalMap = useMemo(() => {
    const map = new Map<string, MultiSigTransaction>();
    for (const tx of transactions) {
      const targetHash = decodeCancelTargetHash(tx.data);
      if (targetHash) map.set(targetHash, tx);
    }
    return map;
  }, [transactions]);

  // IDs of cancel proposal txs (excluded from main display rows)
  const cancelProposalIds = useMemo(() => {
    const ids = new Set<string>();
    for (const tx of transactions) {
      if (decodeCancelTargetHash(tx.data)) ids.add(tx.id);
    }
    return ids;
  }, [transactions]);

  const displayTransactions = useMemo(
    () => transactions.filter((tx) => !cancelProposalIds.has(tx.id)),
    [transactions, cancelProposalIds],
  );

  if (isLoading && transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoading && displayTransactions.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        No transactions yet.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Nonce</th>
              <th className="px-4 py-3">Call</th>
              <th className="px-4 py-3">Approvals</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Proposed</th>
            </tr>
          </thead>
          <tbody>
            {displayTransactions.map((tx) => {
              const decoded = decodedMap.get(tx.id);
              const cancelProposal = cancelProposalMap.get(tx.id.toLowerCase());
              return (
                <tr
                  key={tx.id}
                  className="border-b cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setSelectedTx(tx)}
                >
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    #{tx.nonce}
                  </td>
                  <td className="px-4 py-3">
                    {decoded ? (
                      <div>
                        <p className="font-medium">{decoded.functionLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {decoded.contractLabel}
                        </p>
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatAddress(tx.target)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {tx.approvalCount} / {threshold}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <Badge
                        variant="outline"
                        className={STATUS_BADGE[tx.status] ?? ""}
                      >
                        {tx.status}
                      </Badge>
                      {cancelProposal && (tx.status === "PENDING" || tx.status === "APPROVED") && (
                        <Badge
                          variant="outline"
                          className={CANCEL_PROPOSAL_BADGE[cancelProposal.status] ?? "bg-orange-50 text-orange-700 border-orange-200"}
                        >
                          ↩ Cancel {cancelProposal.status}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {formatTimestamp(tx.proposedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-muted-foreground">Page {page + 1}</span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onPrevPage}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onNextPage}
            disabled={!hasNextPage}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <TransactionDetail
        tx={selectedTx}
        threshold={threshold}
        isSigner={isSigner}
        cancelProposal={
          selectedTx
            ? (cancelProposalMap.get(selectedTx.id.toLowerCase()) ?? null)
            : null
        }
        onClose={() => setSelectedTx(null)}
        onActionSuccess={() => {}}
      />
    </>
  );
}
