import {
  erc20Abi,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hash,
  type PublicClient,
} from "viem";
import { intermediatedPaymentProcessor } from "@/abis/IntermediatedPaymentProcessor";
import type { TokenData } from "@/model/model";
import { LOCALHOST } from "@/constants";
import { client } from "@/services/graphql/client";

const CREATION_TX_QUERIES = {
  single: `
    query ($id: ID!) {
      invoice: advancedPaymentProcessor(id: $id) {
        id
        events(where: { eventType: INVOICE_CREATED }, first: 1) { txHash }
      }
    }
  `,
  meta: `
    query ($id: ID!) {
      metaInvoice(id: $id) {
        invoices {
          id
          events(where: { eventType: INVOICE_CREATED }, first: 1) { txHash }
        }
      }
    }
  `,
} as const;

type CreatedInvoice = { id: string; events: { txHash: Hash }[] };

type Registration = { invoiceId: bigint; paymentTokens: readonly Address[] };

// Blocks sampled to measure the chain's block time.
const BLOCK_SAMPLE = BigInt(1000);
// Blocks searched either side of the estimate; providers cap a search at 200.
const BLOCK_WINDOW = BigInt(50);

/** Reads each invoice's registration event straight from the chain. */
const fetchRegistrationsOnChain = async (
  publicClient: PublicClient,
  chainId: number,
  processor: Address,
  invoiceIds: bigint[],
): Promise<Registration[]> => {
  const [invoices, latest] = await Promise.all([
    publicClient.multicall({
      allowFailure: false,
      contracts: invoiceIds.map((id) => ({
        address: processor,
        abi: intermediatedPaymentProcessor,
        functionName: "getInvoice" as const,
        args: [id] as const,
      })),
    }),
    publicClient.getBlock(),
  ]);
  const created = invoices.map((invoice) => BigInt(invoice.createdAt));

  const range = async () => {
    // A local chain mines a block per transaction, so it is searched whole.
    if (chainId === LOCALHOST || latest.number <= BLOCK_SAMPLE) {
      return { fromBlock: BigInt(0), toBlock: latest.number };
    }
    const sample = await publicClient.getBlock({
      blockNumber: latest.number - BLOCK_SAMPLE,
    });
    const blocksPerSecond =
      Number(BLOCK_SAMPLE) / (Number(latest.timestamp - sample.timestamp) || 1);
    const blockAt = (time: bigint) =>
      latest.number -
      BigInt(Math.round(Number(latest.timestamp - time) * blocksPerSecond));
    const from = blockAt(created.reduce((a, b) => (b < a ? b : a))) - BLOCK_WINDOW;
    const to = blockAt(created.reduce((a, b) => (b > a ? b : a))) + BLOCK_WINDOW;
    return {
      fromBlock: from < BigInt(0) ? BigInt(0) : from,
      toBlock: to > latest.number ? latest.number : to,
    };
  };

  const logs = await publicClient.getContractEvents({
    address: processor,
    abi: intermediatedPaymentProcessor,
    eventName: "PaymentTokensRegistered",
    args: { invoiceId: invoiceIds },
    ...(await range()),
  });
  return logs.flatMap(({ args }) =>
    args.invoiceId !== undefined && args.paymentTokens
      ? [{ invoiceId: args.invoiceId, paymentTokens: args.paymentTokens }]
      : [],
  );
};

/** Finds the creation transactions through the subgraph, which lags the chain. */
const fetchRegistrationsFromSubgraph = async (
  publicClient: PublicClient,
  chainId: number,
  processor: Address,
  invoiceId: bigint,
  isMetaInvoice: boolean,
): Promise<Registration[]> => {
  const { data, error } = await client(chainId)
    .query(
      CREATION_TX_QUERIES[isMetaInvoice ? "meta" : "single"],
      { id: invoiceId.toString() },
    )
    .toPromise();
  if (error) throw new Error(error.message);

  const invoices: CreatedInvoice[] = isMetaInvoice
    ? (data?.metaInvoice?.invoices ?? [])
    : data?.invoice
      ? [data.invoice]
      : [];

  const txHashes = [
    ...new Set(invoices.flatMap((invoice) => invoice.events[0]?.txHash ?? [])),
  ];
  const receipts = await Promise.all(
    txHashes.map((hash) => publicClient.getTransactionReceipt({ hash })),
  );
  return parseEventLogs({
    abi: intermediatedPaymentProcessor,
    eventName: "PaymentTokensRegistered",
    logs: receipts
      .flatMap((receipt) => receipt.logs)
      .filter((log) => log.address.toLowerCase() === processor.toLowerCase()),
  }).map(({ args }) => args);
};

const tokensForAll = (
  invoiceIds: bigint[],
  registrations: Registration[],
): Address[] | null => {
  const tokensByInvoice = new Map(
    registrations.map(({ invoiceId, paymentTokens }) => [
      invoiceId.toString(),
      paymentTokens.map((token) => token.toLowerCase() as Address),
    ]),
  );
  const lists = invoiceIds.map((id) => tokensByInvoice.get(id.toString()));
  if (lists.length === 0 || lists.some((list) => !list)) return null;
  const [first, ...rest] = lists as Address[][];
  return first.filter((token) => rest.every((list) => list.includes(token)));
};

/**
 * The tokens each invoice was created to accept, from its
 * `PaymentTokensRegistered` event. A meta invoice accepts
 * only the tokens all of its invoices do.
 */
export const fetchRegisteredPaymentTokens = async (
  publicClient: PublicClient,
  chainId: number,
  processor: Address,
  invoiceId: bigint,
  invoiceIds: bigint[],
  isMetaInvoice: boolean,
): Promise<Address[]> => {
  if (invoiceIds.length === 0) return [];

  const onChain = await fetchRegistrationsOnChain(
    publicClient,
    chainId,
    processor,
    invoiceIds,
  ).catch((error) => {
    console.warn("On-chain payment token lookup failed", error);
    return [];
  });
  const tokens = tokensForAll(invoiceIds, onChain);
  if (tokens) return tokens;

  const indexed = await fetchRegistrationsFromSubgraph(
    publicClient,
    chainId,
    processor,
    invoiceId,
    isMetaInvoice,
  );
  return tokensForAll(invoiceIds, indexed) ?? [];
};

/** Symbol and decimals as each token contract reports them. */
export const fetchTokenData = async (
  publicClient: PublicClient,
  tokens: Address[],
): Promise<TokenData[]> => {
  const erc20s = tokens.filter((token) => token !== zeroAddress);
  const results = await publicClient.multicall({
    allowFailure: true,
    contracts: erc20s.flatMap((address) => [
      { address, abi: erc20Abi, functionName: "symbol" } as const,
      { address, abi: erc20Abi, functionName: "decimals" } as const,
    ]),
  });

  return tokens.flatMap((id): TokenData[] => {
    if (id === zeroAddress) return [{ id, name: "ETH", decimals: 18 }];
    const index = erc20s.indexOf(id) * 2;
    const symbol = results[index];
    const decimals = results[index + 1];
    // A token that won't report its decimals can't be priced or paid safely.
    if (decimals?.status !== "success") return [];
    return [
      {
        id,
        name: symbol?.status === "success" ? String(symbol.result) : id,
        decimals: Number(decimals.result),
      },
    ];
  });
};
