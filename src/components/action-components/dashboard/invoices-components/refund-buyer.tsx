"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Address } from "viem";

const RefundBuyer = ({
  invoiceKey,
  timeStamp,
}: {
  invoiceKey: Address;
  timeStamp: string | undefined;
}) => {
  const { refundBuyerAfterWindow, isLoading } = useContext(ContractContext);
  const paidAtTime = Number(timeStamp) * 1000;
  const threeDaysLater = paidAtTime + 259200000;
  const currentTime = Date.now();
  const disAbledButton = currentTime > threeDaysLater;
  const handleClick = async () => {
    await refundBuyerAfterWindow(invoiceKey);
  };

  return (
    <>
      <Button
        onClick={handleClick}
        className="w-full"
        disabled={!disAbledButton}
      >
        {isLoading ? (
          <>
            <p>processing...</p>
            <Loader2 className="animate-spin" size={10} color="#cee7d6" />
          </>
        ) : (
          "Request refund"
        )}
      </Button>
    </>
  );
};
export default RefundBuyer;
