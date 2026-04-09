"use client";
import { useContext, useEffect, useState } from "react";
import { useAccount } from "wagmi";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContractContext } from "@/context/contract-context";
import { CalendarIcon, Loader2 } from "lucide-react";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useGetFeeReceiver } from "@/hooks/useGetFeeReceiver";
import { Address } from "viem";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useGetDefaultHoldPeriod } from "@/hooks/useGetDefaultHoldPeriod";
import { useGetMinimumInvoiceValue } from "@/hooks/useGetMinimumInvoiceValue";
import { ethers } from "ethers";
import { useGetMarketplaceWallet } from "@/hooks/useGetMarketplaceWallet";
import { useGetDecisionWindow } from "@/hooks/useGetDecisionWindow";
import { useGetValidPeriod } from "@/hooks/useGetValidPeriod";
import { useViemBlockNumber } from "@/hooks/useViemBlockNumber";
import AdminSettingRow from "./AdminSettingRow";

// Utility function to truncate addresses
const truncateAddress = (address: string | undefined) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading...";

const AdminCard = () => {
  const { address: connectedAddress } = useAccount();
  const { data: ownerAddress, isLoading: isAllowedAddressLoading } = useGetOwner();
  const { data: fee, refetch: refetchFee } = useGetFeeRate();
  const { data: defaultHoldPeriod, refetch: refetchDefaultHoldPeriod } = useGetDefaultHoldPeriod();
  const { data: minimumInvoiceValue, refetch: refetchMinimumInvoiceValue } = useGetMinimumInvoiceValue();
  const { data: marketplaceKeeperAddress, refetch: refetchMarketplaceWallet } = useGetMarketplaceWallet();
  const { data: feeReceiver, refetch: refetchFeeReceiver } = useGetFeeReceiver();
  const { data: decisionWindow, refetch: refetchDecisionWindow } = useGetDecisionWindow();
  const { data: validPeriod, refetch: refetchValidPeriod } = useGetValidPeriod();

  const { data: blockNumber } = useViemBlockNumber();

  // Refetch all settings on every new block
  useEffect(() => {
    if (!blockNumber) return;
    void refetchFee();
    void refetchDefaultHoldPeriod();
    void refetchMinimumInvoiceValue();
    void refetchMarketplaceWallet();
    void refetchFeeReceiver();
    void refetchDecisionWindow();
    void refetchValidPeriod();
  }, [
    blockNumber,
    refetchFee,
    refetchDefaultHoldPeriod,
    refetchMinimumInvoiceValue,
    refetchMarketplaceWallet,
    refetchFeeReceiver,
    refetchDecisionWindow,
    refetchValidPeriod,
  ]);

  const [receiversAdd, setReceiverAdd] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [invoiceId, setinvoiceId] = useState("");
  const [holdDate, setHoldDate] = useState<Date | undefined>(undefined);
  const [holdTime, setHoldTime] = useState("00:00");
  const [holdPopoverOpen, setHoldPopoverOpen] = useState(false);
  const [defaultPeriod, setDefaultPeriod] = useState("");
  const [sDaoFee, setDaoFee] = useState("");
  const [value, setValue] = useState("");
  const [marketplaceAddress, setMarketplaceKeeper] = useState("");
  const [decisionWindowInput, setDecisionWindowInput] = useState("");
  const [validPeriodInput, setValidPeriodInput] = useState("");

  const {
    setFeeReceiversAddress,
    setInvoiceHoldPeriod,
    setDefaultHoldPeriod,
    setFee,
    transferOwnership,
    setMinimumInvoiceValue,
    setMarketplaceAddress,
    setDecisionWindow,
    setValidPeriod,
    isLoading,
  } = useContext(ContractContext);

  const handleReceiverAdd = async () => {
    const ok = await setFeeReceiversAddress(receiversAdd as Address);
    if (ok) { setReceiverAdd(""); void refetchFeeReceiver(); }
  };

  const handleMarketplaceAddress = async () => {
    const ok = await setMarketplaceAddress(marketplaceAddress as Address);
    if (ok) { setMarketplaceKeeper(""); void refetchMarketplaceWallet(); }
  };

  const handleOwnerAddress = async () => {
    const ok = await transferOwnership(ownerAddr as Address);
    if (ok) setOwnerAddr("");
  };

  const handleInvoiceHoldPeriod = async () => {
    if (!holdDate) return;
    const [hours, minutes] = holdTime.split(":").map(Number);
    const deadline = new Date(holdDate);
    deadline.setHours(hours, minutes, 0, 0);
    const holdPeriodInSecond = Math.max(0, Math.round((deadline.getTime() - Date.now()) / 1000));
    const ok = await setInvoiceHoldPeriod(BigInt(invoiceId), BigInt(holdPeriodInSecond));
    if (ok) { setinvoiceId(""); setHoldDate(undefined); setHoldTime("00:00"); }
  };

  const handleDefaultPeriod = async () => {
    const defaultPeriodInSecond = BigInt(Number(defaultPeriod) * 24 * 60 * 60);
    const ok = await setDefaultHoldPeriod(defaultPeriodInSecond);
    if (ok) { setDefaultPeriod(""); void refetchDefaultHoldPeriod(); }
  };

  const handleDecisionWindow = async () => {
    const minutes = Number(decisionWindowInput);
    if (isNaN(minutes) || minutes <= 0) return;
    const windowInSeconds = BigInt(Math.round(minutes * 60));
    const ok = await setDecisionWindow(windowInSeconds);
    if (ok) { setDecisionWindowInput(""); void refetchDecisionWindow(); }
  };

  const handleValidPeriod = async () => {
    const hours = Number(validPeriodInput);
    if (isNaN(hours) || hours <= 0) return;
    const periodInSeconds = BigInt(Math.round(hours * 60 * 60));
    const ok = await setValidPeriod(periodInSeconds);
    if (ok) { setValidPeriodInput(""); void refetchValidPeriod(); }
  };

  const handleDaoFee = async () => {
    const sDaoFeeInBps = BigInt(parseInt(sDaoFee) * 100);
    const ok = await setFee(sDaoFeeInBps);
    if (ok) { setDaoFee(""); void refetchFee(); }
  };

  const handleMinimumInvoiceValue = async () => {
    const v = ethers.parseEther(value);
    const ok = await setMinimumInvoiceValue(v);
    if (ok) { setValue(""); void refetchMinimumInvoiceValue(); }
  };

  if (isAllowedAddressLoading) {
    return (
      <Card className="w-full max-w-md flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="animate-spin h-8 w-8 text-green-500" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </Card>
    );
  }

  const isOwner =
    connectedAddress &&
    ownerAddress &&
    connectedAddress.toLowerCase() === ownerAddress.toLowerCase();

  if (!isOwner) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Access Denied</CardTitle>
          <CardDescription>
            {connectedAddress
              ? "Your connected wallet is not the contract owner."
              : "Connect the owner wallet to access this page."}
          </CardDescription>
        </CardHeader>
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
                <a
                  href={`https://sepolia.basescan.org/address/${feeReceiver}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  {truncateAddress(feeReceiver)}
                </a>
              ) : (
                "Loading..."
              )}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Marketplace Wallet: </span>
            <span className="font-mono text-primary">
              {marketplaceKeeperAddress ? (
                <a
                  href={`https://sepolia.basescan.org/address/${marketplaceKeeperAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  {truncateAddress(marketplaceKeeperAddress)}
                </a>
              ) : (
                "Loading..."
              )}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Default Hold Period: </span>
            <span className="font-mono text-primary">
              {defaultHoldPeriod
                ? (Number(defaultHoldPeriod) / 60).toFixed(2) + " minutes"
                : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Decision Window: </span>
            <span className="font-mono text-primary">
              {decisionWindow
                ? (Number(decisionWindow) / 60).toFixed(2) + " minutes"
                : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Validity Period: </span>
            <span className="font-mono text-primary">
              {validPeriod
                ? (Number(validPeriod) / 3600).toFixed(2) + " hours"
                : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">Fee: </span>
            <span className="font-mono text-primary">
              {fee ? parseInt(fee.toString()) / 100 + "%" : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">
              Minimum Invoice Value:{" "}
            </span>
            <span className="font-mono text-primary">
              {minimumInvoiceValue
                ? ethers.formatEther(minimumInvoiceValue) + " ETH"
                : "Loading..."}
            </span>
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-6">
          <AdminSettingRow
            label="Set New Admin"
            inputId="setAdminAddress"
            inputProps={{
              placeholder: "Enter address (0x...)",
              value: ownerAddr,
              onChange: (e) => setOwnerAddr(e.target.value),
            }}
            onAction={handleOwnerAddress}
            loadingKey="transferOwnership"
            isLoading={isLoading}
            buttonText="Update Admin"
            description="Updates the admin of the fee receiver."
          />

          <AdminSettingRow
            label="Set Fee Receiver Address"
            inputId="setFeeReceiverAddress"
            inputProps={{
              placeholder: "Enter address (0x...)",
              value: receiversAdd,
              onChange: (e) => setReceiverAdd(e.target.value),
            }}
            onAction={handleReceiverAdd}
            loadingKey="setFeeReceiversAddress"
            isLoading={isLoading}
            buttonText="Set Fee Receiver"
            description="Updates the address of the fee receiver."
          />

          {/* Invoice Hold Period: invoice ID + date/time picker */}
          <div className="space-y-1.5">
            <Label htmlFor="holdPeriodID">Invoice Hold Period</Label>
            <Input
              id="holdPeriodID"
              placeholder="Invoice ID"
              type="number"
              value={invoiceId}
              onChange={(e) => setinvoiceId(e.target.value)}
              aria-describedby="holdPeriodDescription"
              className="w-full"
            />
            <Popover open={holdPopoverOpen} onOpenChange={setHoldPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {holdDate
                    ? `${holdDate.toLocaleDateString()} ${holdTime}`
                    : "Pick deadline date & time"}
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
                  <Input
                    id="holdTime"
                    type="time"
                    value={holdTime}
                    onChange={(e) => setHoldTime(e.target.value)}
                    className="h-8"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHoldPopoverOpen(false)}
                  >
                    Done
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              onClick={handleInvoiceHoldPeriod}
              disabled={isLoading === "setInvoiceHoldPeriod" || !holdDate}
              aria-busy={isLoading === "setInvoiceHoldPeriod"}
            >
              {isLoading === "setInvoiceHoldPeriod" ? (
                <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
              ) : (
                "Set Hold Period"
              )}
            </Button>
            <p
              id="holdPeriodDescription"
              className="text-sm text-muted-foreground"
            >
              Sets a custom hold period for a specific invoice.{" "}
              <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                Note: hold period can only be set after the invoice has been accepted.
              </span>
            </p>
          </div>

          <AdminSettingRow
            label="Default Hold Period"
            inputId="defaultHoldPeriod"
            inputProps={{
              type: "number",
              placeholder: "Enter days",
              value: defaultPeriod,
              onChange: (e) => setDefaultPeriod(e.target.value),
            }}
            onAction={handleDefaultPeriod}
            loadingKey="setDefaultHoldPeriod"
            isLoading={isLoading}
            buttonText="Set Default Period"
            description="Updates the default hold period for all new invoices."
          />

          <AdminSettingRow
            label="Decision Window (minutes)"
            inputId="decisionWindow"
            inputProps={{
              type: "number",
              placeholder: "Enter minutes",
              value: decisionWindowInput,
              onChange: (e) => setDecisionWindowInput(e.target.value),
              min: 1,
            }}
            onAction={handleDecisionWindow}
            loadingKey="setDecisionWindow"
            isLoading={isLoading}
            buttonText="Set Decision Window"
            description="Time allowed for sellers to accept/reject after payment (minutes)."
          />

          <AdminSettingRow
            label="Invoice Validity Period (hours)"
            inputId="validPeriod"
            inputProps={{
              type: "number",
              placeholder: "Enter hours",
              value: validPeriodInput,
              onChange: (e) => setValidPeriodInput(e.target.value),
              min: 1,
            }}
            onAction={handleValidPeriod}
            loadingKey="setValidPeriod"
            isLoading={isLoading}
            buttonText="Set Validity"
            description="How long newly created invoices stay payable before expiring (hours)."
          />

          <AdminSettingRow
            label="Set Minimum Invoice Value"
            inputId="setMinimumInvoiceValue"
            inputProps={{
              type: "number",
              placeholder: "Enter value in ETH",
              value: value,
              onChange: (e) => setValue(e.target.value.toString()),
            }}
            onAction={handleMinimumInvoiceValue}
            loadingKey="setMinimumInvoiceValue"
            isLoading={isLoading}
            buttonText="Set Minimum Value"
            description="Updates the minimum invoice value."
          />

          {/* Set Fee: custom onChange validation */}
          <div className="space-y-1.5">
            <Label htmlFor="setFee">Set Fee</Label>
            <div className="flex gap-2">
              <Input
                id="setFee"
                type="number"
                placeholder="Enter fee percentage"
                value={sDaoFee}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || (Number(v) >= 0 && Number(v) < 30)) {
                    setDaoFee(v);
                  }
                }}
                max={49.99}
                min={0}
                aria-describedby="setFeeDescription"
                className="w-full"
              />
              <Button
                onClick={handleDaoFee}
                disabled={isLoading === "setFee"}
                aria-busy={isLoading === "setFee"}
              >
                {isLoading === "setFee" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : (
                  "Set Fee"
                )}
              </Button>
            </div>
            <p
              id="setFeeDescription"
              className="text-sm text-muted-foreground"
            >
              Updates the fee for using Sapphire DAO service.
            </p>
          </div>

          <AdminSettingRow
            label="Set New Marketplace Address"
            inputId="setMarketplaceAddress"
            inputProps={{
              placeholder: "Enter address (0x...)",
              value: marketplaceAddress,
              onChange: (e) => setMarketplaceKeeper(e.target.value),
            }}
            onAction={handleMarketplaceAddress}
            loadingKey="setMarketplaceAddress"
            isLoading={isLoading}
            buttonText="Set Marketplace Address"
            description="Updates the Marketplace Keeper Address."
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCard;
