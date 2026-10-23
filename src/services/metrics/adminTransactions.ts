import { client } from "../graphql/client";
import { ADMIN_TRANSACTIONS_QUERY } from "../graphql/metricsQueries";
import { throwSubgraphError } from "./errors";
import { fetchPauseActions, type PauseAction } from "../pauseState";

export type MultisigStatus =
  | "PROPOSED"
  | "APPROVED"
  | "CANCELED"
  | "EXECUTED";

export interface AdminTransaction {
  id: string;
  status: MultisigStatus;
  proposer: string;
  approvalCount: number;
  nonce: string;
  target: string;
  data: string;
  timestamp: number;
}

interface AdminTxRow {
  id: string;
  status: MultisigStatus;
  proposer: string;
  executor: string | null;
  approvalCount: string;
  nonce: string;
  target: string;
  data: string;
  proposedAt: string;
  executedAt: string | null;
}

export const fetchAdminTransactions = async (
  chainId: number,
  first = 5,
): Promise<AdminTransaction[]> => {
  const result = await client(chainId)
    .query<{ multiSigTransactions: AdminTxRow[] }>(
      ADMIN_TRANSACTIONS_QUERY,
      { first },
    )
    .toPromise();

  if (result.error) throwSubgraphError(result.error);

  return (result.data?.multiSigTransactions ?? []).map((t) => ({
    id: t.id,
    status: t.status,
    proposer: t.proposer,
    approvalCount: Number(t.approvalCount),
    nonce: t.nonce,
    target: t.target,
    data: t.data,
    timestamp: Number(t.executedAt ?? t.proposedAt),
  }));
};

export type AdminActivityItem =
  | { kind: "multisig"; timestamp: number; tx: AdminTransaction }
  | { kind: "pause"; timestamp: number; action: PauseAction };

/**
 * One page of multisig transactions and pause actions, newest first.
 * The two feeds are merged by time, so each is read up to the end of
 * the page; one item more says whether another page follows.
 */
export const fetchAdminActivity = async (
  chainId: number,
  page: number,
  pageSize: number,
): Promise<{ items: AdminActivityItem[]; hasNext: boolean }> => {
  const end = (page + 1) * pageSize;
  const [transactions, actions] = await Promise.all([
    fetchAdminTransactions(chainId, end + 1),
    fetchPauseActions(chainId, end + 1),
  ]);

  const merged: AdminActivityItem[] = [
    ...transactions.map((tx) => ({
      kind: "multisig" as const,
      timestamp: tx.timestamp,
      tx,
    })),
    ...actions.map((action) => ({
      kind: "pause" as const,
      timestamp: Number(action.timestamp),
      action,
    })),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return {
    items: merged.slice(page * pageSize, end),
    hasNext: merged.length > end,
  };
};
