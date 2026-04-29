"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ContractContext } from "@/context/contract-context";
import { useGetMetaInvoice } from "@/hooks/useGetMetaInvoice";
import { InvoiceDetails, TokenData } from "@/model/model";
import { BASE_SEPOLIA, mergeKnownPaymentTokens } from "@/constants";
import { useChainId } from "wagmi";

import CheckoutCard from "./CheckoutCard";
import Container from "@/components/Container";
import { useGetMarketplaceInvoiceData } from "@/hooks/useGetMarketplaceInvoiceData";
import {
  getContractInvoiceIdBigInt,
  getDisplayInvoiceIdString,
  toInvoiceIdBigInt,
} from "@/lib/invoiceIdentifiers";


const CheckoutPage = () => {
  const searchParams = useSearchParams();
  const jwtToken = searchParams.get("data");
  const chainId = useChainId() || BASE_SEPOLIA;

  const { getAdvancedInvoiceData } = useContext(ContractContext);
  const [invoiceId, setinvoiceId] = useState<bigint | null>(null);
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
          const parsedInvoiceId = toInvoiceIdBigInt(result.data.invoiceId);
          if (parsedInvoiceId) {
            setinvoiceId(parsedInvoiceId);
          } else {
            setError("Invalid invoice ID in payment link.");
          }
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
  const { data: invoiceInfo } = useGetMarketplaceInvoiceData(invoiceId || ZERO);
  const { data: metaInvoice } = useGetMetaInvoice(invoiceId || ZERO);
  const metaInvoicePrice =
    (metaInvoice as { price?: bigint } | undefined)?.price;
  const marketplaceInvoice = invoiceInfo as
    | { invoiceId?: bigint; invoiceNonce?: bigint; price?: bigint; paymentToken?: string }
    | undefined;

  const isMetaInvoice = useMemo(() => {
    return metaInvoicePrice !== undefined && metaInvoicePrice !== BigInt(0);
  }, [metaInvoicePrice]);

  // Step 3: Fetch invoice data dynamically
  useEffect(() => {
    if (!invoiceId) return;

    const loadInvoice = async () => {
      if (!invoiceId) return;

      const type = isMetaInvoice ? "metaInvoice" : "smartInvoice";

      try {
        const response = await getAdvancedInvoiceData(invoiceId, type);

        const invoice = response?.[type];
        const paymentTokens: TokenData[] = mergeKnownPaymentTokens(
          chainId,
          response?.paymentTokens || [],
        );

        let structured: InvoiceDetails;
        if (invoice) {
          structured = {
            id: getDisplayInvoiceIdString(invoice),
            invoiceId: getContractInvoiceIdBigInt(invoice),
            price: invoice.price,
            tokenList: paymentTokens,
            status: invoice.state,
          };
        } else {
          structured = {
            id:
              marketplaceInvoice?.invoiceId?.toString() ??
              marketplaceInvoice?.invoiceNonce?.toString() ??
              "",
            invoiceId: invoiceId,
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
    chainId,
    invoiceId,
    metaInvoicePrice,
    isMetaInvoice,
    getAdvancedInvoiceData,
    marketplaceInvoice,
  ]);

  // UI

  const isLoading =
    invoiceId && metaInvoice !== undefined && !invoiceDetails && !error;

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
