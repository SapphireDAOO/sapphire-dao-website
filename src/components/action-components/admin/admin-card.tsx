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
import { formatEther, parseEther } from "ethers";
import { useAccount } from "wagmi";
import { useGetOwner } from "@/hooks/useGetOwner";
import { useGetFeeReceiver } from "@/hooks/useGetFeeReceiver";
import { Address } from "viem";
import { useGetFee } from "@/hooks/useGetFee";
import { useGetDefaultHoldPeriod } from "@/hooks/useGetDefaultHoldPeriod";

const AdminCard = () => {
  const { address } = useAccount();
  const { data: allowedAddress, isLoading: isAllowedAddressLoading } =
    useGetOwner();
  const { data: fee } = useGetFee();

  const { data: defaultHoldPeriod } = useGetDefaultHoldPeriod();

  const { data: feeReceiver } = useGetFeeReceiver();

  const [receiverAdd, setReceiverAdd] = useState("");
  const [ownerAddr, setOwnerAddr] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [holdPeriod, setHoldPeriod] = useState("");
  const [defaultPeriod, setDefaultPeriod] = useState("");
  const [sDaoFee, setDaoFee] = useState("");

  const {
    setFeeReceiversAddress,
    setInvoiceHoldPeriod,
    setDefaultHoldPeriod,
    withdrawFees,
    setFee,
    transferOwnership,
    isLoading,
  } = useContext(ContractContext);

  const handleReceiverAdd = async () => {
    await setFeeReceiversAddress(receiverAdd as Address);
  };

  const handleOwnerAddr = async () => {
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

  const handlesDaoFee = async () => {
    const sDaoFeeInWei = parseEther(sDaoFee);
    await setFee(sDaoFeeInWei);
  };

  const handleWithdrawFee = async () => {
    await withdrawFees();
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

  if (address === "0x" && allowedAddress == "0x") {
    return (
      <Card className="w-[450px]">
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You are not authorized to view this page.</p>
        </CardContent>
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
              {fee ? formatEther(fee!) + " POL" : "Loading..."}
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
              <Button onClick={handleOwnerAddr}>
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
                value={receiverAdd}
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
            <Label htmlFor="setFee">Set Fee</Label>
            <div className="flex flex-col-2 gap-2">
              <Input
                id="setFee"
                type="number"
                placeholder="amount of fee in POL"
                value={sDaoFee}
                onChange={(e) => setDaoFee(e.target.value)}
              />
              <Button onClick={handlesDaoFee}>
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
        <div className="my-3 space-y-1.5">
          <Label htmlFor="setFee">Withdraw fees</Label>
          <div className="flex flex-col-1">
            <Button onClick={handleWithdrawFee} className="w-full">
              {isLoading === "withdrawFees" ? (
                <Loader2
                  className="inline-flex animate-spin"
                  size={10}
                  color="#cee7d6"
                />
              ) : (
                "WITHDRAW"
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Withdraw fee from Sapphire DAO service.
          </p>
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
