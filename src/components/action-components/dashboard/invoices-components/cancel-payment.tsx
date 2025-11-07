"use client";

import { useContext, useState } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CancelInvoiceProps {
  orderId: bigint;
}

const CancelInvoice = ({ orderId }: CancelInvoiceProps) => {
  const { cancelInvoice, isLoading } = useContext(ContractContext);
  const [localLoading, setLocalLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setLocalLoading(true);

    try {
      await cancelInvoice(orderId);
    } catch (err) {
      console.error("Cancel invoice failed:", err);
    } finally {
      setLocalLoading(false);
    }
  };

  const isActionLoading =
    localLoading || isLoading === "canceling" || isLoading === "cancel";

  return (
    <div className="flex justify-end mt-4">
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
    </div>
  );
};

export default CancelInvoice;
