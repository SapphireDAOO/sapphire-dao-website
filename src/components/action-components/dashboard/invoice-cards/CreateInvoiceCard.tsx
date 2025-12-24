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
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { parseUnits } from "viem";
import { Info, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";
import React from "react";
import { ETHEREUM_SEPOLIA, SIMPLE_PAYMENT_PROCESSOR } from "@/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import { formatAddress } from "@/utils";

interface InvoiceQRLinkProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  orderId: bigint;
  contractAddress?: string;
}

export const renderContractLink = (address?: string) => {
  if (!address) return <span className="text-gray-500">—</span>;
  return (
    <a
      href={`https://sepolia.etherscan.io/address/${address}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800"
    >
      {formatAddress(address)}
    </a>
  );
};

/* Small reusable field row with info icon */
export const InvoiceField = ({
  label,
  value,
  description,
  link,
}: {
  label: string;
  value: React.ReactNode;
  description: string;
  link?: string;
}) => {
  return (
    <div className="text-xs text-gray-500 flex flex-wrap items-center gap-1 mt-1">
      <span className="font-medium text-gray-700">{label}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${label} info`}
              className="cursor-pointer flex items-center focus:outline-none"
            >
              <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700 transition" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="w-60 text-xs p-3 bg-white border border-gray-200 rounded-md shadow-md text-gray-700">
            <p>{description}</p>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline hover:text-blue-800 mt-2 inline-block"
              >
                View Details
              </a>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span>:</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
};

const InvoiceQRLink = React.memo(
  ({ open, setOpen, orderId, contractAddress }: InvoiceQRLinkProps) => {
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
                  href={`https://sepolia.etherscan.io/address/${contractAddress}`}
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

export default function CreateInvoiceDialog() {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [shareNote, setShareNote] = useState(false);
  const { chainId, address } = useAccount();
  const { data: formatedFee } = useGetFeeRate();

  const [openCreate, setOpenCreate] = useState(false);
  const [openQR, setOpenQR] = useState(false);
  const [orderId, setOrderId] = useState<bigint>(BigInt(0));
  const [isCreating, setIsCreating] = useState(false);

  const { createInvoice, refetchInvoiceData, isLoading } =
    useContext(ContractContext);

  const contractAddress = SIMPLE_PAYMENT_PROCESSOR[chainId || ETHEREUM_SEPOLIA];

  const isAmountValid =
    !!amount && !isNaN(Number(amount)) && Number(amount) > 0;

  const handleClick = useCallback(async () => {
    if (!isAmountValid) return;

    setIsCreating(true);
    try {
      const amountValue = parseUnits(amount, 18);

      const response = await createInvoice(amountValue, note.trim(), shareNote);

      if (response) {
        setOrderId(response);

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
              link={`https://sepolia.etherscan.io/address/${contractAddress}`}
            />
          )}

          <div className="grid gap-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-center gap-3">
              <Label htmlFor="amount" className="text-left sm:text-right">
                Amount
              </Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                placeholder="0.05 ETH"
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
          orderId={orderId}
          contractAddress={contractAddress}
        />
      )}
    </>
  );
}
