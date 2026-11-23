import { formatUnits } from "viem";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const formatUsd = (value: number) => usd.format(value);

/** Wei to an ETH figure with three to four decimals, e.g. 0.085 or 1.2346. */
export const formatEthTotal = (wei: bigint) =>
  Number(formatUnits(wei, 18)).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 4,
  });

/** Intermediated prices carry 8 decimals of USD. */
export const formatUsdTotal = (raw: bigint) =>
  Number(formatUnits(raw, 8)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
