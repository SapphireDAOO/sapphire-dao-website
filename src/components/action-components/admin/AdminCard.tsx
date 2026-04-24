"use client";
import { useEffect, useState, useCallback } from "react";
import { useAccount, useChainId, useWalletClient, usePublicClient } from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type AbiEvent, Address, encodeFunctionData } from "viem";
import { ethers } from "ethers";
import { CalendarIcon, Info, Loader2 } from "lucide-react";
import {
  SIMPLE_PAYMENT_PROCESSOR,
  ADVANCED_PAYMENT_PROCESSOR,
  PAYMENT_PROCESSOR_STORAGE,
  MULTISIG_CONTRACT,
  BASE_SEPOLIA,
} from "@/constants";
import { Multisig } from "@/abis/MultiSig";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useGetFeeReceiver } from "@/hooks/useGetFeeReceiver";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useGetDefaultHoldPeriod } from "@/hooks/useGetDefaultHoldPeriod";
import { useGetMinimumInvoiceValue } from "@/hooks/useGetMinimumInvoiceValue";
import { useGetMarketplaceWallet } from "@/hooks/useGetMarketplaceWallet";
import { useGetDecisionWindow } from "@/hooks/useGetDecisionWindow";
import { useGetValidPeriod } from "@/hooks/useGetValidPeriod";
import { proposeMultiSigTransaction } from "@/services/blockchain/MultiSig";
import AdminSettingRow from "./AdminSettingRow";

const fn1 = (name: string, type: string) =>
  [{ name, type: "function" as const, inputs: [{ name: "v", type, internalType: type }], outputs: [], stateMutability: "nonpayable" as const }] as const;

const fn2 = (name: string, t1: string, t2: string) =>
  [{ name, type: "function" as const, inputs: [{ name: "a", type: t1, internalType: t1 }, { name: "b", type: t2, internalType: t2 }], outputs: [], stateMutability: "nonpayable" as const }] as const;

const truncateAddress = (address: string | undefined) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading...";

const AdminCard = () => {
  useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId });

  const { isLoading: isOwnerLoading } = useGetOwner();
  const { data: fee, refetch: refetchFee } = useGetFeeRate();
  const { data: defaultHoldPeriod, refetch: refetchDefaultHoldPeriod } = useGetDefaultHoldPeriod();
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
        void refetchDefaultHoldPeriod();
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
    refetchDefaultHoldPeriod,
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
      return proposeMultiSigTransaction({ walletClient, publicClient }, target, calldata, chainId, loader);
    },
    [walletClient, publicClient, chainId],
  );

  // --- Form state ---
  const [receiversAdd, setReceiverAdd] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [holdDate, setHoldDate] = useState<Date | undefined>(undefined);
  const [holdTime, setHoldTime] = useState("00:00");
  const [holdPopoverOpen, setHoldPopoverOpen] = useState(false);
  const [holdContract, setHoldContract] = useState<"simple" | "advanced">("simple");
  const [defaultPeriod, setDefaultPeriod] = useState("");
  const [sDaoFee, setDaoFee] = useState("");
  const [value, setValue] = useState("");
  const [marketplaceAddress, setMarketplaceKeeper] = useState("");
  const [decisionWindowInput, setDecisionWindowInput] = useState("");
  const [validPeriodInput, setValidPeriodInput] = useState("");

  const handleReceiverAdd = async () => {
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("setFeeReceiver", "address"), functionName: "setFeeReceiver", args: [receiversAdd as Address] }),
      makeLoader("feeReceiver"),
    );
    if (ok) setReceiverAdd("");
  };

  const handleMarketplaceAddress = async () => {
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("setMarketplaceAddress", "address"), functionName: "setMarketplaceAddress", args: [marketplaceAddress as Address] }),
      makeLoader("marketplace"),
    );
    if (ok) setMarketplaceKeeper("");
  };

  const handleOwnerAddress = async () => {
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("transferOwnership", "address"), functionName: "transferOwnership", args: [ownerAddr as Address] }),
      makeLoader("owner"),
    );
    if (ok) setOwnerAddr("");
  };

  const handleInvoiceHoldPeriod = async () => {
    if (!holdDate || !invoiceId) return;
    const [hours, minutes] = holdTime.split(":").map(Number);
    const deadline = new Date(holdDate);
    deadline.setHours(hours, minutes, 0, 0);
    const releaseTimestamp = BigInt(Math.floor(deadline.getTime() / 1000));
    const id = BigInt(invoiceId);

    const isAdvanced = holdContract === "advanced";
    const target = (isAdvanced ? ADVANCED_PAYMENT_PROCESSOR : SIMPLE_PAYMENT_PROCESSOR)[chainId] as Address;
    const calldata = encodeFunctionData({
      abi: fn2("setInvoiceReleaseTime", "uint216", isAdvanced ? "uint256" : "uint40"),
      functionName: "setInvoiceReleaseTime",
      args: [id, releaseTimestamp],
    });

    const ok = await propose(target, calldata, makeLoader("invoiceRelease"));
    if (ok) { setInvoiceId(""); setHoldDate(undefined); setHoldTime("00:00"); }
  };

  const handleDefaultPeriod = async () => {
    const secs = BigInt(Math.round(Number(defaultPeriod) * 24 * 60 * 60));
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("setDefaultHoldPeriod", "uint96"), functionName: "setDefaultHoldPeriod", args: [secs] }),
      makeLoader("defaultPeriod"),
    );
    if (ok) setDefaultPeriod("");
  };

  const handleDecisionWindow = async () => {
    const minutes = Number(decisionWindowInput);
    if (isNaN(minutes) || minutes <= 0) return;
    const ok = await propose(
      SIMPLE_PAYMENT_PROCESSOR[chainId] as Address,
      encodeFunctionData({ abi: fn1("setDecisionWindow", "uint256"), functionName: "setDecisionWindow", args: [BigInt(Math.round(minutes * 60))] }),
      makeLoader("decisionWindow"),
    );
    if (ok) setDecisionWindowInput("");
  };

  const handleValidPeriod = async () => {
    const hours = Number(validPeriodInput);
    if (isNaN(hours) || hours <= 0) return;
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("setPaymentValidityDuration", "uint96"), functionName: "setPaymentValidityDuration", args: [BigInt(Math.round(hours * 3600))] }),
      makeLoader("validPeriod"),
    );
    if (ok) setValidPeriodInput("");
  };

  const handleDaoFee = async () => {
    const ok = await propose(
      PAYMENT_PROCESSOR_STORAGE[chainId] as Address,
      encodeFunctionData({ abi: fn1("setFeeRate", "uint96"), functionName: "setFeeRate", args: [BigInt(Math.round(parseFloat(sDaoFee) * 100))] }),
      makeLoader("fee"),
    );
    if (ok) setDaoFee("");
  };

  const handleMinimumInvoiceValue = async () => {
    const ok = await propose(
      SIMPLE_PAYMENT_PROCESSOR[chainId] as Address,
      encodeFunctionData({ abi: fn1("setMinimumInvoiceValue", "uint256"), functionName: "setMinimumInvoiceValue", args: [ethers.parseEther(value)] }),
      makeLoader("minimumValue"),
    );
    if (ok) setValue("");
  };

  if (isOwnerLoading) {
    return (
      <Card className="w-full max-w-md flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin h-8 w-8 text-green-500" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Admin Page</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Only permitted addresses are allowed to access this page
        </CardDescription>

        <div className="mt-4 bg-muted p-4 rounded grid gap-4">
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
            <span className="text-muted-foreground">Default Hold Period: </span>
            <span className="font-mono text-primary">
              {defaultHoldPeriod ? (Number(defaultHoldPeriod) / 60).toFixed(2) + " minutes" : "Loading..."}
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
              {minimumInvoiceValue ? ethers.formatEther(minimumInvoiceValue) + " ETH" : "Loading..."}
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
            before it takes effect.
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

          <AdminSettingRow
            label="Set Fee Receiver Address"
            inputId="setFeeReceiverAddress"
            inputProps={{ placeholder: "Enter address (0x...)", value: receiversAdd, onChange: (e) => setReceiverAdd(e.target.value) }}
            onAction={handleReceiverAdd}
            loadingKey="feeReceiver"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes updating the fee receiver address."
          />

          {/* Invoice Release Time */}
          <div className="space-y-1.5">
            <Label htmlFor="holdPeriodID">Invoice Release Time</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="holdPeriodID"
                placeholder="Invoice ID"
                type="number"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
                className="w-full"
              />
              <Select value={holdContract} onValueChange={(v) => setHoldContract(v as "simple" | "advanced")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple Processor</SelectItem>
                  <SelectItem value="advanced">Advanced Processor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Popover open={holdPopoverOpen} onOpenChange={setHoldPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {holdDate ? `${holdDate.toLocaleDateString()} ${holdTime}` : "Pick release date & time"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={holdDate}
                  onSelect={(date) => setHoldDate(date ?? undefined)}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                />
                <div className="border-t p-3 flex items-center gap-2">
                  <Label htmlFor="holdTime" className="shrink-0 text-sm">Time</Label>
                  <Input id="holdTime" type="time" value={holdTime} onChange={(e) => setHoldTime(e.target.value)} className="h-8" />
                  <Button size="sm" variant="ghost" onClick={() => setHoldPopoverOpen(false)}>Done</Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleInvoiceHoldPeriod}
              disabled={loadingAction === "invoiceRelease" || !holdDate || !invoiceId}
            >
              {loadingAction === "invoiceRelease" ? (
                <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
              ) : "Propose"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Proposes setting a release time for a specific invoice.{" "}
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                Note: can only take effect after the invoice has been accepted.
              </span>
            </p>
          </div>

          <AdminSettingRow
            label="Default Hold Period"
            inputId="defaultHoldPeriod"
            inputProps={{ type: "number", placeholder: "Enter days", value: defaultPeriod, onChange: (e) => setDefaultPeriod(e.target.value) }}
            onAction={handleDefaultPeriod}
            loadingKey="defaultPeriod"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes updating the default hold period for all new invoices."
          />

          <AdminSettingRow
            label="Decision Window (minutes)"
            inputId="decisionWindow"
            inputProps={{ type: "number", placeholder: "Enter minutes", value: decisionWindowInput, onChange: (e) => setDecisionWindowInput(e.target.value), min: 1 }}
            onAction={handleDecisionWindow}
            loadingKey="decisionWindow"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes updating the seller acceptance window."
          />

          <AdminSettingRow
            label="Invoice Validity Period (hours)"
            inputId="validPeriod"
            inputProps={{ type: "number", placeholder: "Enter hours", value: validPeriodInput, onChange: (e) => setValidPeriodInput(e.target.value), min: 1 }}
            onAction={handleValidPeriod}
            loadingKey="validPeriod"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes updating how long invoices stay payable before expiring."
          />

          <AdminSettingRow
            label="Set Minimum Invoice Value"
            inputId="setMinimumInvoiceValue"
            inputProps={{ type: "number", placeholder: "Enter value in ETH", value, onChange: (e) => setValue(e.target.value) }}
            onAction={handleMinimumInvoiceValue}
            loadingKey="minimumValue"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes updating the minimum invoice creation value."
          />

          {/* Fee — percentage input */}
          <div className="space-y-1.5">
            <Label htmlFor="setFee">Set Fee</Label>
            <div className="flex gap-2">
              <Input
                id="setFee"
                type="number"
                placeholder="Enter fee % (e.g. 10 for 10%)"
                value={sDaoFee}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || (Number(v) >= 0 && Number(v) < 30)) setDaoFee(v);
                }}
                max={29.99}
                min={0}
                step={0.01}
                className="w-full"
              />
              <Button onClick={handleDaoFee} disabled={loadingAction === "fee"}>
                {loadingAction === "fee" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : "Propose"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Proposes updating the platform fee percentage.
            </p>
          </div>

          <AdminSettingRow
            label="Set Marketplace Address"
            inputId="setMarketplaceAddress"
            inputProps={{ placeholder: "Enter address (0x...)", value: marketplaceAddress, onChange: (e) => setMarketplaceKeeper(e.target.value) }}
            onAction={handleMarketplaceAddress}
            loadingKey="marketplace"
            isLoading={loadingAction}
            buttonText="Propose"
            description="Proposes updating the marketplace keeper address."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCard;
