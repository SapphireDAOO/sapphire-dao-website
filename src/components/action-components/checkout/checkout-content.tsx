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

        let result = await response.json();
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

  const { data: invoiceInfo } = useGetMarketplaceInvoiceData(invoiceKey!);
  const { data: metaInvoice } = useGetMetaInvoice(invoiceKey!);

  console.log(invoiceInfo, metaInvoice);

  const isMetaInvoice = useMemo(() => {
    return (
      metaInvoice?.buyer &&
      metaInvoice.buyer !== "0x0000000000000000000000000000000000000000"
    );
  }, [metaInvoice]);

  const defaultToken: TokenData[] = [
    {
      name: "Mock Usdc",
      id: "0x0363820C54670800d71A0098c96B53Cf11193F6F",
      decimals: 6,
    },
    {
      name: "Mock WBtc",
      id: "0x8f73c398ECcd94874752c1dFa48F20A092C8Cf86",
      decimals: 8,
    },
  ];

  // Step 3: Fetch invoice data dynamically
  useEffect(() => {
    if (!invoiceKey || metaInvoice === undefined) return;

    const loadInvoice = async () => {
      if (!invoiceKey) return;

      const query = isMetaInvoice ? metaInvoiceQuery : smartInvoiceQuery;
      const type = isMetaInvoice ? "metaInvoice" : "smartInvoice";

      console.log("TYPE", isMetaInvoice);

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
            paymentToken: invoice.paymentToken,
            tokenList: paymentTokens,
          };
        } else {
          if (isMetaInvoice) {
            structured = {
              id: metaInvoice?.invoiceId.toString(),
              invoiceKey: invoiceKey,
              price: metaInvoice?.price.toString(),
              paymentToken: metaInvoice?.paymentToken.toString() as Address,
              tokenList: defaultToken,
            };
          } else {
            structured = {
              id: invoiceInfo?.invoiceId.toString()!,
              invoiceKey: invoiceKey,
              price: invoiceInfo?.price.toString()!,
              paymentToken: invoiceInfo?.paymentToken.toString() as Address,
              tokenList: defaultToken,
            };
          }
        }

        setInvoiceDetails(structured);
      } catch (error) {
        console.log(error);
        setError("Failed to fetch invoice details.");
      }
    };
    loadInvoice();
  }, [invoiceKey, metaInvoice]);

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
