"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const ReleaseInvoice = ({ invoiceId }: { invoiceId: bigint }) => {
  const { releaseInvoice, isLoading } = useContext(ContractContext);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    await releaseInvoice(invoiceId);
  };

  return (
    <>
      <Button onClick={handleClick} className="w-full" disabled={isLoading === `releaseInvoice:${invoiceId.toString()}`}>
        {isLoading === `releaseInvoice:${invoiceId.toString()}` ? (
          <>
            <p>processing...</p>
            <Loader2 className="animate-spin" size={10} color="#cee7d6" />
          </>
        ) : (
          "Release Payment"
        )}
      </Button>
    </>
  );
};
export default ReleaseInvoice;
