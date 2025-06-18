"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Address } from "viem";

const ResolveDispute = ({ invoiceKey }: { invoiceKey: Address }) => {
  const { resolveDispute, isLoading } = useContext(ContractContext);

  const handleClick = async () => {
    await resolveDispute(invoiceKey);
  };

  return (
    <>
      <Button onClick={handleClick} className="w-full">
        {isLoading ? (
          <>
            <p>processing...</p>
            <Loader2 className="animate-spin" size={10} color="#cee7d6" />
          </>
        ) : (
          "Resolve Dispute"
        )}
      </Button>
    </>
  );
};
export default ResolveDispute;
