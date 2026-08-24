"use client";
import { useEffect, useState, useCallback } from "react";
import { useAccount, useChainId, useWalletClient, usePublicClient } from "wagmi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type AbiEvent, Address, encodeFunctionData, formatEther } from "viem";
import { Info, Loader2 } from "lucide-react";
import {
  PAYMENT_PROCESSOR_STORAGE,
  MULTISIG_CONTRACT,
  BASE_SEPOLIA,
} from "@/constants";
import { Multisig } from "@/abis/MultiSig";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useGetFeeReceiver } from "@/hooks/useGetFeeReceiver";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useGetMinimumInvoiceValue } from "@/hooks/useGetMinimumInvoiceValue";
import { useGetMarketplaceWallet } from "@/hooks/useGetMarketplaceWallet";
import { useGetDecisionWindow } from "@/hooks/useGetDecisionWindow";
import { useGetValidPeriod } from "@/hooks/useGetValidPeriod";
import { proposeMultiSigTransaction } from "@/services/blockchain/MultiSig";
import AdminSettingRow from "./AdminSettingRow";

const fn1 = (name: string, type: string) =>
  [{ name, type: "function" as const, inputs: [{ name: "v", type, internalType: type }], outputs: [], stateMutability: "nonpayable" as const }] as const;

const truncateAddress = (address: string | undefined) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading...";

const AdminCard = () => {
  useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId });

  const { isLoading: isOwnerLoading } = useGetOwner();
  const { data: fee, refetch: refetchFee } = useGetFeeRate();
  const { data: minimumInvoiceValue, refetch: refetchMinimumInvoiceValue } = useGetMinimumInvoiceValue();
  const { data: marketplaceKeeperAddress, refetch: refetchMarketplaceWallet } = useGetMarketplaceWallet();
  const { data: feeReceiver, refetch: refetchFeeReceiver } = useGetFeeReceiver();
  const { data: decisionWindow, refetch: refetchDecisionWindow } = useGetDecisionWindow();
  const { data: validPeriod, refetch: refetchValidPeriod } = useGetValidPeriod();

  useEffect(() => {
    const msAddr = MULTISIG_CONTRACT[chainId] as Address | undefined;
    if (!publicClient || !msAddr) return;

    const executedEvent = (Multisig as readonly { type: string }[]).find(
      (item): item is AbiEvent =>
        item.type === "event" && (item as AbiEvent).name === "TransactionExecuted",
    );
    if (!executedEvent) return;

    const unwatch = publicClient.watchEvent({
      address: msAddr,
      event: executedEvent,
      onLogs: () => {
        void refetchFee();
        void refetchMinimumInvoiceValue();
        void refetchMarketplaceWallet();
        void refetchFeeReceiver();
        void refetchDecisionWindow();
        void refetchValidPeriod();
      },
      onError: (err) => console.error("multisig executed watch error", err),
    });

    return () => { unwatch(); };
  }, [
    publicClient,
    chainId,
    refetchFee,
    refetchMinimumInvoiceValue,
    refetchMarketplaceWallet,
    refetchFeeReceiver,
    refetchDecisionWindow,
    refetchValidPeriod,
  ]);

  // Each action tracks its own loading key so buttons don't cross-contaminate
  const [loadingAction, setLoadingAction] = useState("");
  const makeLoader = useCallback(
    (key: string) => (v: string) => setLoadingAction(v ? key : ""),
    [],
  );

  const propose = useCallback(
    async (target: Address, calldata: `0x${string}`, loader: (v: string) => void) => {
      if (!walletClient || !publicClient) return false;
      const result = await proposeMultiSigTransaction(
        { walletClient, publicClient },
        target,
        calldata,
        chainId,
        loader,
      );
      return result.ok;
    },
    [walletClient, publicClient, chainId],
  );

  const [ownerAddr, setOwnerAddr] = useState("");

  const handleOwnerAddress = async () => {
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("transferOwnership", "address"), functionName: "transferOwnership", args: [ownerAddr as Address] }),
      makeLoader("owner"),
    );
    if (ok) setOwnerAddr("");
  };

  if (isOwnerLoading) {
    return (
      <Card className="w-full flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin h-8 w-8 text-green-500" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Admin Page</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Only permitted addresses are allowed to access this page
        </CardDescription>

        <div className="mt-4 bg-muted p-4 rounded grid gap-4 sm:grid-cols-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <span className="text-muted-foreground">Fee Receiver:</span>
            <span className="font-mono text-primary">
              {feeReceiver ? (
                <a href={`https://sepolia.basescan.org/address/${feeReceiver}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                  {truncateAddress(feeReceiver)}
                </a>
              ) : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Marketplace Wallet: </span>
            <span className="font-mono text-primary">
              {marketplaceKeeperAddress ? (
                <a href={`https://sepolia.basescan.org/address/${marketplaceKeeperAddress}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                  {truncateAddress(marketplaceKeeperAddress)}
                </a>
              ) : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Decision Window: </span>
            <span className="font-mono text-primary">
              {decisionWindow ? (Number(decisionWindow) / 60).toFixed(2) + " minutes" : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Validity Period: </span>
            <span className="font-mono text-primary">
              {validPeriod ? (Number(validPeriod) / 3600).toFixed(2) + " hours" : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Fee: </span>
            <span className="font-mono text-primary">
              {fee ? parseInt(fee.toString()) / 100 + "%" : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Minimum Invoice Value: </span>
            <span className="font-mono text-primary">
              {minimumInvoiceValue ? formatEther(minimumInvoiceValue) + " ETH" : "Loading..."}
            </span>
          </p>
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex gap-2 items-start rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 mb-6 text-sm text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            All actions submit a proposal to the multisig. Signers must approve the proposal on the{" "}
            <a href="/multisig" className="underline font-medium">Multisig page</a>{" "}
            before it takes effect. Every other setting is governed from that page.
          </p>
        </div>

        <div className="grid w-full items-center gap-6">
          <AdminSettingRow
            label="Propose New Admin"
            inputId="setAdminAddress"
            inputProps={{ placeholder: "Enter address (0x...)", value: ownerAddr, onChange: (e) => setOwnerAddr(e.target.value) }}
            onAction={handleOwnerAddress}
            loadingKey="owner"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes transferring contract ownership to a new address."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCard;
