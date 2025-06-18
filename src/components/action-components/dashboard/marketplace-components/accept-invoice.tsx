"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Address } from "viem";

const AcceptInvoice = ({ invoiceKey }: { invoiceKey: Address }) => {
  const { acceptMarketplaceInvoice, isLoading } = useContext(ContractContext);

  const handleClick = async () => {
    await acceptMarketplaceInvoice(invoiceKey);
  };

  return (
    <>
      <Button onClick={handleClick} className="w-full mb-4">
        {isLoading ? (
          <>
            <p className="mr-2">processing...</p>
            <Loader2 className="animate-spin" size={10} color="#cee7d6" />
          </>
        ) : (
          "Accept"
        )}
      </Button>
    </>
  );
};
export default AcceptInvoice;
