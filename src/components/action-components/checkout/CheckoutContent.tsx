"use client";

import { useContext, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { ContractActionsContext } from "@/context/contract-context";
import { InvoiceDetails, TokenData } from "@/model/model";
import {
  BASE_SEPOLIA,
  ENABLE_SUBGRAPH_PAYMENT_TOKENS,
  KNOWN_PAYMENT_TOKENS,
  mergeKnownPaymentTokens,
} from "@/constants";
import { useChainId } from "wagmi";

import CheckoutCard from "./CheckoutCard";
import Container from "@/components/Container";
import { useGetIntermediatedInvoiceData } from "@/hooks/useGetIntermediatedInvoiceData";
import {
  getContractInvoiceIdBigInt,
  getDisplayInvoiceIdString,
  toInvoiceIdBigInt,
} from "@/lib/invoiceIdentifiers";


import { decodeInvoiceId, PAY_LINK_PARAM } from "@/lib/payLink";

const CheckoutPage = () => {
  const searchParams = useSearchParams();
  const encodedId = searchParams.get(PAY_LINK_PARAM);
  const chainId = useChainId() || BASE_SEPOLIA;

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
        const paymentTokens: TokenData[] = ENABLE_SUBGRAPH_PAYMENT_TOKENS
          ? mergeKnownPaymentTokens(chainId, response?.paymentTokens || [])
          : (KNOWN_PAYMENT_TOKENS[chainId] ?? []);

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
              intermediatedInvoice?.invoiceId?.toString() ??
              intermediatedInvoice?.invoiceNonce?.toString() ??
              "",
            invoiceId: invoiceId,
            price: intermediatedInvoice?.price?.toString() ?? "0",
            tokenList: paymentTokens,
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
    chainId,
    invoiceId,
    isMetaInvoice,
    getIntermediatedInvoiceData,
    intermediatedInvoice,
  ]);

  const isLoading = invoiceId && !invoiceDetails && !error;

  if (error) {
    return (
      <Container>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] text-red-500">
          An error occurred. Try again
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
