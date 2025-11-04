"use client";

import { useAccount } from "wagmi";
import { useContext, useState, useMemo, useCallback } from "react";
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
import { useGetFeeRate } from "@/hooks/useGetFeeRate";
import { ContractContext } from "@/context/contract-context";
import { ConnectKitButton } from "connectkit";
import { parseUnits } from "viem";
import { Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";
import React from "react";

interface InvoiceQRLinkProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  orderId: bigint;
}

const InvoiceQRLink = React.memo(
  ({ open, setOpen, orderId }: InvoiceQRLinkProps) => {
    const domain = useMemo(() => window.location.origin, []);

    const encodedEncryptedData = useMemo(
      () => generateSecureLink(orderId),
      [orderId]
    );

    const paymentUrl = useMemo(
      () => `${domain}/pay/?data=${encodedEncryptedData}`,
      [domain, encodedEncryptedData]
    );

    const handleCopyLink = useCallback(() => {
      navigator.clipboard.writeText(paymentUrl);
      toast.success("Payment link copied!");
    }, [paymentUrl]);

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-1/2 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Invoice Created!</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Scan the QR code or share the link to receive payment
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center py-6">
            <QRCodeSVG value={paymentUrl} size={200} level="H" includeMargin />
          </div>

          <DialogFooter className="flex gap-3 sm:justify-between">
            <DialogClose asChild>
              <Button variant="secondary">Close</Button>
            </DialogClose>
            <Button onClick={handleCopyLink}>Copy Link</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

InvoiceQRLink.displayName = "InvoiceQRLink";

export default function CreateInvoiceDialog() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const { address } = useAccount();
  const { data: formatedFee } = useGetFeeRate();

  const [openCreate, setOpenCreate] = useState(false);
  const [openQR, setOpenQR] = useState(false);
  const [orderId, setOrderId] = useState<bigint>(BigInt(0));
  const [isCreating, setIsCreating] = useState(false);

  const { createInvoice, refetchInvoiceData, isLoading } =
    useContext(ContractContext);

  const isAmountValid = useMemo(
    () => !!amount && !isNaN(Number(amount)) && Number(amount) > 0,
    // && !!note,
    [amount, note]
  );

  const handleClick = useCallback(async () => {
    if (!isAmountValid) return;

    setIsCreating(true);
    try {
      const amountValue = parseUnits(amount, 18);
      const response = await createInvoice(amountValue);

      if (response) {
        setOrderId(response);
        await refetchInvoiceData?.();
        setOpenCreate(false);
        setOpenQR(true);
        toast.success("Invoice created successfully!");
      } else {
        toast.error("Failed to create invoice");
      }
    } catch (error: any) {
      console.error("Create invoice error:", error);
      toast.error(error?.message || "Transaction failed");
    } finally {
      setIsCreating(false);
    }
  }, [amount, isAmountValid, createInvoice, refetchInvoiceData]);

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

          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="amount" className="text-left sm:text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                placeholder="0.05"
                onChange={(e) => setAmount(e.target.value)}
                className="sm:col-span-3 w-full"
                min="0"
                step="any"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-3">
              <Label htmlFor="note" className="text-left sm:text-right pt-1">
                Note
              </Label>
              <Textarea
                id="note"
                value={note}
                placeholder="e.g. MacBook Pro, delivery in 3 days"
                onChange={(e) => setNote(e.target.value)}
                className="sm:col-span-3 w-full h-24 resize-none"
              />
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
                <ConnectKitButton mode="dark" />
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Only mount QR dialog when needed */}
      {openQR && (
        <InvoiceQRLink open={openQR} setOpen={setOpenQR} orderId={orderId} />
      )}
    </>
  );
}
