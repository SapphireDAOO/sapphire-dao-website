"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { Invoice } from "@/model/model";
import { formatAddress, timeLeft, unixToGMT } from "@/utils";
import { toast } from "sonner";
import generateSecureLink from "@/lib/generate-link";
import { QRCodeSVG } from "qrcode.react";
import { formatUnits } from "viem";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useGetPaymentTokenData } from "@/hooks/useGetPaymentTokenData";
import { NotesThread } from "./notes-thread";

export function MarketplaceCard({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: Invoice;
  isExpanded: boolean;
  onToggle: () => void;
  onAddNote: (invoiceId: string, message: string) => void;
}) {
  const [countdown, setCountdown] = useState<string>("—");

  const isSellerView = invoice.type === "IssuedInvoice";

  const tokenData = useGetPaymentTokenData(invoice.paymentToken ?? "");
  const amount = useMemo(() => {
    const raw = invoice.price;
    const decimals = 8;

    try {
      if (typeof raw === "bigint") {
        return Number(formatUnits(raw, decimals));
      }
      if (typeof raw === "number") {
        return raw / Math.pow(10, decimals);
      }
      if (typeof raw === "string") {
        const asBigInt = BigInt(raw);
        return Number(formatUnits(asBigInt, decimals));
      }
    } catch (error) {
      console.error("Failed to format marketplace price", error);
    }

    return 0;
  }, [invoice.price]);

  /* -------------------------- STATUS NORMALIZATION -------------------------- */

  const normalizeStatus = (status: string): string => {
    const normalized = status?.replace(/_/g, " ").toUpperCase();
    switch (normalized) {
      case "CREATED":
      case "INITIATED":
      case "AWAITING PAYMENT":
        return "AWAITING PAYMENT";

      case "PAID":
        return "PAID";

      case "REFUNDED":
        return "REFUNDED";

      case "CANCELLED":
      case "CANCELED":
        return "CANCELED";

      case "DISPUTED":
        return "DISPUTED";

      case "DISPUTE RESOLVED":
        return "DISPUTE RESOLVED";

      case "DISPUTE DISMISSED":
        return "DISPUTE DISMISSED";

      case "DISPUTE SETTLED":
        return "DISPUTE SETTLED";

      case "RELEASED":
        return "RELEASED";

      default:
        return "Unknown";
    }
  };

  const displayStatus = normalizeStatus(invoice.status || "");

  /* ------------------------------ STATUS COLORS ----------------------------- */

  const statusColors: Record<string, string> = {
    "AWAITING PAYMENT": "bg-blue-100 text-blue-800",
    PAID: "bg-orange-100 text-orange-800",
    REFUNDED: "bg-indigo-100 text-indigo-800",
    CANCELED: "bg-gray-100 text-gray-800",
    DISPUTED: "bg-pink-100 text-pink-800",
    "DISPUTE RESOLVED": "bg-teal-100 text-teal-800",
    "DISPUTE DISMISSED": "bg-yellow-100 text-yellow-800",
    "DISPUTE SETTLED": "bg-purple-100 text-purple-800",
    RELEASED: "bg-green-100 text-green-800",

    Unknown: "bg-gray-100 text-gray-600",
  };

  const badgeColor = statusColors[displayStatus] ?? statusColors["Unknown"];

  /* ------------------------------- COUNTDOWN -------------------------------- */

  useEffect(() => {
    if (displayStatus !== "PAID" || !invoice.releaseAt) {
      setCountdown("—");
      return;
    }

    const interval = setInterval(() => {
      const updated = timeLeft(
        invoice.paidAt ? Number(invoice.paidAt) : null,
        0,
        Number(invoice.releaseAt) * 1000
      );

      setCountdown(updated);
      if (updated === "Time Elapsed") clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [displayStatus, invoice.releaseAt, invoice.paidAt]);

  const countdownLabel = displayStatus === "PAID" ? "Release in" : null;

  const ensureExpanded = useCallback(() => {
    if (!isExpanded) onToggle();
  }, [isExpanded, onToggle]);

  const shareLabel = useMemo(() => {
    if (isSellerView) {
      return invoice.buyer
        ? `Share with payer ${formatAddress(invoice.buyer)}`
        : "Share with payer";
    }
    return invoice.seller
      ? `Share with creator ${formatAddress(invoice.seller)}`
      : "Share with creator";
  }, [invoice.buyer, invoice.seller, isSellerView]);

  /* ------------------------------ PAYMENT LINK ------------------------------ */

  const paymentUrl = useMemo(() => {
    if (!isExpanded || !invoice.orderId) return "";
    try {
      const domain = window.location.origin;
      const encoded = generateSecureLink(invoice.orderId.toString());
      return `${domain}/checkout/?data=${encoded}`;
    } catch {
      return "";
    }
  }, [isExpanded, invoice.orderId]);

  const handleCopyLink = useCallback(() => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Payment link copied!");
  }, [paymentUrl]);

  /* ------------------------------ UI RENDER -------------------------------- */

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">#{invoice.id}</h3>

          <div className="flex items-center gap-2">
            <Badge
              className={`${badgeColor} cursor-default`}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {displayStatus}
            </Badge>

            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </div>

        {/* Countdown (PAID → releaseAt) */}
        {countdownLabel && (
          <InvoiceField
            label={countdownLabel}
            value={countdown}
            description="Time remaining before payment is released to the seller."
          />
        )}

        {/* Paid timestamp */}
        {displayStatus === "PAID" && invoice.paidAt && (
          <InvoiceField
            label="Paid At"
            value={unixToGMT(invoice.paidAt)}
            description="Timestamp when payment entered escrow."
          />
        )}

        {/* Amount */}
        {invoice.price && (
          <InvoiceField
            label="Price"
            value={`$${amount}`}
            description="Invoice total amount."
          />
        )}

        {/* Buyer (seller view only) */}
        {displayStatus === "PAID" && isSellerView && invoice.buyer && (
          <InvoiceField
            label="Payer"
            value={renderContractLink(invoice.buyer)}
            description="Buyer who completed the payment."
          />
        )}

        <NotesThread
          orderId={invoice.orderId}
          isExpanded={isExpanded}
          onExpand={ensureExpanded}
          shareLabel={shareLabel}
        />
      </CardHeader>

      {/* Expanded details */}
      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4 text-sm text-gray-800">
          {/* Contract */}
          {invoice.contract && (
            <InvoiceField
              label="Contract"
              value={renderContractLink(invoice.contract)}
              description="Smart contract handling invoice logic."
            />
          )}

          {/* Creator */}
          {invoice.seller && (
            <InvoiceField
              label="Creator"
              value={renderContractLink(invoice.seller)}
              description="Seller who created this invoice."
            />
          )}

          {/* Buyer */}
          {invoice.buyer && (
            <InvoiceField
              label="Buyer"
              value={renderContractLink(invoice.buyer)}
              description="Buyer responsible for payment."
            />
          )}

          {/* Amount Paid */}
          {invoice.amountPaid && (
            <InvoiceField
              label="Amount Paid"
              value={`${amount} ${tokenData?.name}`}
              description="Amount paid into escrow."
            />
          )}

          {/* State History */}
          {invoice.history && invoice.history.length > 0 && (
            <InvoiceField
              label="State History"
              value={
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {invoice.history.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1">
                        {entry.status}
                        <span className="ml-2 text-[10px] text-gray-500">
                          {entry.time ? unixToGMT(entry.time) : ""}
                        </span>
                      </span>
                      {idx < invoice.history!.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </div>
                  ))}
                </div>
              }
              description="Full lifecycle of this invoice."
            />
          )}

          {/* Payment Link + QR */}
          {paymentUrl && displayStatus === "AWAITING PAYMENT" && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="border border-dashed p-2 rounded-xl bg-gray-50">
                <QRCodeSVG value={paymentUrl} size={120} level="H" />
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyLink}>
                Copy Payment Link
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

/* ---------------------------- Utility Components --------------------------- */

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

export const renderTx = (txHash?: string, display?: string) => {
  if (!txHash) return <span className="text-gray-500">—</span>;
  return (
    <a
      href={`https://sepolia.etherscan.io/tx/${txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 underline hover:text-blue-800"
    >
      {display ? display : txHash}
    </a>
  );
};

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
            <button className="cursor-pointer flex items-center focus:outline-none">
              <Info className="w-3.5 h-3.5 text-gray-500 hover:text-gray-700" />
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
