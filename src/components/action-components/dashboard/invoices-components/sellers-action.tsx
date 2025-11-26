"use client";

import { useContext, useState } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SellersActionProps {
  orderId: bigint;
  state: boolean;
  text: string;
}

const SellersAction = ({ orderId, state, text }: SellersActionProps) => {
  const { sellerAction, isLoading, refetchInvoiceData } =
    useContext(ContractContext);

  const [localLoading, setLocalLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setLocalLoading(true);

    try {
      if (await sellerAction(orderId, state)) {
        await refetchInvoiceData?.();

        toast.success(
          `Successfully ${state ? "Accepted" : "Rejected"} the invoice.`
        );
      }
    } catch (err) {
      console.error("Seller action failed:", err);
    } finally {
      setLocalLoading(false);
    }
  };

  const actionType = state ? "Accepted" : "Rejected";
  const isSellerActionInFlight =
    isLoading === "Accepted" || isLoading === "Rejected";
  const isActionLoading = localLoading || isLoading === actionType;
  const disableButton = isSellerActionInFlight || isActionLoading;

  return (
    <Button
      size="sm"
      onClick={handleClick}
      disabled={disableButton}
      className={`min-w-[130px] justify-center ${
        state
          ? "bg-green-600 hover:bg-green-700"
          : "bg-red-600 hover:bg-red-700"
      } text-white font-medium shadow-sm hover:shadow-md transition-all duration-200 rounded-lg px-4 py-1.5`}
    >
      {isActionLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        text
      )}
    </Button>
  );
};

export default SellersAction;
