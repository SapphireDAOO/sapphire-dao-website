"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ContractContext } from "@/context/contract-context";
import { useGetMetaInvoice } from "@/hooks/useGetMetaInvoice";
import { InvoiceDetails, TokenData } from "@/model/model";

import CheckoutCard from "./checkout-card";
import Container from "@/components/Container";
import { useGetMarketplaceInvoiceData } from "@/hooks/useGetMarketplaceInvoiceData";

const paymentTokensFragment = `
  paymentTokens(first: 5) {
    id
    name
    decimal
  }
`;

const smartInvoiceQuery = `
  query ($id: String!) {
    smartInvoice(id: $id) {
      amountPaid
      contract
      createdAt
      escrow
      id
      invoiceId
      paidAt
      paymentToken
      price
      releasedAt
      state
    }
    ${paymentTokensFragment}
  }
`;

const metaInvoiceQuery = `
  query ($id: String!) {
    metaInvoice(id: $id) {
      contract
      id
      invoiceId
      price
    }
    ${paymentTokensFragment}
  }
`;

const CheckoutPage = () => {
  const searchParams = useSearchParams();
  const jwtToken = searchParams.get("data");

  const { getAdvancedInvoiceData } = useContext(ContractContext);
  const [orderId, setOrderId] = useState<bigint | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceDetails | null>(
    null
  );
  const [error, setError] = useState("");

  // Step 1: Verify JWT token and extract invoice key
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/verify-token?token=${jwtToken}`, {
          method: "GET",
        });

        const result = await response.json();
        if (response.ok && result.valid) {
          setOrderId(result.data.orderId);
        } else {
          setError(result.error || "Token verification failed.");
        }
      } catch {
        setError("An error occurred while verifying the token.");
      }
    };

    if (jwtToken) verifyToken();
  }, [jwtToken]);

  const ZERO: bigint = BigInt(0);
  const { data: invoiceInfo } = useGetMarketplaceInvoiceData(orderId || ZERO);
  const { data: metaInvoice } = useGetMetaInvoice(orderId || ZERO);
  const metaInvoicePrice =
    (metaInvoice as { price?: bigint } | undefined)?.price;
  const marketplaceInvoice = invoiceInfo as
    | { invoiceId?: bigint; price?: bigint; paymentToken?: string }
    | undefined;

  const isMetaInvoice = useMemo(() => {
    return metaInvoicePrice !== undefined && metaInvoicePrice !== BigInt(0);
  }, [metaInvoicePrice]);

  // Step 3: Fetch invoice data dynamically
  useEffect(() => {
    if (!orderId) return;

    const loadInvoice = async () => {
      if (!orderId) return;

      const query = isMetaInvoice ? metaInvoiceQuery : smartInvoiceQuery;
      const type = isMetaInvoice ? "metaInvoice" : "smartInvoice";

      try {
        const response = await getAdvancedInvoiceData(orderId, query, type);

        const invoice = response?.[type];
        const paymentTokens: TokenData[] = response?.paymentTokens || [];

        let structured: InvoiceDetails;
        if (invoice) {
          structured = {
            id: invoice.invoiceId,
            orderId: invoice.id,
            price: invoice.price,
            tokenList: paymentTokens,
            status: invoice.state,
          };
        } else {
          structured = {
            id: marketplaceInvoice?.invoiceId?.toString() ?? "",
            orderId: orderId,
            price: marketplaceInvoice?.price?.toString() ?? "0",
            tokenList: paymentTokens,
            status: (marketplaceInvoice as { state?: string } | undefined)
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
    orderId,
    metaInvoicePrice,
    isMetaInvoice,
    getAdvancedInvoiceData,
    marketplaceInvoice?.invoiceId,
    marketplaceInvoice?.paymentToken,
    marketplaceInvoice?.price,
  ]);

  // UI

  const isLoading =
    orderId && metaInvoice !== undefined && !invoiceDetails && !error;

  if (error) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-red-500">
          An error occcureed. Try again
        </div>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <p>Loading invoice details...</p>
        </div>
      </Container>
    );
  }

  if (!invoiceDetails) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <p>No invoice details...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <CheckoutCard data={invoiceDetails} isMetaInvoice={isMetaInvoice} />
      </div>
    </Container>
  );
};

export default CheckoutPage;
