"use client";

import { useState } from "react";
import { type Log } from "viem";
import { useAccount, useChainId } from "wagmi";
import { useWalletClient, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { BASE_SEPOLIA } from "@/constants";
import { GOVERNABLE_CONTRACTS, GovernableFunction, encodeGovernableCall } from "./governableFunctions";
import { proposeMultiSigTransaction } from "@/services/blockchain/MultiSig";
import { toast } from "sonner";

interface ProposeFormProps {
  onSuccess?: () => void;
  onApplyLogs?: (logs: readonly Log[]) => void;
}

export default function ProposeForm({ onSuccess, onApplyLogs }: ProposeFormProps) {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId });

  const [contractKey, setContractKey] = useState("");
  const [fnName, setFnName] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState("");

  const selectedContract = GOVERNABLE_CONTRACTS.find((c) => c.key === contractKey);
  const selectedFn: GovernableFunction | undefined = selectedContract?.functions.find(
    (f) => f.name === fnName,
  );

  const handleContractChange = (key: string) => {
    setContractKey(key);
    setFnName("");
    setParamValues({});
  };

  const handleFnChange = (name: string) => {
    setFnName(name);
    setParamValues({});
  };

  const handleSubmit = async () => {
    if (!selectedContract || !selectedFn || !walletClient || !publicClient || !address) {
      toast.error("Fill in all fields before submitting");
      return;
    }

    for (const p of selectedFn.params) {
      if (!paramValues[p.name]?.trim()) {
        toast.error(`Missing value for "${p.label}"`);
        return;
      }
    }

    let calldata;
    try {
      calldata = encodeGovernableCall(selectedFn, paramValues);
    } catch {
      toast.error("Invalid parameter value — check inputs and try again");
      return;
    }

    const target = selectedContract.getAddress(chainId);
    const { ok, receipt } = await proposeMultiSigTransaction(
      { walletClient, publicClient },
      target,
      calldata,
      chainId,
      setIsLoading,
    );

    if (ok) {
      if (receipt) onApplyLogs?.(receipt.logs);
      setContractKey("");
      setFnName("");
      setParamValues({});
      onSuccess?.();
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Target Contract</Label>
        <Select value={contractKey} onValueChange={handleContractChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select contract" />
          </SelectTrigger>
          <SelectContent>
            {GOVERNABLE_CONTRACTS.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedContract && (
        <div className="space-y-1.5">
          <Label>Function</Label>
          <Select value={fnName} onValueChange={handleFnChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select function" />
            </SelectTrigger>
            <SelectContent>
              {selectedContract.functions.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {selectedFn?.params.map((p) => (
        <div key={p.name} className="space-y-1.5">
          <Label htmlFor={p.name}>{p.label}</Label>
          <Input
            id={p.name}
            placeholder={p.placeholder}
            value={paramValues[p.name] ?? ""}
            onChange={(e) =>
              setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))
            }
          />
        </div>
      ))}

      {selectedFn && (
        <Button
          className="w-full"
          onClick={handleSubmit}
          disabled={!!isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Propose Transaction"
          )}
        </Button>
      )}
    </div>
  );
}
