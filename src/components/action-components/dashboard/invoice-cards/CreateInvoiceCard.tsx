"use client";

import { useConnection } from "wagmi";
import { useContext, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NoteLength } from "@/components/NoteLength";
import { MAX_NOTE_LENGTH, MINIMUM_INVOICE_VALUE } from "@/constants";
import { formatDurationSeconds } from "@/utils";
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { useEscrowHoldPeriod } from "@/hooks/useEscrowHoldPeriod";
import { useUsdPrice } from "@/hooks/useUsdPrice";
import {
  ContractActionsContext,
  ContractLoadingContext,
} from "@/context/contract-context";
import ConnectWalletButton from "@/components/wallet/ConnectWalletButton";
import { formatEther, parseEther, parseUnits } from "viem";
import { Copy, Loader2, Plus, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isUserRejection, WALLET_CANCELLED } from "@/lib/walletErrors";
import { usePayLink } from "@/hooks/usePayLink";
import { sealNote } from "@/lib/noteCrypto";
import { copyText } from "@/lib/clipboard";
import { useNoteKeys } from "@/hooks/useNoteKeys";
import { MessagingKey } from "@/components/action-components/notes/MessagingKey";
import React from "react";
import { BASE_SEPOLIA, SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import {
  AddressLink,
  DetailRow,
  DetailRows,
  SectionLabel,
} from "../invoices/InvoiceCardFrame";
import { formatUsd } from "../amounts";

const dialogClass =
  "flex max-h-[92dvh] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-y-auto overflow-x-hidden rounded-none border-border bg-card p-0 text-foreground sm:rounded-none";

const squareButton = "h-10 rounded-none";

interface InvoiceQRLinkProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  invoiceId: bigint;
  contractAddress?: string;
}

const InvoiceQRLink = React.memo(
  ({ open, setOpen, invoiceId, contractAddress }: InvoiceQRLinkProps) => {
    const paymentUrl = usePayLink(invoiceId, "pay");
    const { data: holdPeriodSeconds } = useEscrowHoldPeriod();

    const handleCopyLink = useCallback(async () => {
      if (await copyText(paymentUrl)) toast.success("Payment link copied!");
      else toast.error("Couldn't copy the payment link.");
    }, [paymentUrl]);

    const steps = [
      <>
        Copy the link and send it to your payer, or let them scan the QR code
        with their phone&apos;s camera.
      </>,
      <>The link opens a page where they connect a wallet and pay in ETH.</>,
      <>
        Once they&apos;ve paid, the invoice shows as{" "}
        <span className="font-medium text-foreground">Awaiting acceptance</span>{" "}
        on your dashboard. Accept it before its deadline, or the payer is
        refunded.
      </>,
      <>
        After you accept, the payment is held in escrow
        {holdPeriodSeconds !== undefined &&
          ` for ${formatDurationSeconds(holdPeriodSeconds)}`}
        , then released to you.
      </>,
    ];

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={dialogClass}>
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <span className="flex items-center gap-2">
              <span
                className="size-2 rounded-full bg-success"
                aria-hidden="true"
              />
              <SectionLabel>Invoice created</SectionLabel>
            </span>
            <DialogTitle className="mt-1.5 text-xl font-semibold tracking-tight">
              Send it to the person paying you
            </DialogTitle>
            <DialogDescription className="sr-only">
              Share the payment link or QR code with your payer.
            </DialogDescription>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="flex flex-col items-center gap-3">
              <div className="border border-border bg-card p-3">
                <QRCodeSVG value={paymentUrl} size={168} level="H" />
              </div>
              <div className="flex w-full items-start gap-2 border border-border bg-background px-3 py-2">
                <span className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-muted-foreground">
                  {paymentUrl}
                </span>
                <button
                  type="button"
                  aria-label="Copy payment link"
                  onClick={handleCopyLink}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Copy className="size-3.5" />
                </button>
              </div>
            </div>

            <ol className="space-y-3">
              {steps.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-sm leading-snug">
                  <span className="font-mono text-xs text-primary">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>

            {contractAddress && (
              <DetailRows>
                <DetailRow label="Contract">
                  <AddressLink address={contractAddress} />
                </DetailRow>
              </DetailRows>
            )}
          </div>

          <div className="border-t border-border px-5 py-4 sm:px-6">
            <Button
              onClick={handleCopyLink}
              className={cn(squareButton, "w-full")}
            >
              Copy payment link
            </Button>
          </div>
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
  const { chainId, address } = useConnection();
  const { data: formatedFee } = useGetFeeRate();
  const { data: ethUsd } = useUsdPrice("ETH");

  const [openCreate, setOpenCreate] = useState(false);
  const [openQR, setOpenQR] = useState(false);
  const [invoiceId, setinvoiceId] = useState<bigint>(BigInt(0));
  const [isCreating, setIsCreating] = useState(false);

  const { createInvoice } = useContext(ContractActionsContext);
  const isLoading = useContext(ContractLoadingContext);

  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId || BASE_SEPOLIA];

  const { data: holdPeriodSeconds } = useEscrowHoldPeriod();
  const minimumEth = formatEther(MINIMUM_INVOICE_VALUE);

  // parseEther throws on input Number() accepts (e.g.
  // " "); that's left to the amount validation.
  const isAboveMinimum = (() => {
    if (!amount) return true;
    try {
      return parseEther(amount) >= MINIMUM_INVOICE_VALUE;
    } catch {
      return true;
    }
  })();

  // Required so the payer can always write notes back to the seller.
  const hasPublishedKey = Boolean(noteKeys.registeredKey);

  const isAmountValid =
    !!amount &&
    !isNaN(Number(amount)) &&
    Number(amount) > 0 &&
    isAboveMinimum;

  const usdEstimate =
    ethUsd && amount && Number(amount) > 0
      ? `≈ ${formatUsd(Number(amount) * ethUsd)}`
      : null;

  const handleClick = useCallback(async () => {
    if (!isAmountValid) return;
    if (!hasPublishedKey) {
      toast.error("Publish your messaging key before creating an invoice.");
      return;
    }

    setIsCreating(true);
    try {
      const amountValue = parseUnits(amount, 18);

      let storageRef = "0x";
      const trimmedNote = note.trim();
      if (trimmedNote) {
        const { keys, rejected } = await noteKeys.unlockWithResult();
        if (!keys) {
          if (rejected) toast(WALLET_CANCELLED);
          else toast.error("Enable messaging to attach a note.");
          setIsCreating(false);
          return;
        }
        storageRef = sealNote(trimmedNote, [keys.publicKey]);
      }

      // Always private: the payer is unknown at
      // creation, so there is no key to share to.
      const response = await createInvoice(amountValue, storageRef, false);

      if (response) {
        setinvoiceId(response);

        setOpenCreate(false);
        setOpenQR(true);
        toast.success("Invoice created successfully!");
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (isUserRejection(error)) {
        toast(WALLET_CANCELLED);
        return;
      }
      console.error("Create invoice error:", error);
      toast.error(error?.message || "Transaction failed");
    } finally {
      setIsCreating(false);
    }
  }, [
    amount,
    noteKeys,
    hasPublishedKey,
    isAmountValid,
    createInvoice,
    note,
  ]);

  const isSubmitting = isCreating || isLoading === "createInvoice";

  return (
    <>
      <Dialog open={openCreate} onOpenChange={setOpenCreate}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-none border-primary bg-transparent text-primary hover:bg-primary/5 hover:text-primary"
          >
            <Plus className="size-4" aria-hidden="true" />
            Request payment
          </Button>
        </DialogTrigger>

        <DialogContent className={dialogClass}>
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <SectionLabel>Request payment</SectionLabel>
            <DialogTitle className="mt-1.5 text-xl font-semibold tracking-tight">
              New invoice
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              Set the amount, then share the payment link with your payer.
            </DialogDescription>
          </div>

          <div className="space-y-6 px-5 py-5 sm:px-6">
            {address &&
              noteKeys.registeredKeyLoaded &&
              !noteKeys.registeredKey && <MessagingKey />}

            <div>
              <label htmlFor="amount">
                <SectionLabel>Amount</SectionLabel>
              </label>
              <div
                className={cn(
                  "mt-2 flex items-baseline gap-2 border-b-2 pb-1 transition-colors focus-within:border-primary",
                  isAboveMinimum ? "border-border" : "border-destructive",
                )}
              >
                <input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  placeholder="0.05"
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="any"
                  autoComplete="off"
                  className="w-full min-w-0 bg-transparent font-mono text-4xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/40"
                />
                <span className="text-base font-medium text-muted-foreground">
                  ETH
                </span>
              </div>
              <p className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{usdEstimate}</span>
                {minimumEth && (
                  <span
                    className={
                      isAboveMinimum
                        ? "text-muted-foreground"
                        : "text-destructive"
                    }
                  >
                    {isAboveMinimum ? "Minimum" : "Below the minimum of"}{" "}
                    {minimumEth} ETH
                  </span>
                )}
              </p>
            </div>

            <div>
              <label htmlFor="note" className="flex items-baseline gap-2">
                <SectionLabel>Note</SectionLabel>
                <span className="text-xs text-muted-foreground">
                  Optional, encrypted
                </span>
              </label>
              <textarea
                id="note"
                value={note}
                placeholder="e.g. MacBook Pro, delivery in 3 days"
                onChange={(e) => setNote(e.target.value)}
                maxLength={MAX_NOTE_LENGTH}
                className="mt-2 h-24 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
              />
              <NoteLength value={note} />
            </div>

            <DetailRows>
              {formatedFee !== undefined && (
                <DetailRow label="Fee">
                  {Number(formatedFee) / 100}%{" "}
                  <span className="font-sans text-muted-foreground">
                    on release
                  </span>
                </DetailRow>
              )}
              {holdPeriodSeconds !== undefined && (
                <DetailRow label="Escrow hold">
                  <span className="font-sans">
                    {formatDurationSeconds(holdPeriodSeconds)} after you
                    accept
                  </span>
                </DetailRow>
              )}
              {contractAddress && (
                <DetailRow label="Contract">
                  <AddressLink address={contractAddress} />
                </DetailRow>
              )}
            </DetailRows>
          </div>

          <div className="flex items-start gap-2 bg-muted px-5 py-3 text-xs leading-snug text-muted-foreground sm:px-6">
            <QrCode className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Once it&apos;s created, you&apos;ll get a payment link and a QR
            code to send to the payer.
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            <DialogClose asChild>
              <Button variant="outline" className={squareButton}>
                Cancel
              </Button>
            </DialogClose>

            {address ? (
              <Button
                onClick={handleClick}
                disabled={!isAmountValid || !hasPublishedKey || isSubmitting}
                className={cn(squareButton, "sm:min-w-36")}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Create invoice"
                )}
              </Button>
            ) : (
              <div className="flex justify-center">
                <ConnectWalletButton />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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
