"use client";

import { useContext, useMemo, useState } from "react";
import type { Address } from "viem";
import {
  ContractActionsContext,
  ContractLoadingContext,
} from "@/context/contract-context";
import type { InvoiceDetails } from "@/model/model";
import { formatDurationSeconds } from "@/utils";
import { useGetIntermediatedInvoiceData } from "@/hooks/useGetIntermediatedInvoiceData";
import { INTERMEDIATED_STATE_LABELS } from "@/hooks/useInvoiceData";
import { isNativeToken, type useCheckoutQuote } from "@/hooks/useCheckoutQuote";
import { TextLink } from "./CheckoutLayout";
import PaymentSteps from "./PaymentSteps";
import { RedirectNotice, useRedirectCountdown } from "./RedirectNotice";
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
  const { token, amount, balance, isPayable, states, isLoadingOptions } = quote;
  const [paid, setPaid] = useState(false);
  const countdown = useRedirectCountdown(paid, () =>
    window.location.assign(MARKETPLACE_LINKS.home),
  );

  const hold =
    holdPeriodSeconds !== undefined
      ? formatDurationSeconds(holdPeriodSeconds)
      : undefined;

  // The first invoice that isn't open says why the payment is closed.
  const closedState = states.find((state) => state !== 1);
  const stateLabel = (
    (closedState !== undefined && INTERMEDIATED_STATE_LABELS[closedState]) ||
    invoice.status ||
    ""
  )
    .toLowerCase()
    .replace(/_/g, " ");
  const contactSeller =
    "Contact the seller through the marketplace if you think this is a mistake.";

  const blocked = isLoadingOptions
    ? undefined
    : !isPayable
      ? {
          title: "This invoice can't be paid",
          body: (
            <p>
              {stateLabel
                ? `It's currently ${stateLabel}, so it can't be paid.`
                : "It's no longer open for payment."}{" "}
              {contactSeller}
            </p>
          ),
          status: stateLabel ? `Invoice ${stateLabel}` : "Not payable",
        }
      : !token
        ? {
            title: "This invoice can't be paid",
            body: (
              <p>
                The seller didn&apos;t choose a token you can pay with on this
                network. {contactSeller}
              </p>
            ),
            status: "Not payable",
          }
        : undefined;

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
      onPay={async (onSubmitted) => {
        if (!token) return false;
        const success = await payIntermediatedInvoice(
          isMetaInvoice ? "payMetaInvoice" : "paySingleInvoice",
          BigInt(invoice.price),
          invoice.invoiceId,
          token.id as Address,
          onSubmitted,
        );
        setPaid(success);
        return success;
      }}
      payDetails={
        hold && (
          <p className="border-l-2 border-blue-900 pl-3">
            The payment is held in escrow for {hold}, then released to the
            seller unless you raise a dispute.
          </p>
        )
      }
      paidDetails={
        <>
          {hold && (
            <p>
              It&apos;s held in escrow for {hold}, then released to the seller.
            </p>
          )}
          <RedirectNotice destination="the marketplace" seconds={countdown} />
        </>
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
