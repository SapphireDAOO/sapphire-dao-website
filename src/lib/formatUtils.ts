export const formatAddress = (address: string): string =>
  `${address.slice(0, 4)}..${address.slice(-3)}`;
