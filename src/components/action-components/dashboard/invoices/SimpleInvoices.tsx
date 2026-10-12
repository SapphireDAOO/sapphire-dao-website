"use client";

import { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Invoice } from "@/model/model";
import { formatAddress, unixToGMT } from "@/utils";
import { toast } from "sonner";
import { usePayLink } from "@/hooks/usePayLink";
import { QRCodeSVG } from "qrcode.react";
import SellersAction from "../invoices-components/SellersAction";
import CancelInvoice from "../invoices-components/CancelInvoice";
import { formatEther, parseEther } from "viem";
import { NotesThread } from "./NotesThread";
import {
  renderContractLink,
  renderTx,
  InvoiceField,
  Countdown,
} from "./InvoiceCardShared";
import { useHasPassed } from "@/hooks/useHasPassed";

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

function InvoiceCardImpl({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: Invoice;
  isExpanded: boolean;
  onToggle: (invoiceId: bigint) => void;
}) {
  const isSellerView = invoice.type === "Seller";

  const isBuyerView = invoice.type === "Buyer";

  const isAwaitingStatus =
    invoice.status === "AWAITING PAYMENT" ||
    invoice.status === "CREATED" ||
    invoice.status === "INITIATED";

  const countdown = useMemo(() => {
    if (invoice.status === "ACCEPTED" && invoice.releaseAt) {
      return (
        <Countdown
          startAt={invoice.paidAt ? Number(invoice.paidAt) : null}
          endAtMs={Number(invoice.releaseAt) * 1000}
        />
      );
    }
    if (invoice.status === "PAID" && invoice.paidAt) {
      return <Countdown startAt={Number(invoice.sellerActionDeadline)} />;
    }
    if (isAwaitingStatus && invoice.expiresAt) {
      return <Countdown startAt={Number(invoice.expiresAt)} />;
    }
    return undefined;
  }, [
    isAwaitingStatus,
    invoice.status,
    invoice.paidAt,
    invoice.releaseAt,
    invoice.sellerActionDeadline,
    invoice.expiresAt,
  ]);

  const paymentUrl = usePayLink(
    isExpanded ? invoice.invoiceId : undefined,
    "pay",
  );

  const toggle = useCallback(
    () => onToggle(invoice.invoiceId),
    [onToggle, invoice.invoiceId],
  );

  const ensureExpanded = useCallback(() => {
    if (!isExpanded) toggle();
  }, [isExpanded, toggle]);

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

  const hasExpiryPassed = useHasPassed(
    invoice.expiresAt ? Number(invoice.expiresAt) * 1000 : undefined,
  );
  const isExpired = isAwaitingStatus
    ? hasExpiryPassed
    : invoice.status === "EXPIRED";

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
    CANCELED: "bg-gray-100 text-gray-800",
    RELEASED: "bg-purple-100 text-purple-800",
    REFUNDED: "bg-indigo-100 text-indigo-800",
    EXPIRED: "bg-red-100 text-red-700",
    "Dispute Resolved": "bg-teal-100 text-teal-800",
    Unknown: "bg-gray-100 text-gray-600",
  };

  const badgeColor = statusColors[displayStatus] ?? "bg-gray-100 text-gray-600";

  const countdownLabel =
    invoice.status === "PAID"
      ? "Decision window"
      : invoice.status === "ACCEPTED"
        ? "Release in"
        : null;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="cursor-pointer select-none" onClick={toggle}>
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

        {invoice.status === "PAID" &&
          invoice.paidAt &&
          invoice.paidAt !== "Not Paid" && (
            <InvoiceField
              label="Paid At"
              value={unixToGMT(invoice.paidAt)}
              description="Timestamp when payment was received in escrow."
            />
          )}

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
          invoiceId={invoice.invoiceId}
          invoice={invoice}
          onExpand={ensureExpanded}
          shareLabel={shareLabel}
          expanded={isExpanded}
        />

        {invoice.status === "AWAITING PAYMENT" && (
          <div className="mt-3">
            <CancelInvoice invoiceId={invoice.invoiceId} invoice={invoice} />
          </div>
        )}

        {invoice.status === "PAID" && isSellerView && (
          <div className="pt-3 mt-3 border-t border-gray-200 flex justify-end gap-3">
            <SellersAction invoiceId={invoice.invoiceId} state text="Accept" />
            <SellersAction
              invoiceId={invoice.invoiceId}
              state={false}
              text="Reject"
            />
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4 text-sm text-gray-800">
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

export const InvoiceCard = memo(InvoiceCardImpl);

export {
  renderContractLink,
  renderTx,
  InvoiceField,
} from "./InvoiceCardShared";
