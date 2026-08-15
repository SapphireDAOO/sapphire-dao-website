"use client";

import { useAccount } from "wagmi";
import { useContext, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { ContractContext } from "@/context/contract-context";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";
import { Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { useSecureLink } from "@/hooks/useSecureLink";
import React from "react";
import { BASE_SEPOLIA, SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import {
  renderContractLink,
  InvoiceField,
} from "@/components/action-components/dashboard/invoices/InvoiceCardShared";

interface InvoiceQRLinkProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  invoiceId: bigint;
  contractAddress?: string;
}

const InvoiceQRLink = React.memo(
  ({ open, setOpen, invoiceId, contractAddress }: InvoiceQRLinkProps) => {
    const paymentUrl = useSecureLink(invoiceId, "pay");

    const handleCopyLink = useCallback(() => {
      navigator.clipboard.writeText(paymentUrl);
      toast.success("Payment link copied!");
    }, [paymentUrl]);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] max-w-md sm:max-w-lg p-6 sm:p-8 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Invoice Created!
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Scan the QR code or share the link to receive payment
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <QRCodeSVG value={paymentUrl} size={180} level="H" includeMargin />

            {contractAddress && (
              <p className="text-sm text-gray-700 text-center">
                Contract:{" "}
                <a
                  href={`https://sepolia.basescan.org/address/${contractAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}
                </a>
              </p>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-between">
            <DialogClose asChild>
              <Button variant="secondary" className="w-full sm:w-auto">
                Close
              </Button>
            </DialogClose>
            <Button onClick={handleCopyLink} className="w-full sm:w-auto">
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

InvoiceQRLink.displayName = "InvoiceQRLink";

// The contract takes the hold period as seconds (uint32); the dialog collects
// it as value + unit so nobody has to convert durations by hand.
const HOLD_UNIT_SECONDS = {
  minutes: 60,
  hours: 60 * 60,
  days: 24 * 60 * 60,
} as const;

type HoldUnit = keyof typeof HOLD_UNIT_SECONDS;

const MAX_HOLD_PERIOD_SECONDS = 2 ** 32 - 1;

export default function CreateInvoiceDialog() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [shareNote, setShareNote] = useState(false);
  const [holdValue, setHoldValue] = useState("");
  const [holdUnit, setHoldUnit] = useState<HoldUnit>("days");
  const { chainId, address } = useAccount();
  const { data: formatedFee } = useGetFeeRate();

  const [openCreate, setOpenCreate] = useState(false);
  const [openQR, setOpenQR] = useState(false);
  const [invoiceId, setinvoiceId] = useState<bigint>(BigInt(0));
  const [isCreating, setIsCreating] = useState(false);

  const { createInvoice, refetchInvoiceData, isLoading } =
    useContext(ContractContext);

  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId || BASE_SEPOLIA];

  const isAmountValid =
    !!amount && !isNaN(Number(amount)) && Number(amount) > 0;

  // Empty input means no hold period (0 seconds).
  const holdPeriodSeconds =
    holdValue.trim() === ""
      ? 0
      : Math.floor(Number(holdValue) * HOLD_UNIT_SECONDS[holdUnit]);

  const isHoldPeriodValid =
    Number.isFinite(holdPeriodSeconds) &&
    holdPeriodSeconds >= 0 &&
    holdPeriodSeconds <= MAX_HOLD_PERIOD_SECONDS;

  const handleClick = useCallback(async () => {
    if (!isAmountValid || !isHoldPeriodValid) return;

    setIsCreating(true);
    try {
      const amountValue = parseUnits(amount, 18);

      const response = await createInvoice(
        amountValue,
        note.trim(),
        shareNote,
        holdPeriodSeconds,
      );

      if (response) {
        setinvoiceId(response);

        setOpenCreate(false);
        setOpenQR(true);
        // Refresh dashboard data after showing the QR to keep timing in sync
        void refetchInvoiceData?.();
        toast.success("Invoice created successfully!");
      } else {
        toast.error("Failed to create invoice");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.error("Create invoice error:", error);
      toast.error(error?.message || "Transaction failed");
    } finally {
      setIsCreating(false);
    }
  }, [
    amount,
    isAmountValid,
    isHoldPeriodValid,
    holdPeriodSeconds,
    createInvoice,
    refetchInvoiceData,
    note,
    shareNote,
  ]);

  return (
    <>
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogTrigger asChild>
          <div className="bg-black text-white rounded-xl p-5 shadow-md hover:shadow-xl transition cursor-pointer select-none">
            <h3 className="text-lg font-bold">+ Request Payment</h3>
            <p className="text-sm opacity-90">
              Create a new invoice with note thread
            </p>
          </div>
        </DialogTrigger>

        <DialogContent className="w-full max-w-lg sm:max-w-md md:max-w-lg lg:w-1/2 px-4 sm:px-6 py-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold">
              New Invoice
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-1">
              Additional fee of {Number(formatedFee) / 100}% applies (excluding
              gas)
            </DialogDescription>
          </DialogHeader>

          {contractAddress && (
            <InvoiceField
              label="Contract"
              value={renderContractLink(contractAddress)}
              description="The deployed invoice smart contract that manages escrow and release logic."
              link={`https://sepolia.basescan.org/address/${contractAddress}`}
            />
          )}

          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="amount" className="text-left sm:text-right">
                Amount
              </Label>
              <div className="sm:col-span-3 w-full space-y-1">
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  placeholder="0.05"
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full"
                  min="0"
                  step="any"
                />
                <p className="text-[11px] text-gray-500">
                  Amounts are in ETH.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="holdPeriod" className="text-left sm:text-right">
                Hold Period
              </Label>
              <div className="sm:col-span-3 w-full space-y-1">
                <div className="flex gap-2">
                  <Input
                    id="holdPeriod"
                    type="number"
                    value={holdValue}
                    placeholder="e.g. 3"
                    onChange={(e) => setHoldValue(e.target.value)}
                    className="w-full"
                    min="0"
                    step="any"
                  />
                  <Select
                    value={holdUnit}
                    onValueChange={(value) => setHoldUnit(value as HoldUnit)}
                  >
                    <SelectTrigger className="w-32 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutes">Minutes</SelectItem>
                      <SelectItem value="hours">Hours</SelectItem>
                      <SelectItem value="days">Days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[11px] text-gray-500">
                  {!isHoldPeriodValid
                    ? "Enter a valid, non-negative duration."
                    : "Optional. Escrow holds the payment for this long, counting from when you accept the invoice. Leave empty for no hold."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
              <Label htmlFor="note" className="text-left sm:text-right pt-1">
                Note
              </Label>
              <div className="sm:col-span-3 space-y-2">
                <Textarea
                  id="note"
                  value={note}
                  placeholder="e.g. MacBook Pro, delivery in 3 days"
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-24 resize-none"
                />
                <label className="flex items-center gap-2 text-[11px] text-gray-600">
                  <input
                    type="checkbox"
                    checked={shareNote}
                    onChange={(e) => setShareNote(e.target.checked)}
                    className="h-3.5 w-3.5"
                  />
                  <span>
                    Share with the payer (leave unchecked to keep it private)
                  </span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-3 mt-3">
            <DialogClose asChild>
              <Button variant="secondary" className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>

            {address ? (
              <Button
                onClick={handleClick}
                disabled={
                  !isAmountValid ||
                  !isHoldPeriodValid ||
                  isCreating ||
                  isLoading === "createInvoice"
                }
                className="w-full sm:w-auto"
              >
                {isCreating || isLoading === "createInvoice" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Invoice"
                )}
              </Button>
            ) : (
              <div className="w-full sm:w-auto flex justify-center">
                <ConnectButton chainStatus="icon" showBalance={false} />
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Only mount QR dialog when needed */}
      {openQR && (
        <InvoiceQRLink
          open={openQR}
          setOpen={setOpenQR}
          invoiceId={invoiceId}
          contractAddress={contractAddress}
        />
      )}
    </>
  );
}
