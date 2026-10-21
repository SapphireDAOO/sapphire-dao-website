"use client";
import { useSearchParams } from "next/navigation";
import { CheckoutHeader } from "@/components/action-components/checkout/CheckoutHeader";
import {
  PaymentShell,
  ShellMessage,
} from "@/components/action-components/checkout/CheckoutLayout";
import { toInvoiceIdBigInt } from "@/lib/invoiceIdentifiers";
import { decodeInvoiceId, PAY_LINK_PARAM } from "@/lib/payLink";
import PayFlow, { dashboardLinks } from "./PayFlow";

const PayContent = () => {
  const searchParams = useSearchParams();
  const decoded = decodeInvoiceId(searchParams.get(PAY_LINK_PARAM));
  const invoiceId = decoded ? toInvoiceIdBigInt(decoded.invoiceId) : null;

  if (invoiceId) return <PayFlow invoiceId={invoiceId} />;

  return (
    <PaymentShell>
      <CheckoutHeader links={dashboardLinks} />
      <main>
        <ShellMessage>
          This payment link is invalid. Ask the seller for a new one.
        </ShellMessage>
      </main>
    </PaymentShell>
  );
};

export default PayContent;
