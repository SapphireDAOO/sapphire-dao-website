"use client";
import { useContext } from "react";
import { ContractContext } from "@/context/contract-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const CreatorsAction = ({
  invoiceId,
  state,
  text,
}: {
  invoiceId: string;
  state: boolean;
  text: string;
}) => {
  const { creatorsAction, isLoading } = useContext(ContractContext);

  const handleClick = async () => {
    await creatorsAction(BigInt(invoiceId), state);
  };
  const isActionLoading = state
    ? isLoading === "accepted"
    : isLoading === "rejected";
  return (
    <>
      <Button
        variant={`${state ? "default" : "destructive"}`}
        onClick={handleClick}
        className="w-full"
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
export default CreatorsAction;
