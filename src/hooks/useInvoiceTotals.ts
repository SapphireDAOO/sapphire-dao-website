import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { client } from "@/services/graphql/client";
import { userInvoiceTotalsQuery } from "@/services/graphql/userQueries";
import { sortState } from "@/lib/invoiceHistory";
import { getContractInvoiceIdBigInt } from "@/lib/invoiceIdentifiers";
import { BASE_SEPOLIA } from "@/constants";

const TOTALS_PAGE_SIZE = 1000;

export type InvoiceSide = "seller" | "buyer";

export type InvoiceTotalsRow = {
  /** Contract invoice id, the same key the live event feed uses. */
  id: string;
  side: InvoiceSide;
  status: string;
  /** Wei for direct invoices, 8-decimal USD for intermediated ones. */
  amount: bigint;
};

type RawRow = { id: string; state: string; price: string; expiresAt?: string };

type TotalsData = {
  user: {
    ownedSimpleInvoices?: RawRow[];
    paidSimpleInvoices?: RawRow[];
    issuedAdvancedInvoices?: RawRow[];
    receivedAdvancedInvoices?: RawRow[];
  } | null;
};

const toRows = (raw: RawRow[], side: InvoiceSide) =>
  raw.map((row): InvoiceTotalsRow => ({
    id: getContractInvoiceIdBigInt(row).toString(),
    side,
    status: sortState(row.state, row.expiresAt),
    amount: BigInt(row.price ?? 0),
  }));

const fetchPage = async (
  chainId: number,
  address: string,
  isIntermediated: boolean,
  sellerSkip: number | null,
  buyerSkip: number | null,
): Promise<{ seller: RawRow[]; buyer: RawRow[] }> => {
  const { data, error } = await client(chainId)
    .query<TotalsData>(userInvoiceTotalsQuery, {
      address,
      first: TOTALS_PAGE_SIZE,
      sellerSkip: sellerSkip ?? 0,
      buyerSkip: buyerSkip ?? 0,
      includeOwned: !isIntermediated && sellerSkip !== null,
      includePaid: !isIntermediated && buyerSkip !== null,
      includeIssued: isIntermediated && sellerSkip !== null,
      includeReceived: isIntermediated && buyerSkip !== null,
    })
    .toPromise();
  if (error) throw error;

  const user = data?.user;
  return {
    seller:
      (isIntermediated
        ? user?.issuedAdvancedInvoices
        : user?.ownedSimpleInvoices) ?? [],
    buyer:
      (isIntermediated
        ? user?.receivedAdvancedInvoices
        : user?.paidSimpleInvoices) ?? [],
  };
};

const nextSkip = (skip: number, received: number) =>
  received === TOTALS_PAGE_SIZE ? skip + TOTALS_PAGE_SIZE : null;

/**
 * Every invoice the wallet created or paid, reduced to status and amount,
 * so the dashboard can total each status beyond the loaded page.
 */
export const useInvoiceTotals = ({
  isIntermediated,
  enabled = true,
}: {
  isIntermediated: boolean;
  enabled?: boolean;
}) => {
  const { address, chain } = useConnection();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  return useQuery({
    queryKey: [
      "invoice-totals",
      chainId,
      address?.toLowerCase(),
      isIntermediated,
    ],
    enabled: enabled && Boolean(address),
    queryFn: async () => {
      const rows: InvoiceTotalsRow[] = [];
      let sellerSkip: number | null = 0;
      let buyerSkip: number | null = 0;

      while (sellerSkip !== null || buyerSkip !== null) {
        const page = await fetchPage(
          chainId,
          address!.toLowerCase(),
          isIntermediated,
          sellerSkip,
          buyerSkip,
        );
        if (sellerSkip !== null) {
          rows.push(...toRows(page.seller, "seller"));
          sellerSkip = nextSkip(sellerSkip, page.seller.length);
        }
        if (buyerSkip !== null) {
          rows.push(...toRows(page.buyer, "buyer"));
          buyerSkip = nextSkip(buyerSkip, page.buyer.length);
        }
      }

      return rows;
    },
  });
};
