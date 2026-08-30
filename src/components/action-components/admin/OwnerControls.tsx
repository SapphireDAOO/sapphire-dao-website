"use client";
import { useContext, useEffect, useState } from "react";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { type AbiEvent, Address, formatEther, isAddress } from "viem";
import { Info, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { MULTISIG_CONTRACT, BASE_SEPOLIA } from "@/constants";
import { Multisig } from "@/abis/MultiSig";
import { ContractContext } from "@/context/contract-context";
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
import AdminSettingRow from "./AdminSettingRow";

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
 * The current protocol configuration, plus the one action an owner can still
 * take from their own wallet. Everything here is sent directly rather than
 * proposed, so it only works while the owner is a plain EOA — once ownership
 * sits with the multisig, the contract rejects these calls and the Multisig
 * page governs the same settings by proposal.
 */
const OwnerControls = () => {
  useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId });
  const { transferOwnership, isLoading } = useContext(ContractContext);

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

  const [ownerAddr, setOwnerAddr] = useState("");

  // Ownership already sitting with the multisig means this form cannot work —
  // say so up front rather than letting the transaction revert.
  const ownedByMultisig = Boolean(
    owner &&
      MULTISIG_CONTRACT[chainId] &&
      owner.toLowerCase() === MULTISIG_CONTRACT[chainId].toLowerCase(),
  );

  const handleOwnerAddress = async () => {
    // Ownership is not recoverable by this page once handed over, so reject a
    // malformed address here rather than letting the wallet send it.
    if (!isAddress(ownerAddr)) {
      toast.error("Enter a valid address");
      return;
    }
    if (ownedByMultisig) return;

    if (await transferOwnership(ownerAddr as Address)) {
      setOwnerAddr("");
      void refetchOwner();
    }
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
        <CardTitle className="text-2xl font-bold">Owner Controls</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Only permitted addresses are allowed to access this page
        </CardDescription>

        <TooltipProvider delayDuration={150}>
          <div className="mt-4 bg-muted p-4 rounded grid gap-4 sm:grid-cols-2">
            <Setting
              label="Owner"
              hint="The address that governs the protocol. While it is a single EOA it can act from this page; once it is the multisig, changes go through proposals instead."
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

      <CardContent>
        <div className="flex gap-2 items-start rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-3 mb-6 text-sm text-amber-900 dark:text-amber-200">
          <TriangleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            This action is sent straight from your wallet and is not proposed
            to the multisig. It only applies while the protocol owner is a
            single EOA, since the contract accepts the call from that address
            alone.{" "}
            {ownedByMultisig ? (
              <>
                Ownership currently sits with the multisig, so transfer it from
                the{" "}
                <a href="/multisig" className="underline font-medium">
                  Multisig page
                </a>{" "}
                instead.
              </>
            ) : (
              <>
                Once ownership is transferred to the multisig, use the{" "}
                <a href="/multisig" className="underline font-medium">
                  Multisig page
                </a>
                , where this and every other setting is governed by proposal.
              </>
            )}
          </p>
        </div>

        <div className="grid w-full items-center gap-6">
          <AdminSettingRow
            label="Set New Admin"
            inputId="setAdminAddress"
            inputProps={{
              placeholder: "Enter address (0x...)",
              value: ownerAddr,
              onChange: (e) => setOwnerAddr(e.target.value),
              disabled: ownedByMultisig,
            }}
            onAction={handleOwnerAddress}
            loadingKey="transferOwnership"
            isLoading={isLoading}
            buttonText="Set Admin"
            description="Transfers contract ownership to a new address immediately."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default OwnerControls;
