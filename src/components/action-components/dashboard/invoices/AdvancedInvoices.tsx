"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Invoice } from "@/model/model";
import { formatAddress, timeLeft, unixToGMT } from "@/utils";
import { toast } from "sonner";
import { useSecureLink } from "@/hooks/useSecureLink";
import { QRCodeSVG } from "qrcode.react";
import { formatUnits } from "viem";
import { useGetPaymentTokenData } from "@/hooks/useGetPaymentTokenData";
import { NotesThread } from "./NotesThread";
import {
  renderContractLink,
  renderTx,
  InvoiceField,
} from "./InvoiceCardShared";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const isZeroAddress = (value?: string) => value?.toLowerCase() === ZERO_ADDRESS;

/** Format a numeric amount without scientific notation */
const fmtAmount = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) return "0";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
};

const formatShortId = (value?: string) => {
  if (!value) return "—";
  const trimmed = value.trim();
  if (trimmed.length <= 8) return trimmed;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
};

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

/* ------------------------------ STATUS COLORS ----------------------------- */

const statusColors: Record<string, string> = {
  "AWAITING PAYMENT": "bg-blue-100 text-blue-800",
  PAID: "bg-orange-100 text-orange-800",
  REFUNDED: "bg-indigo-100 text-indigo-800",
  CANCELED: "bg-gray-100 text-gray-800",
  DISPUTED: "bg-red-100 text-red-800 ring-1 ring-inset ring-red-300",
  "DISPUTE RESOLVED":
    "bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-300",
  "DISPUTE DISMISSED":
    "bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-300",
  "DISPUTE SETTLED":
    "bg-purple-100 text-purple-800 ring-1 ring-inset ring-purple-300",
  RELEASED: "bg-green-100 text-green-800",
  "PARTIAL REFUND": "bg-gray-100 text-gray-600",
};

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
  const isSellerView = invoice.type === "IssuedInvoice";
  const isBuyerView = invoice.type === "ReceivedInvoice";

  const tokenData = useGetPaymentTokenData(invoice.paymentToken ?? "");
  // Token decimals for actual token amounts (amountPaid, amountReleased, etc.)
  const tokenDecimals = tokenData?.decimals ?? 8;
  const paymentCurrency = useMemo(() => {
    const namedCurrency = tokenData?.name?.trim();
    if (namedCurrency) return namedCurrency;
    return isZeroAddress(invoice.paymentToken) ? "ETH" : "";
  }, [tokenData?.name, invoice.paymentToken]);

  /** Format a raw bigint string (token units) to a human-readable string */
  const formatTokenAmount = useCallback(
    (raw: string | null | undefined): string => {
      if (!raw) return "0";
      try {
        const n = Number(formatUnits(BigInt(raw), tokenDecimals));
        return fmtAmount(n);
      } catch {
        // If BigInt parse fails, try as plain decimal
        const n = parseFloat(raw);
        return fmtAmount(Number.isFinite(n) ? n : 0);
      }
    },
    [tokenDecimals],
  );

  // Invoice price is stored with 8 decimal places.
  const amount = useMemo(() => {
    const raw = invoice.price;
    if (!raw) return 0;
    try {
      if (typeof raw === "bigint") return Number(formatUnits(raw, 8));
      if (typeof raw === "number") return raw / 1e8;
      return Number(formatUnits(BigInt(String(raw)), 8));
    } catch {
      // Fallback: price may already be a plain decimal string
      const n = parseFloat(String(raw));
      return Number.isFinite(n) ? n : 0;
    }
  }, [invoice.price]);

  // Actual paid amount from the schema (raw bigint string → formatted)
  const paidAmountFormatted = useMemo(
    () => formatTokenAmount(invoice.amountPaid),
    [invoice.amountPaid, formatTokenAmount],
  );

  // Released amount: use amountReleased from schema (after fees), fall back to estimate
  const releasedAmount = useMemo(() => {
    if (invoice.amountReleased)
      return formatTokenAmount(invoice.amountReleased);
    if (invoice.amountPaid) return paidAmountFormatted;
    return fmtAmount(amount * 0.95);
  }, [
    invoice.amountReleased,
    invoice.amountPaid,
    paidAmountFormatted,
    amount,
    formatTokenAmount,
  ]);

  const refundedAmount = useMemo(
    () => formatTokenAmount(invoice.amountRefunded),
    [invoice.amountRefunded, formatTokenAmount],
  );

  const displayStatus = normalizeStatus(invoice.status || "");
  const badgeColor = statusColors[displayStatus] ?? statusColors["Unknown"];

  const isAwaitingPayment =
    displayStatus === "AWAITING PAYMENT" || displayStatus === "CANCELED";

  const isDisputed =
    displayStatus === "DISPUTED" ||
    displayStatus === "DISPUTE RESOLVED" ||
    displayStatus === "DISPUTE DISMISSED" ||
    displayStatus === "DISPUTE SETTLED";

  /* ── Countdown timers ─────────────────────────────────────────────────── */

  // Show release countdown for PAID and DISPUTE DISMISSED (funds still in escrow)
  const shouldTrackReleaseCountdown =
    (displayStatus === "PAID" || displayStatus === "DISPUTE DISMISSED") &&
    Boolean(invoice.releaseAt);
  const shouldTrackVoidCountdown =
    isAwaitingPayment && Boolean(invoice.invalidateAt);
  const shouldTrackCountdown =
    shouldTrackReleaseCountdown || shouldTrackVoidCountdown;

  const tick = useSharedSecondTicker(shouldTrackCountdown);

  const releaseCountdown = useMemo(() => {
    void tick;
    if (!shouldTrackReleaseCountdown || !invoice.releaseAt) return "—";
    return timeLeft(
      invoice.paidAt ? Number(invoice.paidAt) : null,
      0,
      Number(invoice.releaseAt) * 1000,
    );
  }, [tick, shouldTrackReleaseCountdown, invoice.releaseAt, invoice.paidAt]);

  const voidCountdown = useMemo(() => {
    void tick;
    if (!shouldTrackVoidCountdown || !invoice.invalidateAt) return "—";
    return timeLeft(Number(invoice.invalidateAt), 0);
  }, [tick, shouldTrackVoidCountdown, invoice.invalidateAt]);

  /* ── History normalization (mirrors SimpleInvoices displayHistory) ─────── */

  const displayHistory = useMemo(() => {
    if (!invoice.history || invoice.history.length === 0) return [];

    const normalizeHistoryStatus = (status?: string) => {
      if (!status) return "";
      const spaced = status.replace(/_/g, " ").toUpperCase().trim();
      if (spaced === "AWAITING PAYMENT" || spaced === "INITIATED")
        return "CREATED";
      return spaced;
    };

    const normalized = invoice.history
      .map((entry) => ({
        ...entry,
        status: normalizeHistoryStatus(entry.status),
      }))
      .filter((entry) => entry.status)
      .filter((entry) => !(isBuyerView && entry.status === "CREATED"));

    const deduped = normalized.filter((entry, idx) => {
      if (idx === 0) return true;
      return entry.status !== normalized[idx - 1].status;
    });

    return deduped;
  }, [invoice.history, isBuyerView]);

  /* ── Share helpers ─────────────────────────────────────────────────────── */

  const ensureExpanded = useCallback(() => {
    if (!isExpanded) onToggle();
  }, [isExpanded, onToggle]);

  const shareLabel = useMemo(() => {
    if (isSellerView) {
      return invoice.buyer
        ? `Share with buyer ${formatAddress(invoice.buyer)}`
        : "Share with buyer";
    }
    return invoice.seller
      ? `Share with seller ${formatAddress(invoice.seller)}`
      : "Share with seller";
  }, [invoice.buyer, invoice.seller, isSellerView]);

  /* ── Payment link ──────────────────────────────────────────────────────── */

  const paymentUrl = useSecureLink(
    isExpanded ? invoice.invoiceId : undefined,
    "checkout",
  );

  const handleCopyLink = useCallback(() => {
    if (!paymentUrl) return;
    navigator.clipboard.writeText(paymentUrl);
    toast.success("Payment link copied!");
  }, [paymentUrl]);

  /* ── Copy handlers ─────────────────────────────────────────────────────── */

  const formattedInvoiceId = useMemo(
    () => formatShortId(invoice.id),
    [invoice.id],
  );
  const formattedinvoiceId = useMemo(
    () => formatShortId(invoice.invoiceId?.toString()),
    [invoice.invoiceId],
  );

  const handleCopyInvoiceId = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!invoice.id) return;
      navigator.clipboard.writeText(invoice.id);
      toast.success("Invoice ID copied!");
    },
    [invoice.id],
  );

  const handleCopyinvoiceId = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!invoice.invoiceId) return;
      navigator.clipboard.writeText(invoice.invoiceId.toString());
      toast.success("Order ID copied!");
    },
    [invoice.invoiceId],
  );

  /* ── Amount display helpers ─────────────────────────────────────────────── */

  const withCurrencySuffix = useCallback(
    (value: string) =>
      paymentCurrency ? `${value} ${paymentCurrency}` : value,
    [paymentCurrency],
  );

  // Amount stays plain; other monetary fields carry payment-currency suffix.
  const amountDisplay = fmtAmount(amount);
  const paidAmountDisplay = withCurrencySuffix(paidAmountFormatted);
  const releasedAmountDisplay = withCurrencySuffix(releasedAmount);
  const refundedAmountDisplay = withCurrencySuffix(refundedAmount);

  /* ── UI Render ─────────────────────────────────────────────────────────── */

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="cursor-pointer select-none" onClick={onToggle}>
        {/* ID row */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold" title={invoice.id}>
                #{formattedInvoiceId}
              </h3>
              <button
                type="button"
                aria-label="Copy invoice ID"
                className="text-gray-400 hover:text-gray-600"
                onClick={handleCopyInvoiceId}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">Order</span>
              <span>:</span>
              <span
                className="text-gray-800"
                title={invoice.invoiceId?.toString()}
              >
                {formattedinvoiceId}
              </span>
              <button
                type="button"
                aria-label="Copy order ID"
                className="text-gray-400 hover:text-gray-600"
                onClick={handleCopyinvoiceId}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              className={`${badgeColor} cursor-default select-none text-xs py-0.5 px-2 h-auto font-medium leading-tight hover:bg-inherit hover:text-inherit`}
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

        {/* Release countdown (PAID or DISPUTE DISMISSED) */}
        {shouldTrackReleaseCountdown && (
          <InvoiceField
            label="Release in"
            value={releaseCountdown}
            description="Time remaining before payment is released to the seller."
          />
        )}

        {/* Paid At (PAID and dispute states — payment happened) */}
        {(displayStatus === "PAID" || isDisputed) &&
          invoice.paidAt &&
          invoice.paidAt !== "Not Paid" && (
            <InvoiceField
              label="Paid At"
              value={unixToGMT(invoice.paidAt)}
              description="Timestamp when payment entered escrow."
            />
          )}

        {/* Amount (always USD) */}
        {invoice.price && (
          <InvoiceField
            label="Amount"
            value={`$${amountDisplay}`}
            description="Invoice total amount."
          />
        )}

        {displayStatus === "PAID" && (
          <InvoiceField
            label="Amount Paid"
            value={
              invoice.paymentTxHash
                ? renderTx(invoice.paymentTxHash, paidAmountDisplay)
                : paidAmountDisplay
            }
            description="Amount deposited into escrow."
          />
        )}

        {/* Amount Released in header (RELEASED) */}
        {displayStatus === "RELEASED" &&
          (invoice.amountPaid || invoice.price) && (
            <InvoiceField
              label="Amount Released"
              value={
                invoice.releaseHash
                  ? renderTx(invoice.releaseHash, releasedAmountDisplay)
                  : releasedAmountDisplay
              }
              description="Amount released to the seller."
            />
          )}

        {/* Dispute settled: each party only sees their own received amount */}
        {displayStatus === "DISPUTE SETTLED" &&
          isSellerView &&
          invoice.sellerAmountReceivedAfterDispute && (
            <InvoiceField
              label="You Received"
              value={(() => {
                const raw = invoice.sellerAmountReceivedAfterDispute!;
                const display = withCurrencySuffix(formatTokenAmount(raw));
                const txHash =
                  invoice.disputeSettledTxHash ?? invoice.releaseHash;
                return txHash ? renderTx(txHash, display) : display;
              })()}
              description="Amount released to you after dispute settlement."
            />
          )}
        {displayStatus === "DISPUTE SETTLED" &&
          isBuyerView &&
          invoice.buyerAmountReceivedAfterDispute && (
            <InvoiceField
              label="You Received"
              value={(() => {
                const raw = invoice.buyerAmountReceivedAfterDispute!;
                const display = withCurrencySuffix(formatTokenAmount(raw));
                const txHash = invoice.disputeSettledTxHash;
                return txHash ? renderTx(txHash, display) : display;
              })()}
              description="Amount returned to you after dispute settlement."
            />
          )}

        {/* Void in countdown (AWAITING PAYMENT / CANCELED) */}
        {isAwaitingPayment && invoice.invalidateAt && (
          <InvoiceField
            label="Void in"
            value={voidCountdown}
            description="Time left before the invoice is void."
          />
        )}

        {(displayStatus === "PAID" || isDisputed) &&
          isSellerView &&
          invoice.buyer &&
          !isZeroAddress(invoice.buyer) && (
            <InvoiceField
              label="Buyer"
              value={renderContractLink(invoice.buyer)}
              description={
                isDisputed
                  ? "Buyer who raised the dispute."
                  : "Buyer who completed the payment."
              }
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
            />
          )}

        {/* REFUNDED state: key fields in header */}
        {displayStatus === "REFUNDED" && (
          <>
            <InvoiceField
              label="Seller"
              value={renderContractLink(invoice.seller)}
              description="Seller who created this invoice."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
            />

            <InvoiceField
              label="Amount Paid"
              value={
                invoice.paymentTxHash
                  ? renderTx(invoice.paymentTxHash, paidAmountDisplay)
                  : paidAmountDisplay
              }
              description="Amount deposited into escrow before refund."
            />

            <InvoiceField
              label="Amount Refunded"
              value={
                invoice.refundTxHash
                  ? renderTx(invoice.refundTxHash, refundedAmountDisplay)
                  : refundedAmountDisplay
              }
              description="Amount returned to the buyer."
            />

            {isBuyerView && invoice.seller && (
              <p className="text-xs text-red-600 font-medium mt-2">
                Order refunded by{" "}
                <a
                  href={`https://sepolia.basescan.org/address/${invoice.seller}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-red-700 hover:text-red-800"
                >
                  {`${invoice.seller.slice(0, 6)}...${invoice.seller.slice(-4)}`}
                </a>{" "}
                — funds returned.
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
      </CardHeader>

      {/* Expanded details */}
      {isExpanded && (
        <CardContent className="border-t pt-4 space-y-4 text-sm text-gray-800">
          {invoice.contract && (
            <InvoiceField
              label="Contract"
              value={renderContractLink(invoice.contract)}
              description="Smart contract handling invoice logic."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/technical-docs/core-contracts"
            />
          )}

          {invoice.seller && displayStatus !== "REFUNDED" && (
            <InvoiceField
              label="Seller"
              value={renderContractLink(invoice.seller)}
              description="Seller who created this invoice."
              link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#seller"
            />
          )}

          {invoice.buyer &&
            !isZeroAddress(invoice.buyer) &&
            !isAwaitingPayment &&
            displayStatus !== "REFUNDED" && (
              <InvoiceField
                label="Buyer"
                value={renderContractLink(invoice.buyer)}
                description="Buyer responsible for payment."
                link="https://sapphiredao.gitbook.io/sapphiredao-docs/user-docs/publish-your-docs#buyer"
              />
            )}

          {/* Amount Released — expanded detail for RELEASED */}
          {displayStatus === "RELEASED" &&
            (invoice.amountPaid || invoice.price) && (
              <InvoiceField
                label="Amount Released"
                value={
                  invoice.releaseHash
                    ? renderTx(invoice.releaseHash, releasedAmountDisplay)
                    : releasedAmountDisplay
                }
                description="Amount released to the seller after fees."
              />
            )}

          {/* Dispute Status — PAID only (pre-dispute window) */}
          {displayStatus === "PAID" && (
            <InvoiceField
              label="Dispute Status"
              value="No dispute raised"
              description="Buyer may raise a dispute before payment is automatically released to the seller."
            />
          )}

          {/* Dispute resolution detail */}
          {(displayStatus === "DISPUTE RESOLVED" ||
            displayStatus === "DISPUTE DISMISSED" ||
            displayStatus === "DISPUTE SETTLED") && (
            <InvoiceField
              label="Dispute Outcome"
              value={displayStatus}
              description="The final resolution reached for this dispute."
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

// renderContractLink, renderTx, InvoiceField live in InvoiceCardShared.tsx
export {
  renderContractLink,
  renderTx,
  InvoiceField,
} from "./InvoiceCardShared";
