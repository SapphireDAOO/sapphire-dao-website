import type { MultiSigTransaction } from "@/model/multisig";

const STORE_VERSION = 1;
const STORE_KEY = `multisig-pending:v${STORE_VERSION}`;

const ENTRY_TTL_MS = 1000 * 60 * 5;

type PendingEntry = {
  transaction: MultiSigTransaction;
  updatedAt: number;
};

type PendingStore = Record<string, PendingEntry>;

const entryKey = (chainId: number, txHash: string): string =>
  `${chainId}:${txHash.toLowerCase()}`;

const isUsable = (entry: PendingEntry | undefined): boolean =>
  Boolean(
    entry &&
    entry.transaction &&
    typeof entry.transaction.id === "string" &&
    typeof entry.updatedAt === "number" &&
    Date.now() - entry.updatedAt < ENTRY_TTL_MS,
  );

const readStore = (): PendingStore => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PendingStore;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, entry]) => isUsable(entry)),
    );
  } catch {
    return {};
  }
};

const writeStore = (store: PendingStore) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {}
};

export const readPendingTransactions = (
  chainId: number,
): MultiSigTransaction[] => {
  const prefix = `${chainId}:`;

  return Object.entries(readStore())
    .filter(([key]) => key.startsWith(prefix))
    .map(([, entry]) => entry.transaction)
    .sort((a, b) => Number(b.proposedAt ?? 0) - Number(a.proposedAt ?? 0));
};

export const savePendingTransactions = (
  chainId: number,
  transactions: MultiSigTransaction[],
) => {
  const prefix = `${chainId}:`;
  const store = readStore();

  for (const key of Object.keys(store)) {
    if (key.startsWith(prefix)) delete store[key];
  }

  const now = Date.now();
  for (const transaction of transactions) {
    store[entryKey(chainId, transaction.id)] = { transaction, updatedAt: now };
  }

  writeStore(store);
};
