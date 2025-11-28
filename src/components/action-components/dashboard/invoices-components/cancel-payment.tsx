"use client";

import { useContext, useRef, useState } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

import { toast } from "sonner";

interface CancelInvoiceProps {
  orderId: bigint;
}

const CancelInvoice = ({ orderId }: CancelInvoiceProps) => {
  const { cancelInvoice, isLoading, refetchInvoiceData } =
    useContext(ContractContext);
  const [localLoading, setLocalLoading] = useState(false);
  const pendingToastId = useRef<string | number | undefined>(undefined);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setLocalLoading(true);
    if (pendingToastId.current) {
      toast.dismiss(pendingToastId.current);
    }
    pendingToastId.current = toast.loading(
      "Cancelling invoice. Please keep this tab open; it can take up to a minute.",
      { duration: Infinity }
    );

    try {
      if (await cancelInvoice(orderId)) {
        await refetchInvoiceData?.();
        toast.success("Invoice successfully cancelled");
      }
    } catch (err) {
      console.error("Cancel invoice failed:", err);
      toast.error("Unable to cancel the invoice. Please retry.");
    } finally {
      if (pendingToastId.current) {
        toast.dismiss(pendingToastId.current);
        pendingToastId.current = undefined;
      }
      setLocalLoading(false);
    }
  };

  const isActionLoading =
    localLoading || isLoading === "canceling" || isLoading === "cancel";

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
          Cancellation is processing. Keep this tab open—this may take up to a
          minute.
        </p>
      )}
    </div>
  );
};

export default CancelInvoice;
