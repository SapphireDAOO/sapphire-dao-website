"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Address } from "viem";

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
  const [invoiceKey, setInvoiceKey] = useState<Address | null>(null);
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
          setInvoiceKey(result.data.invoiceKey as Address);
        } else {
          setError(result.error || "Token verification failed.");
        }
      } catch {
        setError("An error occurred while verifying the token.");
      }
    };

    if (jwtToken) verifyToken();
  }, [jwtToken]);

  const { data: invoiceInfo } = useGetMarketplaceInvoiceData(
    invoiceKey || "0x"
  );
  const { data: metaInvoice } = useGetMetaInvoice(invoiceKey || "0x");

  const isMetaInvoice = useMemo(() => {
    return metaInvoice?.price != BigInt(0);
  }, [metaInvoice]);

  // Step 3: Fetch invoice data dynamically
  useEffect(() => {
    if (!invoiceKey) return;

    const loadInvoice = async () => {
      if (!invoiceKey) return;

      const query = isMetaInvoice ? metaInvoiceQuery : smartInvoiceQuery;
      const type = isMetaInvoice ? "metaInvoice" : "smartInvoice";

      try {
        const response = await getAdvancedInvoiceData(invoiceKey, query, type);

        const invoice = response?.[type];
        const paymentTokens: TokenData[] = response?.paymentTokens || [];

        let structured: InvoiceDetails;
        if (invoice) {
          structured = {
            id: invoice.invoiceId,
            invoiceKey: invoice.id,
            price: invoice.price,
            tokenList: paymentTokens,
          };
        } else {
          structured = {
            id: invoiceInfo?.invoiceId.toString() ?? "",
            invoiceKey: invoiceKey,
            price: invoiceInfo?.price.toString() ?? "0",
            tokenList: paymentTokens,
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
    invoiceKey,
    metaInvoice,
    isMetaInvoice,
    getAdvancedInvoiceData,
    invoiceInfo?.invoiceId,
    invoiceInfo?.paymentToken,
    invoiceInfo?.price,
  ]);

  // UI

  const isLoading =
    invoiceKey && metaInvoice !== undefined && !invoiceDetails && !error;

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
  console.log("THE INVOICE DETAILS IS", invoiceDetails);
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
