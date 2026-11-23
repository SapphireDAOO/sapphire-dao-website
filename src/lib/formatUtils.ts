import { formatUnits } from "viem";

export const formatAddress = (address: string): string =>
  `${address.slice(0, 4)}..${address.slice(-3)}`;

/** Token amount cut (not rounded) to `maxDecimals`, so a balance is never overstated. */
export const formatTokenAmount = (
  value: bigint,
  decimals: number,
  maxDecimals = 6,
): string => {
  const [whole, fraction = ""] = formatUnits(value, decimals).split(".");
  const cut = fraction.slice(0, maxDecimals).replace(/0+$/, "");
  if (!cut && whole === "0" && value > BigInt(0)) {
    return `<0.${"0".repeat(maxDecimals - 1)}1`;
  }
  return cut ? `${whole}.${cut}` : whole;
};
