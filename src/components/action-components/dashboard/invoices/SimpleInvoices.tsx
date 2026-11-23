"use client";

import { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Invoice } from "@/model/model";
import { formatAddress, unixToGMT } from "@/utils";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { usePayLink } from "@/hooks/usePayLink";
import { useUsdPrice } from "@/hooks/useUsdPrice";
import { QRCodeSVG } from "qrcode.react";
import SellersAction from "../invoices-components/SellersAction";
import CancelInvoice from "../invoices-components/CancelInvoice";
import { formatEther, parseEther } from "viem";
import { NotesThread } from "./NotesThread";
import {
  AddressLink,
  CopyValue,
  Countdown,
  CountdownStrip,
  DetailRow,
  DetailRows,
  HistoryList,
  InvoiceCardFrame,
  SectionLabel,
  TxLink,
} from "./InvoiceCardFrame";
import { statusLook } from "../statusGroups";
import { formatUsd } from "../amounts";
import { useHasPassed } from "@/hooks/useHasPassed";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
// Paying creates the invoice's escrow, so it exists from PAID on.
const ESCROW_STATUSES = new Set(["PAID", "ACCEPTED", "RELEASED", "REFUNDED"]);
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
  const { data: ethUsd } = useUsdPrice("ETH");

  const isAwaitingStatus =
    invoice.status === "AWAITING PAYMENT" ||
    invoice.status === "CREATED" ||
    invoice.status === "INITIATED";

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

    return filtered.filter((entry, idx) => {
      if (idx === 0) return true;
      return entry.status !== filtered[idx - 1].status;
    });
  }, [invoice.history, isSellerView]);

  const handleCopyLink = useCallback(async () => {
    if (!paymentUrl) return;
    if (await copyText(paymentUrl)) toast.success("Payment link copied!");
    else toast.error("Couldn't copy the payment link.");
  }, [paymentUrl]);

  const hasExpiryPassed = useHasPassed(
    invoice.expiresAt ? Number(invoice.expiresAt) * 1000 : undefined,
  );
  const isExpired = isAwaitingStatus
    ? hasExpiryPassed
    : invoice.status === "EXPIRED";

  const displayStatus = isExpired
    ? "EXPIRED"
    : invoice.status === "CREATED" || invoice.status === "INITIATED"
      ? "AWAITING PAYMENT"
      : invoice.status || "Unknown";
  const isAwaitingPayment = !isExpired && isAwaitingStatus;
  const hasPayer = Boolean(invoice.buyer) && !isZeroAddress(invoice.buyer);
  const isPaid = Boolean(invoice.paidAt) && invoice.paidAt !== "Not Paid";

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

  const usdValue = useMemo(() => {
    if (!ethUsd || !invoice.price) return undefined;
    const value = Number(invoice.price) * ethUsd;
    return Number.isFinite(value) ? `≈ ${formatUsd(value)}` : undefined;
  }, [ethUsd, invoice.price]);

  const strip = (() => {
    if (displayStatus === "ACCEPTED" && invoice.releaseAt) {
      return (
        <CountdownStrip
          label="Funds release in"
          hint="When the payment is released from escrow to the seller."
        >
          <Countdown
            startAt={isPaid ? Number(invoice.paidAt) : null}
            endAtMs={Number(invoice.releaseAt) * 1000}
          />
        </CountdownStrip>
      );
    }
    if (displayStatus === "PAID" && invoice.sellerActionDeadline) {
      return (
        <CountdownStrip
          label="Decision window"
          hint={
            isSellerView
              ? "You have this time to accept or reject the payment."
              : "The creator has this time to accept the payment, or you're refunded."
          }
        >
          <Countdown startAt={Number(invoice.sellerActionDeadline)} />
        </CountdownStrip>
      );
    }
    if (isAwaitingPayment && invoice.expiresAt) {
      return (
        <CountdownStrip
          label="Void in"
          tone="muted"
          hint="Time left for the buyer to pay before the invoice is void."
        >
          <Countdown startAt={Number(invoice.expiresAt)} />
        </CountdownStrip>
      );
    }
    return undefined;
  })();

  const actions =
    displayStatus === "PAID" && isSellerView ? (
      <>
        <SellersAction invoiceId={invoice.invoiceId} state={false} text="Reject" />
        <SellersAction invoiceId={invoice.invoiceId} state text="Accept" />
      </>
    ) : invoice.status === "AWAITING PAYMENT" ? (
      <CancelInvoice invoiceId={invoice.invoiceId} invoice={invoice} />
    ) : undefined;

  return (
    <InvoiceCardFrame
      displayId={invoice.id}
      idTitle={invoice.invoiceId.toString()}
      status={statusLook(displayStatus, false)}
      date={invoice.createdAt ? `${invoice.createdAt} UTC` : undefined}
      amount={formatAmountMax4(invoice.price)}
      unit="ETH"
      secondary={usdValue}
      expanded={isExpanded}
      onToggle={toggle}
      strip={strip}
      actions={actions}
    >
      <DetailRows>
        <DetailRow label="Creator">
          <AddressLink address={invoice.seller} />
        </DetailRow>
        {hasPayer && (
          <DetailRow label="Payer">
            <AddressLink address={invoice.buyer} />
          </DetailRow>
        )}
        {invoice.amountPaid && invoice.amountPaid !== "0" && (
          <DetailRow label="Amount paid">
            {formatAmountMax4(invoice.amountPaid)} ETH
          </DetailRow>
        )}
        {isPaid && (
          <DetailRow label="Paid at">{unixToGMT(invoice.paidAt)} UTC</DetailRow>
        )}
        {invoice.paymentTxHash && (
          <DetailRow label="Payment">
            <TxLink hash={invoice.paymentTxHash} />
          </DetailRow>
        )}
        {displayStatus === "RELEASED" && releasedAmount && (
          <DetailRow label="Amount released">{releasedAmount} ETH</DetailRow>
        )}
        {displayStatus === "REFUNDED" && invoice.amountPaid && (
          <DetailRow label="Amount refunded">
            {formatAmountMax4(invoice.amountPaid)} ETH
          </DetailRow>
        )}
        {isPaid && (
          <DetailRow label="Settlement">
            {invoice.releaseHash ? (
              <TxLink hash={invoice.releaseHash} />
            ) : invoice.refundTxHash ? (
              <TxLink hash={invoice.refundTxHash} />
            ) : (
              <span className="font-sans text-muted-foreground">
                Not settled
              </span>
            )}
          </DetailRow>
        )}
        {ESCROW_STATUSES.has(displayStatus) && (
          // Empty until the subgraph indexes simple invoices' escrow.
          <DetailRow label="Escrow">{""}</DetailRow>
        )}
        {invoice.contract && (
          <DetailRow label="Contract">
            <CopyValue value={invoice.contract} label="Contract address">
              <AddressLink address={invoice.contract} />
            </CopyValue>
          </DetailRow>
        )}
      </DetailRows>

      {displayStatus === "REFUNDED" && isBuyerView && (
        <p className="text-xs text-destructive">
          Rejected by the creator. Your payment was refunded.
        </p>
      )}

      {paymentUrl && isAwaitingPayment && (
        <div className="flex flex-col items-center gap-3 border border-dashed border-border bg-background p-4">
          <QRCodeSVG value={paymentUrl} size={120} level="H" />
          <Button
            size="sm"
            variant="outline"
            className="rounded-none border-primary text-primary hover:bg-primary/5 hover:text-primary"
            onClick={handleCopyLink}
          >
            Copy payment link
          </Button>
        </div>
      )}

      {displayHistory.length > 0 && (
        <div className="space-y-2">
          <SectionLabel>History</SectionLabel>
          <HistoryList
            entries={displayHistory}
            format={(time) => `${unixToGMT(time)} UTC`}
          />
        </div>
      )}

      <NotesThread
        invoiceId={invoice.invoiceId}
        invoice={invoice}
        onExpand={ensureExpanded}
        shareLabel={shareLabel}
        expanded={isExpanded}
      />
    </InvoiceCardFrame>
  );
}

export const InvoiceCard = memo(InvoiceCardImpl);
