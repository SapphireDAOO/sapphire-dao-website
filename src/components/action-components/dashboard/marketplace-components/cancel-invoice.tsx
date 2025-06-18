"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Address } from "viem";

const CancelInvoice = ({ invoiceKey }: { invoiceKey: Address }) => {
  const { cancelMarketplaceInvoice, isLoading } = useContext(ContractContext);

  const handleClick = async () => {
    await cancelMarketplaceInvoice(invoiceKey);
  };

  return (
    <>
      <Button variant="destructive" onClick={handleClick} className="w-full">
        {isLoading ? (
          <>
            <Loader2
              className="inline-flex animate-spin"
              size={10}
              color="#cee7d6"
            />
          </>
        ) : (
          "Cancel"
        )}
      </Button>
    </>
  );
};
export default CancelInvoice;
