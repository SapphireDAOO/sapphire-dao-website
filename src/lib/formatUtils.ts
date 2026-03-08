/** Returns a shortened Ethereum address: "0xAB..XYZ" */
export const formatAddress = (address: string): string =>
  `${address.slice(0, 4)}..${address.slice(-3)}`;
