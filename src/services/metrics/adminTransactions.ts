// Admin activity feed: the most recent multisig transactions, from the
// MultiSigTransaction entity (id = txHash, used for the explorer link).

import { client } from "../graphql/client";
import { ADMIN_TRANSACTIONS_QUERY } from "../graphql/metricsQueries";
import { throwSubgraphError } from "./errors";

export type MultisigStatus =
  | "PROPOSED"
  | "APPROVED"
  | "CANCELED"
  | "EXECUTED";

/** A single multisig transaction row for the Admin card. */
export interface AdminTransaction {
  /** Transaction hash (entity id), for the block-explorer link. */
  id: string;
  status: MultisigStatus;
  proposer: string;
  approvalCount: number;
  nonce: string;
  /** Unix seconds — executedAt when executed, else proposedAt. */
  timestamp: number;
}

interface AdminTxRow {
  id: string;
  status: MultisigStatus;
  proposer: string;
  executor: string | null;
  approvalCount: string;
  nonce: string;
  proposedAt: string;
  executedAt: string | null;
}

/** The latest `first` multisig transactions, newest first. */
export const fetchAdminTransactions = async (
  chainId: number,
  first = 5,
): Promise<AdminTransaction[]> => {
  const result = await client(chainId)
    // network-only: react-query owns caching for this fetcher; cache-first
    // would turn its refetches into stale no-ops.
    .query<{ multiSigTransactions: AdminTxRow[] }>(
      ADMIN_TRANSACTIONS_QUERY,
      { first },
      { requestPolicy: "network-only" },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  return (result.data?.multiSigTransactions ?? []).map((t) => ({
    id: t.id,
    status: t.status,
    proposer: t.proposer,
    approvalCount: Number(t.approvalCount),
    nonce: t.nonce,
    timestamp: Number(t.executedAt ?? t.proposedAt),
  }));
};
