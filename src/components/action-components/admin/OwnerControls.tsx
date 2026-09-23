"use client";
import { useEffect } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type AbiEvent, Address, formatEther } from "viem";
import { Info, Loader2 } from "lucide-react";
import { MULTISIG_CONTRACT, BASE_SEPOLIA } from "@/constants";
import { Multisig } from "@/abis/MultiSig";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useGetFeeReceiver } from "@/hooks/useGetFeeReceiver";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useGetMinimumInvoiceValue } from "@/hooks/useGetMinimumInvoiceValue";
import { useGetIntermediatedOperator } from "@/hooks/useGetIntermediatedOperator";
import { useGetDecisionWindow } from "@/hooks/useGetDecisionWindow";
import { useGetValidPeriod } from "@/hooks/useGetValidPeriod";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDurationSeconds } from "@/utils";

const truncateAddress = (address: string | undefined) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading...";

/**
 * One read-only row of the current on-chain configuration. `hint` explains what
 * the value governs, since several of these names mean little on their own.
 */
const Setting = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) => (
  <div className="text-sm font-medium flex flex-wrap items-center gap-x-1.5">
    <span className="text-muted-foreground">{label}</span>
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${label}?`}
          className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        >
          <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 text-xs font-normal">
        {hint}
      </TooltipContent>
    </Tooltip>
    <span className="text-muted-foreground">:</span>
    <span className="font-mono text-primary">{children}</span>
  </div>
);

const AddressLink = ({ address }: { address?: string }) =>
  address ? (
    <a
      href={`https://sepolia.basescan.org/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-500 underline"
    >
      {truncateAddress(address)}
    </a>
  ) : (
    <>Loading...</>
  );

/**
 * The current protocol configuration, read from the chain.
 *
 * Nothing is changed from here: every one of these settings, ownership
 * included, is altered by proposal on the Governance page.
 */
const OwnerControls = () => {
  useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const { data: owner, isLoading: isOwnerLoading, refetch: refetchOwner } = useGetOwner();
  const { data: fee, refetch: refetchFee } = useGetFeeRate();
  const { data: minimumInvoiceValue, refetch: refetchMinimumInvoiceValue } = useGetMinimumInvoiceValue();
  const { data: intermediatedOperatorAddress, refetch: refetchIntermediatedOperator } = useGetIntermediatedOperator();
  const { data: feeReceiver, refetch: refetchFeeReceiver } = useGetFeeReceiver();
  const { data: decisionWindow, refetch: refetchDecisionWindow } = useGetDecisionWindow();
  const { data: validPeriod, refetch: refetchValidPeriod } = useGetValidPeriod();

  // Settings are also changed by multisig proposals, so mirror an executed
  // proposal straight into the values shown here.
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
        void refetchOwner();
        void refetchFee();
        void refetchMinimumInvoiceValue();
        void refetchIntermediatedOperator();
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
    refetchOwner,
    refetchFee,
    refetchMinimumInvoiceValue,
    refetchIntermediatedOperator,
    refetchFeeReceiver,
    refetchDecisionWindow,
    refetchValidPeriod,
  ]);

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
        <CardTitle className="text-2xl font-bold">Protocol Settings</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          The live configuration. Changing any of it is a proposal on the
          Governance page.
        </CardDescription>

        <TooltipProvider delayDuration={150}>
          <div className="mt-4 bg-muted p-4 rounded grid gap-4 sm:grid-cols-2">
            <Setting
              label="Owner"
              hint="The address that governs the protocol. Transferring it is itself a proposal on the Governance page."
            >
              <AddressLink address={owner} />
            </Setting>
            <Setting
              label="Fee Receiver"
              hint="The fee receiver registered on the processor storage. Each invoice's fee is routed to a one-time stealth address and swept from there."
            >
              <AddressLink address={feeReceiver} />
            </Setting>
            <Setting
              label="Intermediated Operator Wallet"
              hint="The wallet allowed to operate intermediated invoices on behalf of intermediated platforms."
            >
              <AddressLink address={intermediatedOperatorAddress} />
            </Setting>
            <Setting
              label="Decision Window"
              hint="How long a seller has to accept or reject a payment. Once it passes, the buyer can claim a refund."
            >
              {decisionWindow
                ? formatDurationSeconds(Number(decisionWindow))
                : "Loading..."}
            </Setting>
            <Setting
              label="Validity Period"
              hint="How long an invoice stays payable after it is created, before it expires."
            >
              {validPeriod
                ? formatDurationSeconds(Number(validPeriod))
                : "Loading..."}
            </Setting>
            <Setting
              label="Fee"
              hint="The platform fee charged on each invoice. Held on-chain in basis points and shown here as a percentage."
            >
              {fee ? parseInt(fee.toString()) / 100 + "%" : "Loading..."}
            </Setting>
            <Setting
              label="Minimum Invoice Value"
              hint="The smallest value an invoice can be created for."
            >
              {minimumInvoiceValue
                ? formatEther(minimumInvoiceValue) + " ETH"
                : "Loading..."}
            </Setting>
          </div>
        </TooltipProvider>
      </CardHeader>

    </Card>
  );
};

export default OwnerControls;
