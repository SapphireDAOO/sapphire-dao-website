"use client";

import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ContractActionsContext } from "@/context/contract-context";
import { InvoiceDetails } from "@/model/model";

import { useCheckoutQuote } from "@/hooks/useCheckoutQuote";
import CheckoutFlow from "./CheckoutFlow";
import { BackLink, CheckoutHeader } from "./CheckoutHeader";
import { PaymentShell, ShellMessage, TextLink } from "./CheckoutLayout";
import { MARKETPLACE_LINKS } from "./checkoutLinks";
import { useGetIntermediatedInvoiceData } from "@/hooks/useGetIntermediatedInvoiceData";
import {
  getContractInvoiceIdBigInt,
  getDisplayInvoiceIdString,
  toInvoiceIdBigInt,
} from "@/lib/invoiceIdentifiers";
import { decodeInvoiceId, PAY_LINK_PARAM } from "@/lib/payLink";

const marketplaceLinks = (
  <>
    <BackLink href={MARKETPLACE_LINKS.home} label="Marketplace" />
    <TextLink href={MARKETPLACE_LINKS.shopping} external={false}>
      Shopping
    </TextLink>
    <TextLink href={MARKETPLACE_LINKS.help}>Help</TextLink>
  </>
);

const InvoiceCheckout = ({
  invoice,
  isMetaInvoice,
}: {
  invoice: InvoiceDetails;
  isMetaInvoice: boolean;
}) => {
  const quote = useCheckoutQuote(invoice, isMetaInvoice);
  return (
    <PaymentShell>
      <CheckoutHeader
        links={marketplaceLinks}
        amountDue={{
          priceUsd: Number(invoice.price) / 1e8,
          billedInUsd: true,
          reference: invoice.id || undefined,
          amount: quote.amount,
          token: quote.token,
          rateUpdatedAt: quote.rateUpdatedAt,
        }}
      />
      <main>
        <CheckoutFlow
          invoice={invoice}
          isMetaInvoice={isMetaInvoice}
          quote={quote}
        />
      </main>
    </PaymentShell>
  );
};

const CheckoutPage = () => {
  const searchParams = useSearchParams();
  const encodedId = searchParams.get(PAY_LINK_PARAM);

  const { getIntermediatedInvoiceData } = useContext(ContractActionsContext);
  const [invoiceId, setinvoiceId] = useState<bigint | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(
    null
  );
  const [error, setError] = useState("");

  const [isMetaInvoice, setIsMetaInvoice] = useState(false);

  useEffect(() => {
    const decoded = decodeInvoiceId(encodedId);
    if (!decoded) {
      setError(encodedId ? "Invalid payment link." : "");
      return;
    }

    const parsed = toInvoiceIdBigInt(decoded.invoiceId);
    if (parsed) {
      setinvoiceId(parsed);
      setIsMetaInvoice(decoded.isMeta);
      setError("");
    } else {
      setError("Invalid invoice ID in payment link.");
    }
  }, [encodedId]);

  const ZERO: bigint = BigInt(0);
  const { data: invoiceInfo } = useGetIntermediatedInvoiceData(invoiceId || ZERO);
  const intermediatedInvoice = invoiceInfo as
    | { invoiceId?: bigint; invoiceNonce?: bigint; price?: bigint; paymentToken?: string }
    | undefined;

  useEffect(() => {
    if (!invoiceId) return;

    const loadInvoice = async () => {
      if (!invoiceId) return;

      const type = isMetaInvoice ? "metaInvoice" : "smartInvoice";

      try {
        const response = await getIntermediatedInvoiceData(invoiceId, type);

        const invoice = response?.[type];

        let structured: InvoiceDetails;
        if (invoice) {
          structured = {
            id: getDisplayInvoiceIdString(invoice),
            invoiceId: getContractInvoiceIdBigInt(invoice),
            price: invoice.price,
            status: invoice.state,
          };
        } else {
          structured = {
            id:
              intermediatedInvoice?.invoiceId?.toString() ??
              intermediatedInvoice?.invoiceNonce?.toString() ??
              "",
            invoiceId: invoiceId,
            price: intermediatedInvoice?.price?.toString() ?? "0",
            status: (intermediatedInvoice as { state?: string } | undefined)
              ?.state,
          };
        }
        setInvoiceDetails(structured);
      } catch (error) {
        console.log(error);
        setError("Failed to fetch invoice details.");
      }
    };
    loadInvoice();
  }, [
    invoiceId,
    isMetaInvoice,
    getIntermediatedInvoiceData,
    intermediatedInvoice,
  ]);

  if (invoiceDetails && !error) {
    return (
      <InvoiceCheckout invoice={invoiceDetails} isMetaInvoice={isMetaInvoice} />
    );
  }

  return (
    <PaymentShell>
      <CheckoutHeader links={marketplaceLinks} />
      <main>
        {error ? (
          <ShellMessage>{error}</ShellMessage>
        ) : invoiceId ? (
          <ShellMessage>Loading the invoice…</ShellMessage>
        ) : (
          <ShellMessage>This payment link is missing its invoice.</ShellMessage>
        )}
      </main>
    </PaymentShell>
  );
};

export default CheckoutPage;
