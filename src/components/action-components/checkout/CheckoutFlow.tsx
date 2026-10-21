"use client";

import { useContext, useMemo } from "react";
import type { Address } from "viem";
import {
  ContractActionsContext,
  ContractLoadingContext,
} from "@/context/contract-context";
import type { InvoiceDetails } from "@/model/model";
import { formatDurationSeconds } from "@/utils";
import { useGetIntermediatedInvoiceData } from "@/hooks/useGetIntermediatedInvoiceData";
import { isNativeToken, type useCheckoutQuote } from "@/hooks/useCheckoutQuote";
import { TextLink } from "./CheckoutLayout";
import PaymentSteps from "./PaymentSteps";
import { MARKETPLACE_LINKS } from "./checkoutLinks";

const useHoldPeriodSeconds = (invoiceId: bigint) => {
  // holdPeriod is the field's pre-rename name.
  const { data } = useGetIntermediatedInvoiceData(invoiceId);
  return useMemo(() => {
    const fetched = data as
      | { escrowHoldPeriod?: number | bigint; holdPeriod?: number | bigint }
      | undefined;
    const seconds = Number(fetched?.escrowHoldPeriod ?? fetched?.holdPeriod);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
  }, [data]);
};

const CheckoutFlow = ({
  invoice,
  isMetaInvoice,
  quote,
}: {
  invoice: InvoiceDetails;
  isMetaInvoice: boolean;
  quote: ReturnType<typeof useCheckoutQuote>;
}) => {
  const { payIntermediatedInvoice } = useContext(ContractActionsContext);
  const isLoading = useContext(ContractLoadingContext);
  const holdPeriodSeconds = useHoldPeriodSeconds(invoice.invoiceId);
  const { token, amount, balance, isPayable, isLoadingOptions } = quote;

  const hold =
    holdPeriodSeconds !== undefined
      ? formatDurationSeconds(holdPeriodSeconds)
      : undefined;

  const blocked =
    isLoadingOptions || (isPayable && token)
      ? undefined
      : {
          title: "This invoice can't be paid",
          body: (
            <p>
              {!isPayable
                ? "It has already been paid, or the seller has cancelled it."
                : "The seller didn't choose a token you can pay with on this network."}{" "}
              Contact the seller through the marketplace if you think this is a
              mistake.
            </p>
          ),
          status: invoice.status
            ? `Invoice ${invoice.status.toLowerCase()}`
            : "Not payable",
        };

  return (
    <PaymentSteps
      symbol={token?.name ?? "ETH"}
      decimals={token?.decimals ?? 18}
      isNative={isNativeToken(token)}
      amount={amount}
      balance={balance}
      blocked={blocked}
      paying={
        isLoading === "paySingleInvoice" || isLoading === "payMetaInvoice"
      }
      onPay={async (onSubmitted) =>
        token
          ? payIntermediatedInvoice(
              isMetaInvoice ? "payMetaInvoice" : "paySingleInvoice",
              BigInt(invoice.price),
              invoice.invoiceId,
              token.id as Address,
              onSubmitted,
            )
          : false
      }
      payDetails={
        hold && (
          <p className="border-l-2 border-blue-900 pl-3">
            Held in escrow for {hold}, then released to the seller unless you
            raise a dispute.
          </p>
        )
      }
      paidDetails={
        hold && (
          <p>
            It&apos;s held in escrow for {hold}, then released to the seller.
          </p>
        )
      }
      exitLinks={
        <>
          <TextLink href={MARKETPLACE_LINKS.shopping} external={false}>
            Your orders
          </TextLink>
          <TextLink href={MARKETPLACE_LINKS.home} external={false}>
            Return to marketplace
          </TextLink>
        </>
      }
      walletHelpHref={MARKETPLACE_LINKS.walletHelp}
      exchangeHelpHref={MARKETPLACE_LINKS.exchangeHelp}
      tokens={quote.tokens.map(({ id, name }) => ({ id: id.toString(), name }))}
      selectedTokenId={token?.id.toString()}
      onTokenChange={quote.setTokenId}
    />
  );
};

export default CheckoutFlow;
