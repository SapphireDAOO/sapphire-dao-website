"use client";

import { useState, type ReactNode } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { formatAddress } from "@/utils";
import type { TokenData } from "@/model/model";
import { RATE_WINDOW_MS } from "@/constants";
import { useSharedSecondTicker } from "@/hooks/useSharedSecondTicker";
import { formatTokenAmount } from "@/hooks/useCheckoutQuote";
import {
  FIAT_CURRENCIES,
  FIAT_RATES,
  type FiatCurrency,
} from "@/services/fiatRates";
import { CheckoutColumns, Eyebrow, TextLink } from "./CheckoutLayout";

export const Brand = () => (
  <div className="flex items-center gap-2">
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-900 font-serif text-sm italic text-white">
      s
    </span>
    <span className="text-base font-semibold tracking-tight text-stone-900 sm:text-lg">
      Sapphire DAO
    </span>
  </div>
);

/** Time until the shown rate is refreshed, counted from when it was fetched. */
const RateCountdown = ({ updatedAt }: { updatedAt: number }) => {
  useSharedSecondTicker(true);
  const left = Math.max(
    0,
    Math.ceil((updatedAt + RATE_WINDOW_MS - Date.now()) / 1_000),
  );
  const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
  return (
    <p className="mt-1 text-[11px] tabular-nums text-stone-500 sm:text-sm">
      {left > 0 ? `Rate refreshes in ${clock}` : "Refreshing rate…"}
    </p>
  );
};

// The currency dropdown's value for the token being paid with.
const TOKEN_VALUE = "token";

const formatFiat = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);

// Native selects: the phone's own picker is the easiest to use. It sits
// invisibly over the shown text, as Safari and Firefox size a select
// without its letter-spacing and would clip the last letter.
const InlineSelect = ({
  label,
  value,
  display,
  onChange,
  children,
  className,
}: {
  label: string;
  value: string;
  display: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) => (
  <label
    className={`relative inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap font-semibold tracking-[0.12em] text-stone-900 focus-within:ring-2 focus-within:ring-blue-900 ${className ?? ""}`}
  >
    <span aria-hidden>{display}</span>
    <ChevronDown className="h-3 w-3 shrink-0 text-stone-700" />
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
    >
      {children}
    </select>
  </label>
);

export type AmountDueProps = {
  /** USD value of the amount; the fiat display needs it. */
  priceUsd?: number;
  /** Headline currency: USD, or else the token, with any fiat as an estimate beneath. */
  billedInUsd: boolean;
  /** The invoice number, shown beside the label. */
  reference?: string;
  amount?: bigint;
  token?: TokenData;
  /** When the price behind the secondary amount was fetched; drives the countdown. */
  rateUpdatedAt?: number;
};

const AmountDue = ({
  priceUsd,
  billedInUsd,
  reference,
  amount,
  token,
  rateUpdatedAt,
}: AmountDueProps) => {
  const rates = FIAT_RATES;
  const [currency, setCurrency] = useState<FiatCurrency>("USD");
  // A USD-billed price can also be shown in the token being paid with.
  const [inToken, setInToken] = useState(false);
  const convertible = billedInUsd && Boolean(token);
  const showToken = inToken && convertible;
  const offered = FIAT_CURRENCIES.filter((code) => rates?.[code]);
  const shownCurrency = rates?.[currency] ? currency : "USD";
  const tokenAmount =
    amount !== undefined && token
      ? formatTokenAmount(amount, token.decimals)
      : "…";
  const fiat =
    priceUsd === undefined
      ? undefined
      : formatFiat(priceUsd * (rates?.[shownCurrency] ?? 1), shownCurrency);
  // The headline is what the invoice is billed in, unless a
  // token is picked; the other amount sits beneath it.
  const shown = billedInUsd && !showToken ? (fiat ?? "…") : tokenAmount;

  const fiatOptions = (offered.length ? offered : ["USD"]).map((code) => (
    <option key={code} value={code}>
      {code}
    </option>
  ));
  const currencySelect = (className: string) => (
    <InlineSelect
      label="Show amount in"
      value={showToken ? TOKEN_VALUE : shownCurrency}
      display={showToken && token ? token.name : shownCurrency}
      onChange={(value) => {
        setInToken(value === TOKEN_VALUE);
        if (value !== TOKEN_VALUE) setCurrency(value as FiatCurrency);
      }}
      className={className}
    >
      {convertible && token ? (
        <>
          <optgroup label="Currencies">{fiatOptions}</optgroup>
          <optgroup label="Token you pay with">
            <option value={TOKEN_VALUE}>{token.name}</option>
          </optgroup>
        </>
      ) : (
        fiatOptions
      )}
    </InlineSelect>
  );

  const tokenBadge = (
    <span className="flex h-4 w-4 items-center justify-center rounded-full border border-stone-400 text-[9px] text-stone-600 sm:h-5 sm:w-5 sm:text-[10px]">
      Ξ
    </span>
  );

  return (
    <div>
      <Eyebrow>
        Amount due
        {reference && (
          <span className="text-stone-400"> · Invoice {reference}</span>
        )}
      </Eyebrow>
      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span
          className="font-normal leading-[0.9] tracking-[-0.06em] text-stone-900"
          // Shrinks with the column and the number's length so it never wraps.
          style={{
            fontSize: `min(5.75rem, ${(100 / (shown.length * 0.58)).toFixed(2)}cqw)`,
          }}
        >
          {shown}
        </span>
        {billedInUsd ? (
          currencySelect(
            "mb-1 border-b border-stone-900 pb-1 text-[11px] sm:text-sm",
          )
        ) : (
          <span className="mb-1 pb-1 text-[11px] font-semibold tracking-[0.12em] text-stone-900 sm:text-sm">
            {token?.name}
          </span>
        )}
      </div>

      {billedInUsd && showToken ? (
        <>
          <p className="mt-3 text-[11px] text-stone-700 sm:text-sm">
            ≈ {priceUsd !== undefined ? formatFiat(priceUsd, "USD") : "…"} USD
          </p>
          {rateUpdatedAt ? <RateCountdown updatedAt={rateUpdatedAt} /> : null}
          <p className="mt-1 text-[11px] text-stone-500 sm:text-sm">
            Billed in USD; you pay this in {token?.name}.
          </p>
        </>
      ) : billedInUsd ? (
        <>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500 sm:text-sm">
            {tokenBadge}
            <span className="text-stone-700">{tokenAmount}</span>
            <span className="text-stone-700">{token?.name}</span>
          </p>
          {rateUpdatedAt ? <RateCountdown updatedAt={rateUpdatedAt} /> : null}
          {priceUsd !== undefined && shownCurrency !== "USD" && (
            <p className="mt-1 text-[11px] text-stone-500 sm:text-sm">
              Billed as {formatFiat(priceUsd, "USD")}. {shownCurrency} is an
              estimate.
            </p>
          )}
        </>
      ) : (
        fiat && (
          <>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-stone-500 sm:text-sm">
              <span className="text-stone-700">≈ {fiat}</span>
              {currencySelect("text-[11px] sm:text-sm")}
            </p>
            {rateUpdatedAt ? <RateCountdown updatedAt={rateUpdatedAt} /> : null}
            <p className="mt-1 text-[11px] text-stone-500 sm:text-sm">
              Billed in {token?.name ?? "tokens"}. {shownCurrency} is an
              estimate.
            </p>
          </>
        )
      )}
    </div>
  );
};

const AccountLinks = ({ links }: { links: ReactNode }) => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <nav aria-label="Account" className="flex flex-col items-start gap-2">
      {links}
      {address && (
        <div className="mt-2 w-full border-t border-stone-300 pt-2">
          <p
            className="truncate font-mono text-[11px] text-stone-900 sm:text-xs"
            title={address}
          >
            {formatAddress(address)}
          </p>
          <button
            type="button"
            onClick={() => disconnect()}
            className="mt-1 text-[11px] text-stone-500 underline-offset-4 hover:text-stone-900 hover:underline sm:text-xs"
          >
            Disconnect
          </button>
        </div>
      )}
    </nav>
  );
};

export const BackLink = ({ href, label }: { href: string; label: string }) => (
  <TextLink href={href} external={false}>
    <ArrowLeft className="mr-1 inline h-3 w-3 align-[-1px]" />
    {label}
  </TextLink>
);

export const CheckoutHeader = ({
  links,
  amountDue,
}: {
  links: ReactNode;
  amountDue?: AmountDueProps;
}) => (
  <header>
    <CheckoutColumns
      left={
        <div className="space-y-10 sm:space-y-16">
          <Brand />
          {amountDue && <AmountDue {...amountDue} />}
        </div>
      }
      right={<AccountLinks links={links} />}
    />
  </header>
);
