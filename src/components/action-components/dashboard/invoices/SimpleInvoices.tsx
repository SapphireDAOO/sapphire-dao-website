"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Invoice } from "@/model/model";
import { formatAddress, timeLeft, unixToGMT } from "@/utils";
import { toast } from "sonner";
import { useSecureLink } from "@/hooks/useSecureLink";
import { QRCodeSVG } from "qrcode.react";
import SellersAction from "../invoices-components/SellersAction";
import CancelInvoice from "../invoices-components/CancelInvoice";
import { formatEther, parseEther } from "viem";
import { NotesThread } from "./NotesThread";
import {
  renderContractLink,
  renderTx,
  InvoiceField,
} from "./InvoiceCardShared";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const isZeroAddress = (value?: string) => value?.toLowerCase() === ZERO_ADDRESS;

const formatAmountMax4 = (value?: string | null): string => {
  if (!value) return "0";
  const trimmed = value.trim();
  if (!trimmed) return "0";

  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [wholePart = "0", decimalPart = ""] = unsigned.split(".");
  const normalizedWhole = wholePart || "0";
  const groupedWhole = normalizedWhole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const clippedDecimal = decimalPart.slice(0, 4).replace(/0+$/, "");
  const formatted = clippedDecimal
    ? `${groupedWhole}.${clippedDecimal}`
    : groupedWhole;

  return negative ? `-${formatted}` : formatted;
};

export function InvoiceCard({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: Invoice;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isSellerView = invoice.type === "Seller";

  const isBuyerView = invoice.type === "Buyer";

  const shouldTrackCountdown = useMemo(() => {
    if (invoice.status === "ACCEPTED" && invoice.releaseAt) return true;
    if (invoice.status === "PAID" && invoice.paidAt) return true;
    return (
      (invoice.status === "AWAITING PAYMENT" ||
        invoice.status === "CREATED" ||
        invoice.status === "INITIATED") &&
      Boolean(invoice.invalidateAt)
    );
  }, [invoice.status, invoice.releaseAt, invoice.paidAt, invoice.invalidateAt]);

  const tick = useSharedSecondTicker(shouldTrackCountdown);

  const countdown = useMemo(() => {
    void tick;
    if (!shouldTrackCountdown) return undefined;

    if (invoice.status === "ACCEPTED" && invoice.releaseAt) {
      return timeLeft(
        invoice.paidAt ? Number(invoice.paidAt) : null,
        0,
        Number(invoice.releaseAt) * 1000,
      );
    }
    if (invoice.status === "PAID" && invoice.paidAt) {
      return timeLeft(Number(invoice.expiresAt) ?? 0, 0);
    }
    if (
      invoice.status === "AWAITING PAYMENT" ||
      invoice.status === "CREATED" ||
      invoice.status === "INITIATED"
    ) {
      return timeLeft(Number(invoice.invalidateAt) ?? 0, 0);
    }

    return undefined;
  }, [
    tick,
    shouldTrackCountdown,
    invoice.status,
    invoice.paidAt,
    invoice.releaseAt,
    invoice.expiresAt,
    invoice.invalidateAt,
  ]);

  const paymentUrl = useSecureLink(
    isExpanded ? invoice.orderId : undefined,
    "pay",
  );

  const ensureExpanded = useCallback(() => {
    if (!isExpanded) onToggle();
  }, [isExpanded, onToggle]);

  const shareLabel = useMemo(() => {
    if (isSellerView) {
      return invoice.buyer && !isZeroAddress(invoice.buyer)
        ? `Share with payer ${formatAddress(invoice.buyer)}`
        : "Share with payer";
    }
    if (isBuyerView) {
      return invoice.seller
        ? `Share with creator ${formatAddress(invoice.seller)}`
        : "Share with creator";
    }
    return "Share with counterparty";
  }, [invoice.buyer, invoice.seller, isBuyerView, isSellerView]);

  const displayHistory = useMemo(() => {
    if (!invoice.history || invoice.history.length === 0) return [];

    const normalizeStatus = (status?: string) => {
      if (!status) return "";
      if (status === "AWAITING PAYMENT" || status === "INITIATED")
        return "CREATED";
      return status;
    };

    const normalized = invoice.history
      .map((entry) => ({
        ...entry,
        status: normalizeStatus(entry.status),
      }))
      .filter((entry) => entry.status);

    const hasRejected = normalized.some((entry) => entry.status === "REJECTED");
    const filtered =
      isSellerView && hasRejected
        ? normalized.filter((entry) => entry.status !== "REFUNDED")
        : normalized;

    const deduped = filtered.filter((entry, idx) => {
      if (idx === 0) return true;
      return entry.status !== filtered[idx - 1].status;
    });

    return deduped;
  }, [invoice.history, isSellerView]);

  const handleCopyLink = useCallback(() => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Payment link copied!");
  }, [paymentUrl]);

  const isExpired = useMemo(() => {
    if (
      invoice.status === "AWAITING PAYMENT" ||
      invoice.status === "CREATED" ||
      invoice.status === "INITIATED"
    ) {
      return Boolean(
        invoice.invalidateAt &&
        Date.now() > Number(invoice.invalidateAt) * 1000,
      );
    }
    return invoice.status === "EXPIRED";
  }, [invoice.status, invoice.invalidateAt]);

  const displayStatus = isExpired
    ? "EXPIRED"
    : invoice.status === "CREATED"
      ? "AWAITING PAYMENT"
      : invoice.status || "Unknown";
  const isAwaitingPayment =
    !isExpired &&
    (invoice.status === "AWAITING PAYMENT" ||
      invoice.status === "CREATED" ||
      invoice.status === "INITIATED");
  const releasedAmount = useMemo(() => {
    const baseAmount = invoice.amountPaid ?? invoice.price;
    if (!baseAmount) return undefined;

    try {
      const baseWei = parseEther(baseAmount);
      const releasedWei = (baseWei * BigInt(95)) / BigInt(100);
      return formatAmountMax4(formatEther(releasedWei));
    } catch {
      return formatAmountMax4(baseAmount);
    }
  }, [invoice.amountPaid, invoice.price]);

  const statusColors: Record<string, string> = {
    CREATED: "bg-blue-100 text-blue-800",
    "AWAITING PAYMENT": "bg-yellow-100 text-yellow-800",
    PAID: "bg-orange-100 text-orange-800",
    ACCEPTED: "bg-green-100 text-green-800",
    // REJECTED: "bg-red-100 text-red-800",
    CANCELLED: "bg-gray-100 text-gray-800",
    CANCELED: "bg-gray-100 text-gray-800",
    RELEASED: "bg-purple-100 text-purple-800",
    REFUNDED: "bg-indigo-100 text-indigo-800",
    EXPIRED: "bg-red-100 text-red-700",
    "Dispute Resolved": "bg-teal-100 text-teal-800",
    Unknown: "bg-gray-100 text-gray-600",
  };

  const badgeColor = statusColors[displayStatus] ?? "bg-gray-100 text-gray-600";

  // Shared countdown label
  const countdownLabel =
    invoice.status === "PAID"
      ? "Decision window"
      : invoice.status === "ACCEPTED"
        ? "Release in"
        : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">#{invoice.id}</h3>
          <div className="flex items-center gap-2">
            <Badge
              className={`${badgeColor} cursor-default select-none hover:bg-inherit hover:text-inherit`}
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

        {/* Consistent countdown in header */}
        {countdownLabel && (
          <InvoiceField
            label={countdownLabel}
            value={countdown}
            description={
              countdownLabel === "Decision window"
                ? isSellerView
                  ? "You have this time to accept or reject the payment."
                  : "Creator has this time to accept payment or it will be refunded."
                : "Time when payment will be released to the seller"
            }
          />
        )}

        {/* Paid timestamp in header */}
        {invoice.status === "PAID" &&
          invoice.paidAt &&
          invoice.paidAt !== "Not Paid" && (
            <InvoiceField
              label="Paid At"
              value={unixToGMT(invoice.paidAt)}
              description="Timestamp when payment was received in escrow."
            />
          )}

        {/* Amount always shown */}
        {invoice.price && (
          <InvoiceField
            label="Amount"
            value={`${formatAmountMax4(invoice.price)} ETH`}
            description="Total invoice amount (excluding fees)."
          />
        )}

        {invoice.status === "RELEASED" && releasedAmount && (
          <InvoiceField
            label="Amount Released"
            value={
              invoice.releaseHash
                ? renderTx(invoice.releaseHash, `${releasedAmount} ETH`)
                : `${releasedAmount} ETH`
            }
            description="Amount released to the seller."
          />
        )}

        {invoice.status === "AWAITING PAYMENT" && (
          <InvoiceField
            label="Void in"
            value={countdown}
            description="Time left before the invoice is void."
          />
        )}

        {/* Seller view: show payer */}
        {invoice.status === "PAID" &&
          isSellerView &&
          invoice.buyer &&
          !isZeroAddress(invoice.buyer) && (
            <InvoiceField
              label="Payer"
              value={renderContractLink(invoice.buyer)}
              description="The buyer who sent the payment."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
            />
          )}

        {/* Rejected state: show rejection info */}
        {invoice.status === "REFUNDED" && (
          <>
            <InvoiceField
              label="Creator"
              value={renderContractLink(invoice.seller)}
              description="Seller or issuer who created this invoice."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
            />

            {invoice.amountPaid && invoice.amountPaid !== "0" && (
              <InvoiceField
                label="Amount Paid"
                value={
                  invoice.paymentTxHash
                    ? renderTx(
                        invoice.paymentTxHash,
                        `${formatAmountMax4(invoice.amountPaid)} ETH`,
                      )
                    : `${formatAmountMax4(invoice.amountPaid)} ETH`
                }
                description="The amount already paid into escrow by the buyer."
              />
            )}

            {invoice.buyer &&
              !isZeroAddress(invoice.buyer) &&
              !isAwaitingPayment &&
              invoice.status !== "REFUNDED" && (
                <InvoiceField
                  label="Payer"
                  value={renderContractLink(invoice.buyer)}
                  description="The buyer or payer responsible for completing the transaction."
                  link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
                />
              )}

            {invoice.status === "REFUNDED" && (
              <InvoiceField
                label="Amount Refunded"
                value={
                  invoice.refundTxHash && invoice.amountPaid
                    ? renderTx(
                        invoice.refundTxHash,
                        `${formatAmountMax4(invoice.amountPaid)} ETH`,
                      )
                    : undefined
                }
                description="Amount returned to the buyer."
              />
            )}

            {isBuyerView && (
              <p className="text-xs text-red-600 font-medium mt-2">
                Order rejected by{" "}
                <a
                  href={`https://sepolia.basescan.org/address/${invoice.seller}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-red-700 hover:text-red-800"
                >
                  {invoice.seller
                    ? `${invoice.seller.slice(0, 6)}...${invoice.seller.slice(
                        -4,
                      )}`
                    : "Unknown Contract"}
                </a>{" "}
                — refund initiated.
              </p>
            )}
          </>
        )}

        <NotesThread
          orderId={invoice.orderId}
          onExpand={ensureExpanded}
          shareLabel={shareLabel}
          expanded={isExpanded}
        />

        {/* Cancel button in header */}
        {invoice.status === "AWAITING PAYMENT" && (
          <div className="mt-3">
            <CancelInvoice orderId={invoice.orderId} />
          </div>
        )}

        {/* Seller actions in header */}
        {invoice.status === "PAID" && isSellerView && (
          <div className="pt-3 mt-3 border-t border-gray-200 flex justify-end gap-3">
            <SellersAction orderId={invoice.orderId} state text="Accept" />
            <SellersAction
              orderId={invoice.orderId}
              state={false}
              text="Reject"
            />
          </div>
        )}
      </CardHeader>

      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4 text-sm text-gray-800">
          {/* Core Fields */}
          {invoice.contract && (
            <InvoiceField
              label="Contract"
              value={renderContractLink(invoice.contract)}
              description="Smart contract handling invoice creation, escrow, and release."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/technical-docs/core-contracts"
            />
          )}

          {invoice.seller && invoice.status !== "REFUNDED" && (
            <InvoiceField
              label="Creator"
              value={renderContractLink(invoice.seller)}
              description="The seller or issuer who created this invoice."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
            />
          )}

          {invoice.buyer &&
            !isZeroAddress(invoice.buyer) &&
            !isAwaitingPayment &&
            invoice.status !== "REFUNDED" && (
              <InvoiceField
                label="Payer"
                value={renderContractLink(invoice.buyer)}
                description="The buyer or payer responsible for completing the transaction."
                link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
              />
            )}

          {invoice.amountPaid &&
            invoice.amountPaid !== "0" &&
            invoice.status !== "REFUNDED" && (
              <InvoiceField
                label="Amount Paid"
                value={
                  invoice.paymentTxHash
                    ? renderTx(
                        invoice.paymentTxHash,
                        `${formatAmountMax4(invoice.amountPaid)} ETH`,
                      )
                    : `${formatAmountMax4(invoice.amountPaid)} ETH`
                }
                description="Amount deposited into escrow."
              />
            )}

          {/* State History */}
          {displayHistory.length > 0 && (
            <InvoiceField
              label="State History"
              value={
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {displayHistory.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      <span className="bg-gray-100 border border-gray-300 rounded-full px-3 py-1">
                        {entry.status}
                        <span className="ml-2 text-[10px] text-gray-500">
                          {entry.time ? unixToGMT(entry.time) : ""}
                        </span>
                      </span>
                      {idx < displayHistory.length - 1 && (
                        <span className="text-gray-400">→</span>
                      )}
                    </div>
                  ))}
                </div>
              }
              description="All state transitions this invoice has gone through with their timestamps."
            />
          )}

          {/* Payment Link & QR */}
          {paymentUrl && invoice.status === "AWAITING PAYMENT" && (
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

// renderContractLink, renderTx, InvoiceField live in InvoiceCardShared.tsx
export {
  renderContractLink,
  renderTx,
  InvoiceField,
} from "./InvoiceCardShared";
