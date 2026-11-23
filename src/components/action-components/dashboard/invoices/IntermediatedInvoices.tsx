"use client";

import { memo, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Invoice } from "@/model/model";
import { unixToGMT } from "@/utils";
import { toast } from "sonner";
import { copyText } from "@/lib/clipboard";
import { usePayLink } from "@/hooks/usePayLink";
import { QRCodeSVG } from "qrcode.react";
import { formatUnits } from "viem";
import { useGetPaymentTokenData } from "@/hooks/useGetPaymentTokenData";
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
import { normalizeStatus, statusLook } from "../statusGroups";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const isZeroAddress = (value?: string) => value?.toLowerCase() === ZERO_ADDRESS;

const TOKEN_DISPLAY_MIN = 0.0001;

const fmtAmount = (value: number): string => {
  if (!Number.isFinite(value) || value === 0) return "0";
  if (value > 0 && value < TOKEN_DISPLAY_MIN) return `<${TOKEN_DISPLAY_MIN}`;
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

const CLOSED_DISPUTES = new Set([
  "DISPUTE RESOLVED",
  "DISPUTE DISMISSED",
  "DISPUTE SETTLED",
  "DISPUTE EXPIRED",
]);

function IntermediatedCardImpl({
  invoice,
  isExpanded,
  onToggle,
}: {
  invoice: Invoice;
  isExpanded: boolean;
  onToggle: (invoiceId: bigint) => void;
}) {
  const isSellerView = invoice.type === "IssuedInvoice";
  const isBuyerView = invoice.type === "ReceivedInvoice";

  const tokenData = useGetPaymentTokenData(invoice.paymentToken ?? "");
  const { tokenDecimals, paymentCurrency } = useMemo(() => {
    // The subgraph stores ETH payments with no
    // PaymentToken, so "" or the zero address means ETH.
    if (!invoice.paymentToken || isZeroAddress(invoice.paymentToken)) {
      return { tokenDecimals: 18, paymentCurrency: "ETH" };
    }
    if (tokenData?.id) {
      return {
        tokenDecimals: tokenData.decimals,
        paymentCurrency: tokenData.name?.trim() || "tokens",
      };
    }
    return { tokenDecimals: 8, paymentCurrency: "tokens" };
  }, [
    invoice.paymentToken,
    tokenData?.id,
    tokenData?.decimals,
    tokenData?.name,
  ]);

  const formatToken = useCallback(
    (raw: string | null | undefined): string => {
      let value = 0;
      if (raw) {
        try {
          value = Number(formatUnits(BigInt(raw), tokenDecimals));
        } catch {
          const n = parseFloat(raw);
          value = Number.isFinite(n) ? n : 0;
        }
      }
      return `${fmtAmount(value)} ${paymentCurrency}`;
    },
    [tokenDecimals, paymentCurrency],
  );

  // Invoice price is stored with 8 decimal places.
  const amount = useMemo(() => {
    const raw = invoice.price;
    if (!raw) return 0;
    try {
      return Number(formatUnits(BigInt(String(raw)), 8));
    } catch {
      const n = parseFloat(String(raw));
      return Number.isFinite(n) ? n : 0;
    }
  }, [invoice.price]);

  const displayStatus = normalizeStatus(invoice.status) || "UNKNOWN";
  const isAwaitingPayment =
    displayStatus === "AWAITING PAYMENT" ||
    displayStatus === "CREATED" ||
    displayStatus === "INITIATED";
  const hasBuyer = Boolean(invoice.buyer) && !isZeroAddress(invoice.buyer);
  const isPaid = Boolean(invoice.paidAt) && invoice.paidAt !== "Not Paid";
  const shouldTrackReleaseCountdown =
    isPaid &&
    displayStatus !== "REFUNDED" &&
    displayStatus !== "RELEASED" &&
    Boolean(invoice.releaseAt);

  const releasedAmount = invoice.amountReleased
    ? formatToken(invoice.amountReleased)
    : invoice.amountPaid
      ? formatToken(invoice.amountPaid)
      : `${fmtAmount(amount * 0.95)} ${paymentCurrency}`;
  const hasRefund =
    Boolean(invoice.amountRefunded) && Number(invoice.amountRefunded) > 0;

  const displayHistory = useMemo(() => {
    if (!invoice.history || invoice.history.length === 0) return [];

    const normalized = invoice.history
      .map((entry) => {
        const spaced = normalizeStatus(entry.status);
        return {
          ...entry,
          status:
            spaced === "AWAITING PAYMENT" || spaced === "INITIATED"
              ? "CREATED"
              : spaced,
        };
      })
      .filter((entry) => entry.status);

    return normalized.filter((entry, idx) => {
      if (idx === 0) return true;
      return entry.status !== normalized[idx - 1].status;
    });
  }, [invoice.history]);

  const toggle = useCallback(
    () => onToggle(invoice.invoiceId),
    [onToggle, invoice.invoiceId],
  );

  const paymentUrl = usePayLink(
    isExpanded ? invoice.invoiceId : undefined,
    "checkout",
  );

  const handleCopyLink = useCallback(async () => {
    if (!paymentUrl) return;
    if (await copyText(paymentUrl)) toast.success("Payment link copied!");
    else toast.error("Couldn't copy the payment link.");
  }, [paymentUrl]);

  const settledShare = isSellerView
    ? invoice.sellerAmountReceivedAfterDispute
    : isBuyerView
      ? invoice.buyerAmountReceivedAfterDispute
      : null;
  const settlementTx =
    invoice.releaseHash ?? invoice.refundTxHash ?? invoice.disputeSettledTxHash;

  const strip = shouldTrackReleaseCountdown ? (
    <CountdownStrip
      label="Release in"
      hint="Time left before the payment is released to the seller."
    >
      <Countdown
        startAt={Number(invoice.paidAt)}
        endAtMs={Number(invoice.releaseAt) * 1000}
      />
    </CountdownStrip>
  ) : isAwaitingPayment && invoice.expiresAt ? (
    <CountdownStrip
      label="Void in"
      tone="muted"
      hint="Time left for the buyer to pay before the invoice is void."
    >
      <Countdown startAt={Number(invoice.expiresAt)} />
    </CountdownStrip>
  ) : undefined;

  return (
    <InvoiceCardFrame
      displayId={formatShortId(invoice.id)}
      idTitle={invoice.id}
      status={statusLook(displayStatus, true)}
      date={invoice.createdAt ? `${invoice.createdAt} UTC` : undefined}
      amount={fmtAmount(amount)}
      unit="USD"
      secondary={
        isPaid && invoice.amountPaid
          ? `paid ${formatToken(invoice.amountPaid)}`
          : undefined
      }
      expanded={isExpanded}
      onToggle={toggle}
      strip={strip}
    >
      <DetailRows>
        <DetailRow label="Invoice ID">
          <CopyValue value={invoice.id} label="Invoice ID">
            {formatShortId(invoice.id)}
          </CopyValue>
        </DetailRow>
        <DetailRow label="Order ID">
          <CopyValue value={invoice.invoiceId.toString()} label="Order ID">
            {formatShortId(invoice.invoiceId.toString())}
          </CopyValue>
        </DetailRow>
        <DetailRow label="Seller">
          <AddressLink address={invoice.seller} />
        </DetailRow>
        {hasBuyer && !isAwaitingPayment && (
          <DetailRow label="Buyer">
            <AddressLink address={invoice.buyer} />
          </DetailRow>
        )}
        {isPaid && invoice.amountPaid && (
          <DetailRow label="Amount paid">
            {formatToken(invoice.amountPaid)}
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
        {displayStatus === "RELEASED" && (
          <DetailRow label="Amount released">{releasedAmount}</DetailRow>
        )}
        {(displayStatus === "REFUNDED" ||
          (displayStatus === "RELEASED" && hasRefund)) && (
          <DetailRow label="Amount refunded">
            {formatToken(invoice.amountRefunded)}
          </DetailRow>
        )}
        {displayStatus === "DISPUTE SETTLED" && settledShare && (
          <DetailRow label="You received">{formatToken(settledShare)}</DetailRow>
        )}
        {displayStatus === "PAID" && (
          <DetailRow label="Dispute">
            <span className="font-sans">No dispute raised</span>
          </DetailRow>
        )}
        {CLOSED_DISPUTES.has(displayStatus) && (
          <DetailRow label="Dispute outcome">
            <span className="font-sans">
              {statusLook(displayStatus, true).label}
            </span>
          </DetailRow>
        )}
        {isPaid && (
          <DetailRow label="Settlement">
            {settlementTx ? (
              <TxLink hash={settlementTx} />
            ) : (
              <span className="font-sans text-muted-foreground">
                Not settled
              </span>
            )}
          </DetailRow>
        )}
        {invoice.escrow && !isZeroAddress(invoice.escrow) && (
          <DetailRow label="Escrow">
            <CopyValue value={invoice.escrow} label="Escrow address">
              <AddressLink address={invoice.escrow} />
            </CopyValue>
          </DetailRow>
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
          Refunded by the seller. The funds were returned to you.
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
    </InvoiceCardFrame>
  );
}

export const IntermediatedCard = memo(IntermediatedCardImpl);
