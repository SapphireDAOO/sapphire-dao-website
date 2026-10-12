export interface MultiSigSigner {
  id: string;
  address: string;
  active: boolean;
  addedAt: string;
}

export interface MultiSigWallet {
  id: string;
  threshold: string;
  signerCount: string;
  transactionCount: string;
  signers: MultiSigSigner[];
}

export interface MultiSigTransaction {
  id: string;          // bytes32 txHash as hex
  target: string;
  value: string;
  data: string;
  nonce: string;
  proposer: string;
  status: "PROPOSED" | "APPROVED" | "EXECUTED" | "CANCELED";
  approvalCount: string;
  proposedAt: string;
  executedAt?: string;
  executor?: string;
  /**
   * Applied from a chain log and not yet indexed; kept
   * across refetches until the subgraph returns it.
   */
  unindexed?: boolean;
}
