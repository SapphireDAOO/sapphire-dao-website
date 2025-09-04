"use client";
import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContractContext } from "@/context/contract-context";
import { Loader2 } from "lucide-react";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useGetFeeReceiver } from "@/hooks/useGetFeeReceiver";
import { Address } from "viem";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useGetDefaultHoldPeriod } from "@/hooks/useGetDefaultHoldPeriod";
import { useGetMinimumInvoiceValue } from "@/hooks/useGetMinimumInvoiceValue";
import { ethers } from "ethers";
import { useGetMarketplaceWallet } from "@/hooks/useGetMarketplaceWallet";

// Utility function to truncate addresses
const truncateAddress = (address: string | undefined) =>
  address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Loading...";

const AdminCard = () => {
  const { isLoading: isAllowedAddressLoading } = useGetOwner();
  const { data: fee } = useGetFeeRate();
  const { data: defaultHoldPeriod } = useGetDefaultHoldPeriod();
  const { data: minimumInvoiceValue } = useGetMinimumInvoiceValue();
  const { data: marketplaceKeeperAddress } = useGetMarketplaceWallet();
  const { data: feeReceiver } = useGetFeeReceiver();

  const [receiversAdd, setReceiverAdd] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [orderId, setorderId] = useState("");
  const [holdPeriod, setHoldPeriod] = useState("");
  const [defaultPeriod, setDefaultPeriod] = useState("");
  const [sDaoFee, setDaoFee] = useState("");
  const [value, setValue] = useState("");
  const [marketplaceAddress, setMarketplaceKeeper] = useState("");

  const {
    setFeeReceiversAddress,
    setInvoiceHoldPeriod,
    setDefaultHoldPeriod,
    setFee,
    transferOwnership,
    setMinimumInvoiceValue,
    setMarketplaceAddress,
    isLoading,
  } = useContext(ContractContext);

  const handleReceiverAdd = async () => {
    await setFeeReceiversAddress(receiversAdd as Address);
  };

  const handleMarketplaceAddress = async () => {
    await setMarketplaceAddress(marketplaceAddress as Address);
  };

  const handleOwnerAddress = async () => {
    await transferOwnership(ownerAddr as Address);
  };

  const handleInvoiceHoldPeriod = async () => {
    const holdPeriodInSecond = Math.round(Number(holdPeriod)) * 24 * 60 * 60;
    await setInvoiceHoldPeriod(BigInt(orderId), BigInt(holdPeriodInSecond));
  };

  const handleDefaultPeriod = async () => {
    const defaultPeriodInSecond = BigInt(Number(defaultPeriod) * 24 * 60 * 60);
    await setDefaultHoldPeriod(defaultPeriodInSecond);
  };

  const handleDaoFee = async () => {
    const sDaoFeeInBps = BigInt(parseInt(sDaoFee) * 100);
    await setFee(sDaoFeeInBps);
  };

  const handleMinimumInvoiceValue = async () => {
    const v = ethers.parseEther(value);
    await setMinimumInvoiceValue(v);
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
                  href={`https://sepolia.etherscan.io/address/${feeReceiver}`}
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
                  href={`https://sepolia.etherscan.io/address/${marketplaceKeeperAddress}`}
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
          <div className="space-y-1.5">
            <Label htmlFor="setAdminAddress">Set New Admin</Label>
            <div className="flex gap-2">
              <Input
                id="setAdminAddress"
                placeholder="Enter address (0x...)"
                value={ownerAddr}
                onChange={(e) => setOwnerAddr(e.target.value)}
                aria-describedby="setAdminAddressDescription"
                className="w-full"
              />
              <Button
                onClick={handleOwnerAddress}
                disabled={isLoading === "transferOwnership"}
                aria-busy={isLoading === "transferOwnership"}
              >
                {isLoading === "transferOwnership" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : (
                  "Update Admin"
                )}
              </Button>
            </div>
            <p
              id="setAdminAddressDescription"
              className="text-sm text-muted-foreground"
            >
              Updates the admin of the fee receiver.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="setFeeReceiverAddress">
              Set Fee Receiver Address
            </Label>
            <div className="flex gap-2">
              <Input
                id="setFeeReceiverAddress"
                placeholder="Enter address (0x...)"
                value={receiversAdd}
                onChange={(e) => setReceiverAdd(e.target.value)}
                aria-describedby="setFeeReceiverAddressDescription"
                className="w-full"
              />
              <Button
                onClick={handleReceiverAdd}
                disabled={isLoading === "setFeeReceiversAddress"}
                aria-busy={isLoading === "setFeeReceiversAddress"}
              >
                {isLoading === "setFeeReceiversAddress" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : (
                  "Set Fee Receiver"
                )}
              </Button>
            </div>
            <p
              id="setFeeReceiverAddressDescription"
              className="text-sm text-muted-foreground"
            >
              Updates the address of the fee receiver.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="holdPeriodID">Invoice Hold Period</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                id="holdPeriodID"
                placeholder="Invoice ID"
                type="number"
                value={orderId}
                onChange={(e) => setorderId(e.target.value)}
                aria-describedby="holdPeriodDescription"
                className="w-full"
              />
              <Input
                id="invoicePeriod"
                placeholder="Enter days"
                type="number"
                value={holdPeriod}
                onChange={(e) => setHoldPeriod(e.target.value)}
                aria-describedby="holdPeriodDescription"
                className="w-full"
              />
            </div>
            <Button
              onClick={handleInvoiceHoldPeriod}
              disabled={isLoading === "setInvoiceHoldPeriod"}
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
              Sets a custom hold period for a specific invoice.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="defaultHoldPeriod">Default Hold Period</Label>
            <div className="flex gap-2">
              <Input
                id="defaultHoldPeriod"
                type="number"
                placeholder="Enter days"
                value={defaultPeriod}
                onChange={(e) => setDefaultPeriod(e.target.value)}
                aria-describedby="defaultHoldPeriodDescription"
                className="w-full"
              />
              <Button
                onClick={handleDefaultPeriod}
                disabled={isLoading === "setDefaultHoldPeriod"}
                aria-busy={isLoading === "setDefaultHoldPeriod"}
              >
                {isLoading === "setDefaultHoldPeriod" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : (
                  "Set Default Period"
                )}
              </Button>
            </div>
            <p
              id="defaultHoldPeriodDescription"
              className="text-sm text-muted-foreground"
            >
              Updates the default hold period for all new invoices.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="setMinimumInvoiceValue">
              Set Minimum Invoice Value
            </Label>
            <div className="flex gap-2">
              <Input
                id="setMinimumInvoiceValue"
                type="number"
                placeholder="Enter value in ETH"
                value={value}
                onChange={(e) => setValue(e.target.value.toString())}
                aria-describedby="setMinimumInvoiceValueDescription"
                className="w-full"
              />
              <Button
                onClick={handleMinimumInvoiceValue}
                disabled={isLoading === "setMinimumInvoiceValue"}
                aria-busy={isLoading === "setMinimumInvoiceValue"}
              >
                {isLoading === "setMinimumInvoiceValue" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : (
                  "Set Minimum Value"
                )}
              </Button>
            </div>
            <p
              id="setMinimumInvoiceValueDescription"
              className="text-sm text-muted-foreground"
            >
              Updates the minimum invoice value.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="setFee">Set Fee</Label>
            <div className="flex gap-2">
              <Input
                id="setFee"
                type="number"
                placeholder="Enter fee percentage"
                value={sDaoFee}
                onChange={(e) => {
                  const value = e.target.value;
                  if (
                    value === "" ||
                    (Number(value) >= 0 && Number(value) < 30)
                  ) {
                    setDaoFee(value);
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
            <p id="setFeeDescription" className="text-sm text-muted-foreground">
              Updates the fee for using Sapphire DAO service.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="setMarketplaceAddress">
              Set New Marketplace Address
            </Label>
            <div className="flex gap-2">
              <Input
                id="setMarketplaceAddress"
                placeholder="Enter address (0x...)"
                value={marketplaceAddress}
                onChange={(e) => setMarketplaceKeeper(e.target.value)}
                aria-describedby="setMarketplaceAddressDescription"
                className="w-full"
              />
              <Button
                onClick={handleMarketplaceAddress}
                disabled={isLoading === "setMarketplaceAddress"}
                aria-busy={isLoading === "setMarketplaceAddress"}
              >
                {isLoading === "setMarketplaceAddress" ? (
                  <Loader2 className="inline-flex animate-spin h-4 w-4 text-green-300" />
                ) : (
                  "Set Marketplace Address"
                )}
              </Button>
            </div>
            <p
              id="setMarketplaceAddressDescription"
              className="text-sm text-muted-foreground"
            >
              Updates the Marketplace Keeper Address.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminCard;
