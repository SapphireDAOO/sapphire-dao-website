"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Address } from "viem";

const HandleCancelationRequest = ({
  invoiceKey,
  state,
  text,
}: {
  invoiceKey: Address;
  state: boolean;
  text: string;
}) => {
  const { handleCancelationRequest, isLoading } = useContext(ContractContext);

  const handleClick = async () => {
    await handleCancelationRequest(invoiceKey, state);
  };
  const isActionLoading = state
    ? isLoading === "accepted"
    : isLoading === "rejected";
  return (
    <>
      <Button
        variant={`${state ? "default" : "destructive"}`}
        onClick={handleClick}
        className="w-full mb-4"
      >
        {isActionLoading ? (
          <>
            <p>processing...</p>
            <Loader2 className="animate-spin" size={10} color="#cee7d6" />
          </>
        ) : (
          text
        )}
      </Button>
    </>
  );
};
export default HandleCancelationRequest;
