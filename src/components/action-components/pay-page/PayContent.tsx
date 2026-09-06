"use client";
import { useSearchParams } from "next/navigation";
import Container from "@/components/Container";
import PaymentCard from "@/components/action-components/pay-page/PaymentCard";
import { decodeInvoiceId, PAY_LINK_PARAM } from "@/lib/payLink";

const PayContent = () => {
  const searchParams = useSearchParams();
  // Decoding is synchronous, so the invoice renders on the first pass with no
  // request in between. Meta invoices are paid through checkout, not here, so
  // the kind is not consulted.
  const decoded = decodeInvoiceId(searchParams.get(PAY_LINK_PARAM));

  return (
    <Container>
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <PaymentCard
          data={decoded ? { invoiceId: decoded.invoiceId } : null}
        />
      </div>
    </Container>
  );
};

export default PayContent;
