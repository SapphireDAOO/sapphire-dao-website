import { client } from "../graphql/client";
import { ADMIN_TRANSACTIONS_QUERY } from "../graphql/metricsQueries";
import { throwSubgraphError } from "./errors";

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
    // network-only: react-query owns caching for this fetcher.
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
    target: t.target,
    data: t.data,
    timestamp: Number(t.executedAt ?? t.proposedAt),
  }));
};
