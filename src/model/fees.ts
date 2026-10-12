import type { Address } from "viem";

export interface FeeReceiverTokenBalanceRow {
  id: string;
  accrued: string;
  swept: string;
  balance: string;
  updatedAt: string;
  feeReceiver: { id: string; address: string; sweepCount: string };
  token: { id: string; name: string | null; decimal: number | null };
}

export interface FeeSweepRow {
  id: string;
  destination: string;
  amount: string;
  timestamp: string;
  txHash: string;
  token: { id: string; name: string | null; decimal: number | null };
}

export interface SweepTransaction {
  /** txHash + token + destination: one tx can carry more than one sweep call. */
  id: string;
  txHash: string;
  timestamp: string;
  destination: string;
  token: { id: string; name: string | null; decimal: number | null };
  amount: bigint;
  receiverCount: number;
}

export interface FeeReceiverBalance {
  address: Address;
  balance: bigint;
  /** Unix seconds the balance last changed. */
  updatedAt: number;
}

export interface TokenFeeSummary {
  /** Token id as the subgraph records it — the zero address for native fees. */
  tokenId: string;
  /**
   * WETH when `tokenId` is the zero address: native
   * fees are wrapped before reaching a receiver.
   */
  sweepToken: Address;
  symbol: string;
  decimals: number;
  accrued: bigint;
  swept: bigint;
  balance: bigint;
  receiverCount: number;
  receivers: FeeReceiverBalance[];
}

export interface SweepSource {
  address: Address;
  amount: bigint;
  available: bigint;
  drained: boolean;
}

export interface SweepPlan {
  sources: SweepSource[];
  total: bigint;
  requested: bigint;
  shortfall: bigint;
}
