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
import { Textarea } from "@/components/ui/textarea";
import { NoteLength } from "@/components/NoteLength";
import { DEFAULT_HOLD_PERIOD_SECONDS, MAX_NOTE_LENGTH } from "@/constants";
import { formatDurationSeconds } from "@/utils";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useGetMinimumInvoiceValue } from "@/hooks/useGetMinimumInvoiceValue";
import { ContractContext } from "@/context/contract-context";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther, parseEther, parseUnits } from "viem";
import { Loader2, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { usePayLink } from "@/hooks/usePayLink";
import { sealNote } from "@/lib/noteCrypto";
import { useNoteKeys } from "@/hooks/useNoteKeys";
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
    const paymentUrl = usePayLink(invoiceId, "pay");

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
  },
);

InvoiceQRLink.displayName = "InvoiceQRLink";

export default function CreateInvoiceDialog() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const noteKeys = useNoteKeys();
  const { chainId, address } = useAccount();
  const { data: formatedFee } = useGetFeeRate();

  const [openCreate, setOpenCreate] = useState(false);
  const [openQR, setOpenQR] = useState(false);
  const [invoiceId, setinvoiceId] = useState<bigint>(BigInt(0));
  const [isCreating, setIsCreating] = useState(false);

  const { createInvoice, refetchInvoiceData, isLoading } =
    useContext(ContractContext);

  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId || BASE_SEPOLIA];

  const { data: minimumInvoiceValue } = useGetMinimumInvoiceValue();
  const minimumEth = minimumInvoiceValue
    ? formatEther(minimumInvoiceValue)
    : undefined;

  // The contract rejects anything under its minimum, so check it here rather
  // than letting the transaction fail after the wallet prompt. parseEther
  // throws on input Number() still accepts, such as a lone space, so a bad
  // value is treated as "not yet below the minimum" and left to the normal
  // amount validation to reject.
  const isAboveMinimum = (() => {
    if (minimumInvoiceValue === undefined || !amount) return true;
    try {
      return parseEther(amount) >= minimumInvoiceValue;
    } catch {
      return true;
    }
  })();

  const isAmountValid =
    !!amount &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0 &&
    isAboveMinimum;

  const handleClick = useCallback(async () => {
    if (!isAmountValid) return;

    // First click with no hold period asks for confirmation instead of
    // creating; the second click goes through.
    setIsCreating(true);
    try {
      const amountValue = parseUnits(amount, 18);

      // The note goes on chain inside the create transaction, so it is sealed
      // here, to this account alone.
      let storageRef = "0x";
      const trimmedNote = note.trim();
      if (trimmedNote) {
        const keys = noteKeys.keys ?? (await noteKeys.unlock());
        if (!keys) {
          toast.error("Enable messaging to attach a note.");
          setIsCreating(false);
          return;
        }
        storageRef = sealNote(trimmedNote, [keys.publicKey]);
      }

      // Always private. The payer is unknown at creation, so there is no key
      // to seal a shared note to; it would be marked shared and readable by
      // nobody but the author.
      const response = await createInvoice(
        amountValue,
        storageRef,
        false,
        DEFAULT_HOLD_PERIOD_SECONDS,
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
    noteKeys,
    isAmountValid,
    createInvoice,
    refetchInvoiceData,
    note,
  ]);

  return (
    <>
      <Dialog
        open={openCreate}
        onOpenChange={(open) => {
          setOpenCreate(open);
        }}
      >
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
              A {Number(formatedFee) / 100}% fee is deducted from the payment
              when it is released to you
            </DialogDescription>
          </DialogHeader>

          {/* A fixed term of every invoice, not something chosen here, so it
              is stated once at the top rather than sitting among the inputs. */}
          <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <p className="text-xs leading-snug text-gray-600">
              Payments are held in escrow for{" "}
              <span className="font-medium text-gray-900">
                {formatDurationSeconds(DEFAULT_HOLD_PERIOD_SECONDS)}
              </span>{" "}
              after you accept an invoice, then released to you. The payer sees
              this before paying.
            </p>
          </div>

          {contractAddress && (
            <InvoiceField
              label="Contract"
              value={renderContractLink(contractAddress)}
              description="The deployed invoice smart contract that manages escrow and release logic."
              link={`https://sepolia.basescan.org/address/${contractAddress}`}
            />
          )}

          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
              <Label htmlFor="amount" className="text-left sm:pt-2.5 sm:text-right">
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
                  {minimumEth ? ` Minimum ${minimumEth} ETH.` : ""}
                </p>
                {!isAboveMinimum && minimumEth && (
                  <p className="text-[11px] text-red-600">
                    Below the {minimumEth} ETH minimum.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
              <Label htmlFor="note" className="text-left sm:pt-2.5 sm:text-right">
                Note
              </Label>
              <div className="sm:col-span-3 space-y-2">
                <Textarea
                  id="note"
                  value={note}
                  placeholder="e.g. MacBook Pro, delivery in 3 days"
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full h-24 resize-none"
                  maxLength={MAX_NOTE_LENGTH}
                />
                <NoteLength value={note} />
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
                  !isAmountValid || isCreating || isLoading === "createInvoice"
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
