"use client";

import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Address } from "viem";

import { ContractContext } from "@/context/contract-context";
import { useGetMetaInvoice } from "@/hooks/useGetMetaInvoice";
import { InvoiceDetails, TokenData } from "@/model/model";

import CheckoutCard from "./checkout-card";
import Container from "@/components/Container";

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
      cancelAt
      contract
      createdAt
      escrow
      expiresAt
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

        console.log("RESPONSE", response);

        const result = await response.json();
        if (response.ok && result.valid) {
          setInvoiceKey(result.data.id as Address);
        } else {
          setError(result.error || "Token verification failed.");
        }
      } catch {
        setError("An error occurred while verifying the token.");
      }
    };

    if (jwtToken) verifyToken();
  }, [jwtToken]);

  // Step 2: Determine if it's a MetaInvoice
  const { data: metaInvoice } = useGetMetaInvoice(
    invoiceKey ?? "0x0000000000000000000000000000000000000000"
  );
  const isMetaInvoice =
    metaInvoice?.buyer &&
    metaInvoice.buyer !== "0x0000000000000000000000000000000000000000";

  // Step 3: Fetch invoice data dynamically
  useEffect(() => {
    if (!invoiceKey || metaInvoice === undefined) return;
    loadInvoice();
  }, [invoiceKey, metaInvoice]);

  const loadInvoice = async () => {
    if (!invoiceKey) return;

    const query = isMetaInvoice ? metaInvoiceQuery : smartInvoiceQuery;
    const type = isMetaInvoice ? "metaInvoice" : "smartInvoice";

    try {
      const response = await getAdvancedInvoiceData(invoiceKey, query, type);
      const invoice = response?.[type];
      const paymentTokens: TokenData[] = response?.paymentTokens || [];

      if (!invoice) {
        setError("Invoice not found.");
        return;
      }

      const structured: InvoiceDetails = {
        id: invoice.invoiceId,
        invoiceKey: invoice.id,
        price: invoice.price,
        paymentToken: invoice.paymentToken,
        tokenList: paymentTokens,
      };

      setInvoiceDetails(structured);
    } catch {
      setError("Failed to fetch invoice details.");
    }
  };

  // UI
  if (error) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-red-500">
          {error}
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
