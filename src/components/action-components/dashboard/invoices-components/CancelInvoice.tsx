"use client";

import { useContext, useState } from "react";
import {
  ContractActionsContext,
  ContractLoadingContext,
} from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Invoice } from "@/model/model";
import { appendHistoryEntry, nowInSeconds } from "@/lib/invoiceHistory";

import { toast } from "sonner";
import { isUserRejection, WALLET_CANCELLED } from "@/lib/walletErrors";

interface CancelInvoiceProps {
  invoiceId: bigint;
  invoice: Invoice;
}

const CancelInvoice = ({ invoiceId, invoice }: CancelInvoiceProps) => {
  const { cancelInvoice, upsertLocalInvoice } = useContext(
    ContractActionsContext,
  );
  const isLoading = useContext(ContractLoadingContext);
  const [localLoading, setLocalLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setLocalLoading(true);

    try {
      if (await cancelInvoice(invoiceId)) {
        upsertLocalInvoice?.({
          ...invoice,
          status: "CANCELED",
          history: appendHistoryEntry(
            invoice.history,
            "CANCELED",
            nowInSeconds(),
          ),
        });
        toast.success("Invoice successfully canceled");
      }
    } catch (err) {
      if (isUserRejection(err)) {
        toast(WALLET_CANCELLED);
        return;
      }
      console.error("Cancel invoice failed:", err);
      toast.error("Unable to cancel the invoice. Please retry.");
    } finally {
      setLocalLoading(false);
    }
  };

  const isActionLoading = localLoading || isLoading === `cancelInvoice:${invoiceId.toString()}`;

  return (
    <div className="flex flex-col items-end gap-2 mt-4">
      <Button
        size="sm"
        onClick={handleClick}
        disabled={isActionLoading}
        className="min-w-[140px] justify-center bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 rounded-lg px-4 py-1.5"
      >
        {isActionLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Canceling...
          </>
        ) : (
          "Cancel"
        )}
      </Button>
      {isActionLoading && (
        <p className="text-[11px] text-gray-500">
          Cancellation is processing. Keep this tab open.
        </p>
      )}
    </div>
  );
};

export default CancelInvoice;
