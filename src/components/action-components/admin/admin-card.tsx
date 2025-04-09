"use client";
import { useContext, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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

const AdminCard = () => {
  const { isLoading: isAllowedAddressLoading } = useGetOwner();
  const { data: fee } = useGetFeeRate();

  const { data: defaultHoldPeriod } = useGetDefaultHoldPeriod();
  const { data: minimumInvoiceValue } = useGetMinimumInvoiceValue();

  const { data: feeReceiver } = useGetFeeReceiver();

  const [receiversAdd, setReceiverAdd] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [holdPeriod, setHoldPeriod] = useState("");
  const [defaultPeriod, setDefaultPeriod] = useState("");
  const [sDaoFee, setDaoFee] = useState("");
  const [value, setValue] = useState("");

  const {
    setFeeReceiversAddress,
    setInvoiceHoldPeriod,
    setDefaultHoldPeriod,
    setFee,
    transferOwnership,
    setMinimumInvoiceValue,
    isLoading,
  } = useContext(ContractContext);

  const handleReceiverAdd = async () => {
    await setFeeReceiversAddress(receiversAdd as Address);
  };

  const handleOwnerAddress = async () => {
    await transferOwnership(ownerAddr as Address);
  };

  const handleInvoiceHoldPeriod = async () => {
    const invoiceIdBigNumber = BigInt(invoiceId);
    const holdPeriodInSecond = Number(holdPeriod) * 24 * 60 * 60;
    await setInvoiceHoldPeriod(invoiceIdBigNumber, holdPeriodInSecond);
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
      <Card className="w-[450px] flex items-center justify-center">
        <Loader2
          className="inline-flex animate-spin"
          size={40}
          color="#4CAF50"
        />
        <p className="text-muted-foreground mt-4">Loading...</p>
      </Card>
    );
  }

  return (
    <Card className="w-[450px]">
      <CardHeader>
        <CardTitle>Admin Page</CardTitle>
        <CardDescription>
          Only permitted address are allowed to see this page
        </CardDescription>
        <div className="mt-4 bg-muted p-3 rounded">
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">
              Current Fee Receiver:{" "}
            </span>
            <span className="font-mono text-primary">
              {feeReceiver
                ? `${feeReceiver.slice(0, 8)}...${feeReceiver.slice(-6)}`
                : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium">
            <span className="text-muted-foreground">
              Current Default Hold period:{" "}
            </span>
            <span className="font-mono text-primary">
              {defaultHoldPeriod
                ? (Number(defaultHoldPeriod) / 60).toFixed(2) + " minutes"
                : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium mt-2">
            <span className="text-muted-foreground">Current Fee: </span>
            <span className="font-mono text-primary">
              {fee ? parseInt(fee.toString()) / 100 + "%" : "Loading..."}
            </span>
          </p>
          <p className="text-sm font-medium mt-2">
            <span className="text-muted-foreground">
              Minimum Invoice Value:{" "}
            </span>
            <span className="font-mono text-primary">
              {minimumInvoiceValue
                ? ethers.formatEther(minimumInvoiceValue) + " POL"
                : "Loading..."}
            </span>
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="my-3 space-y-1.5">
            <Label htmlFor="setFeeAdd">Set New Admin</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="setFeeAdd"
                placeholder="0xxxxx"
                value={ownerAddr}
                onChange={(e) => setOwnerAddr(e.target.value)}
              />
              <Button onClick={handleOwnerAddress}>
                {isLoading === "setFeeReceiversAddress" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "SET"
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Updates the admin of the fee receiver.
            </p>
          </div>
          <div className="my-3 space-y-1.5">
            <Label htmlFor="setFeeAdd">Set Fee receivers address</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="setFeeAdd"
                placeholder="0xxxxx"
                value={receiversAdd}
                onChange={(e) => setReceiverAdd(e.target.value)}
              />
              <Button onClick={handleReceiverAdd}>
                {isLoading === "setFeeReceiversAddress" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "SET"
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Updates the address of the fee receiver.
            </p>
          </div>

          <div className="my-3 space-y-1.5">
            <Label htmlFor="holdPeriodID">Invoice Hold period</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="holdPeriodID"
                placeholder="Invoice Id"
                type="number"
                value={invoiceId}
                onChange={(e) => setInvoiceId(e.target.value)}
              />
              <Input
                id="invoicePeriod"
                placeholder="In Days"
                type="number"
                value={holdPeriod}
                onChange={(e) => setHoldPeriod(e.target.value)}
              />
              <Button onClick={handleInvoiceHoldPeriod}>
                {isLoading === "setInvoiceHoldPeriod" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "SET"
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Sets a custom hold period for a specific invoice.
            </p>
          </div>

          <div className="my-3 space-y-1.5">
            <Label htmlFor="defaulthold">Default Hold Period</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="defaulthold"
                type="number"
                placeholder="In Days"
                value={defaultPeriod}
                onChange={(e) => setDefaultPeriod(e.target.value)}
              />
              <Button onClick={handleDefaultPeriod}>
                {" "}
                {isLoading === "setDefaultHoldPeriod" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "SET"
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Updates the default hold period for all new invoices.
            </p>
          </div>

          <div className="my-3 space-y-1.5">
            <Label htmlFor="setFee">Set Minimum Invoice Value</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="setMinimumInvoiceValue"
                type="number"
                placeholder="minimum invoice value"
                value={sDaoFee}
                onChange={(e) => {
                  setValue(e.target.value.toString());
                }}
              />
              <Button onClick={handleMinimumInvoiceValue}>
                {isLoading === "setMinimumInvoiceValue" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "SET"
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Updates the Minimum Invoice Value
            </p>
          </div>

          <div className="my-3 space-y-1.5">
            <Label htmlFor="setFee">Set Fee</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="setFee"
                type="number"
                placeholder="amount of fee in %"
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
              />
              <Button onClick={handleDaoFee}>
                {isLoading === "setFee" ? (
                  <Loader2
                    className="inline-flex animate-spin"
                    size={10}
                    color="#cee7d6"
                  />
                ) : (
                  "SET"
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Updates the fee for using Sapphire DAO service.
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        {/* <Button variant="outline">Cancel</Button>
        <Button>Deploy</Button> */}
      </CardFooter>
    </Card>
  );
};

export default AdminCard;
