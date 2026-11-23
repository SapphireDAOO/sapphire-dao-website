"use client";

import { useContext, useState } from "react";
import {
  ContractActionsContext,
  ContractLoadingContext,
} from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isUserRejection, WALLET_CANCELLED } from "@/lib/walletErrors";

interface SellersActionProps {
  invoiceId: bigint;
  state: boolean;
  text: string;
  fullWidth?: boolean;
}

const SellersAction = ({
  invoiceId,
  state,
  text,
  fullWidth = false,
}: SellersActionProps) => {
  const { sellerAction } = useContext(ContractActionsContext);
  const isLoading = useContext(ContractLoadingContext);

  const [localLoading, setLocalLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setLocalLoading(true);

    try {
      if (await sellerAction(invoiceId, state)) {
        toast.success(
          `Successfully ${state ? "Accepted" : "Rejected"} the invoice.`
        );
      }
    } catch (err) {
      if (isUserRejection(err)) {
        toast(WALLET_CANCELLED);
        return;
      }
      console.error("Seller action failed:", err);
      toast.error("Action failed. Please try again.");
    } finally {
      setLocalLoading(false);
    }
  };

  const actionType = state ? "Accepted" : "Rejected";
  const actionKey = `${actionType}:${invoiceId.toString()}`;
  const orderKeySuffix = `:${invoiceId.toString()}`;
  const isOrderActionInFlight =
    typeof isLoading === "string" && isLoading.endsWith(orderKeySuffix);
  const isActionLoading = localLoading || isLoading === actionKey;
  const disableButton = isActionLoading || isOrderActionInFlight;

  return (
    <div className={cn("flex flex-col items-end gap-2", fullWidth && "w-full")}>
      <Button
        size="sm"
        variant={state ? "default" : "outline"}
        onClick={handleClick}
        disabled={disableButton}
        className={cn(
          "justify-center rounded-none",
          fullWidth ? "w-full" : "min-w-[110px]",
          !state &&
            "border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive",
        )}
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
      {isActionLoading && (
        <p className="max-w-[220px] text-right text-[11px] text-muted-foreground">
          Action pending. Keep this tab open. Confirmations can take up to a
          minute.
        </p>
      )}
    </div>
  );
};

export default SellersAction;
