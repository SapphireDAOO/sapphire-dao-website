"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const Refund = ({ invoiceId }: { invoiceId: bigint }) => {
  const { refundBuyerAfterWindow, isLoading } = useContext(ContractContext);

  const handleClick = async () => {
    await refundBuyerAfterWindow(invoiceId);
  };

  return (
    <>
      <Button onClick={handleClick} className="w-full mb-4" disabled={isLoading === `refundBuyerAfterWindow:${invoiceId.toString()}`}>
        {isLoading === `refundBuyerAfterWindow:${invoiceId.toString()}` ? (
          <>
            <p className="mr-2">processing...</p>
            <Loader2 className="animate-spin" size={10} color="#cee7d6" />
          </>
        ) : (
          "Claim Refund"
        )}
      </Button>
    </>
  );
};
export default Refund;
