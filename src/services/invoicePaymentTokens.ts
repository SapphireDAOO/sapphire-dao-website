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

/**
 * The tokens each invoice was created to accept, from the
 * `PaymentTokensRegistered` event in its creation transaction.
 * A meta invoice accepts only the tokens all of its invoices do.
 */
export const fetchRegisteredPaymentTokens = async (
  publicClient: PublicClient,
  chainId: number,
  processor: Address,
  invoiceId: bigint,
  isMetaInvoice: boolean,
): Promise<Address[]> => {
  const { data, error } = await client(chainId)
    .query(
      CREATION_TX_QUERIES[isMetaInvoice ? "meta" : "single"],
      { id: invoiceId.toString() },
      { requestPolicy: "network-only" },
    )
    .toPromise();
  if (error) throw new Error(error.message);

  const invoices: CreatedInvoice[] = isMetaInvoice
    ? (data?.metaInvoice?.invoices ?? [])
    : data?.invoice
      ? [data.invoice]
      : [];
  if (invoices.length === 0) return [];

  const txHashes = [
    ...new Set(invoices.flatMap((invoice) => invoice.events[0]?.txHash ?? [])),
  ];
  const receipts = await Promise.all(
    txHashes.map((hash) => publicClient.getTransactionReceipt({ hash })),
  );
  const registered = parseEventLogs({
    abi: intermediatedPaymentProcessor,
    eventName: "PaymentTokensRegistered",
    logs: receipts
      .flatMap((receipt) => receipt.logs)
      .filter((log) => log.address.toLowerCase() === processor.toLowerCase()),
  });

  const tokensByInvoice = new Map<string, Address[]>();
  for (const { args } of registered) {
    tokensByInvoice.set(
      args.invoiceId.toString(),
      args.paymentTokens.map((token) => token.toLowerCase() as Address),
    );
  }

  const lists = invoices.map((invoice) => tokensByInvoice.get(invoice.id));
  if (lists.some((list) => !list)) return [];
  const [first, ...rest] = lists as Address[][];
  return first.filter((token) => rest.every((list) => list.includes(token)));
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
