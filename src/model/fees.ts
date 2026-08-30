import type { Address } from "viem";

/** Raw `FeeReceiverTokenBalance` row as the subgraph returns it. */
export interface FeeReceiverTokenBalanceRow {
  id: string;
  accrued: string;
  swept: string;
  balance: string;
  updatedAt: string;
  feeReceiver: { id: string; address: string; sweepCount: string };
  token: { id: string; name: string | null; decimal: number | null };
}

/** Raw `FeeSweep` row as the subgraph returns it. */
export interface FeeSweepRow {
  id: string;
  destination: string;
  amount: string;
  timestamp: string;
  txHash: string;
  token: { id: string; name: string | null; decimal: number | null };
}

/**
 * One sweep transaction, with every receiver it drew from totalled together.
 * The subgraph records a `FeeSweep` per receiver, but a single `sweep` call
 * drains many one-time receivers at once.
 */
export interface SweepTransaction {
  /** txHash + token + destination: one tx can carry more than one sweep call. */
  id: string;
  txHash: string;
  timestamp: string;
  destination: string;
  token: { id: string; name: string | null; decimal: number | null };
  /** Sum of the amounts pulled from every receiver in this sweep. */
  amount: bigint;
  /** How many fee receivers the sweep drew from. */
  receiverCount: number;
}

/** One fee receiver's unswept balance in a single token. */
export interface FeeReceiverBalance {
  address: Address;
  balance: bigint;
  /** Unix seconds the balance last changed. */
  updatedAt: number;
}

/** Everything the platform holds in one token, across every fee receiver. */
export interface TokenFeeSummary {
  /** Token id as the subgraph records it — the zero address for native fees. */
  tokenId: string;
  /**
   * The ERC-20 the Sweeper must be called with. Native fees are wrapped before
   * they reach a receiver, so this is WETH when `tokenId` is the zero address.
   */
  sweepToken: Address;
  symbol: string;
  decimals: number;
  /** Cumulative fees ever credited in this token. */
  accrued: bigint;
  /** Cumulative amount the Sweeper has moved out. */
  swept: bigint;
  /** accrued - swept: what the receivers still hold. */
  balance: bigint;
  receiverCount: number;
  /** Receivers holding this token, smallest balance first. */
  receivers: FeeReceiverBalance[];
}

/** One receiver's contribution to a planned sweep. */
export interface SweepSource {
  address: Address;
  /** Amount to pull from this receiver. */
  amount: bigint;
  /** The balance it was drawn from. */
  available: bigint;
  /** True when the sweep empties this receiver. */
  drained: boolean;
}

/** A `sweep` call worked out from receiver balances and a requested total. */
export interface SweepPlan {
  sources: SweepSource[];
  /** Sum of `sources[].amount` — equals `requested` unless there is a shortfall. */
  total: bigint;
  requested: bigint;
  /** requested - total; zero when the request is fully covered. */
  shortfall: bigint;
}
