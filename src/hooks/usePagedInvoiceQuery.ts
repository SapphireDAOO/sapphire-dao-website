import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { client } from "@/services/graphql/client";
import { userInvoicesPageQuery } from "@/services/graphql/userQueries";
import { Invoice } from "@/model/model";
import { BASE_SEPOLIA } from "@/constants";
import { getLastActionTime } from "@/lib/invoiceHistory";
import {
  transformSimple,
  transformMarketplace,
} from "@/services/invoice-transformers";

/** How many invoices to pull from the subgraph in each batch */
export const INVOICE_FETCH_SIZE = 24;
/** How many invoices to show per UI page */
export const INVOICE_PAGE_SIZE = 12;

export type InvoiceTab = "all" | "seller" | "buyer";

interface Params {
  isMarketplace: boolean;
  enabled?: boolean;
}

interface Result {
  /** Owned (simple) or Issued (marketplace) invoices */
  sellerInvoices: Invoice[];
  /** Paid (simple) or Received (marketplace) invoices */
  buyerInvoices: Invoice[];
  hasMoreSeller: boolean;
  hasMoreBuyer: boolean;
  /** Fetch the next batch of seller invoices and append */
  loadMoreSeller: () => void;
  /** Fetch the next batch of buyer invoices and append */
  loadMoreBuyer: () => void;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch from scratch (resets all cached pages) */
  refetch: () => void;
}

export function usePagedInvoiceQuery({
  isMarketplace,
  enabled = true,
}: Params): Result {
  const { address, chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;

  const [sellerInvoices, setSellerInvoices] = useState<Invoice[]>([]);
  const [buyerInvoices, setBuyerInvoices] = useState<Invoice[]>([]);
  const [hasMoreSeller, setHasMoreSeller] = useState(false);
  const [hasMoreBuyer, setHasMoreBuyer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the next skip for load-more
  const nextSellerSkipRef = useRef(0);
  const nextBuyerSkipRef = useRef(0);
  // Cancellation token
  const fetchIdRef = useRef(0);

  /**
   * Core fetch: runs a single query fetching whichever categories have non-null skips.
   * When seller and buyer have equal skips (e.g. initial load), one query fetches both.
   * When only one is requested (load-more), only that category is included.
   */
  const doFetch = useCallback(
    async ({
      sellerSkip,
      buyerSkip,
      append,
    }: {
      sellerSkip: number | null; // null = skip this category
      buyerSkip: number | null; // null = skip this category
      append: boolean;
    }) => {
      if (!enabled) {
        setSellerInvoices([]);
        setBuyerInvoices([]);
        setHasMoreSeller(false);
        setHasMoreBuyer(false);
        setError(null);
        setIsLoading(false);
        return;
      }

      if (!address) {
        setSellerInvoices([]);
        setBuyerInvoices([]);
        setHasMoreSeller(false);
        setHasMoreBuyer(false);
        return;
      }

      const id = ++fetchIdRef.current;
      setIsLoading(true);
      if (!append) setError(null);

      const first = INVOICE_FETCH_SIZE + 1; // overfetch by 1 to detect hasMore

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rawSeller: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let rawBuyer: any[] = [];

        if (
          sellerSkip !== null &&
          buyerSkip !== null &&
          sellerSkip === buyerSkip
        ) {
          // Both at same skip: one combined query (common case: initial load)
          const { data, error: gqlError } = await client(chainId)
            .query(userInvoicesPageQuery, {
              address: address.toLowerCase(),
              first,
              skip: sellerSkip,
              includeOwned: !isMarketplace,
              includePaid: !isMarketplace,
              includeIssued: isMarketplace,
              includeReceived: isMarketplace,
            })
            .toPromise();

          if (id !== fetchIdRef.current) return;
          if (gqlError) throw gqlError;

          const raw = data?.user;
          rawSeller = isMarketplace
            ? (raw?.issuedInvoices ?? [])
            : (raw?.ownedInvoices ?? []);
          rawBuyer = isMarketplace
            ? (raw?.receivedInvoices ?? [])
            : (raw?.paidInvoices ?? []);
        } else {
          // Different skips or only one category: run in parallel where needed
          const [sellerResult, buyerResult] = await Promise.all([
            sellerSkip !== null
              ? client(chainId)
                  .query(userInvoicesPageQuery, {
                    address: address.toLowerCase(),
                    first,
                    skip: sellerSkip,
                    includeOwned: !isMarketplace,
                    includePaid: false,
                    includeIssued: isMarketplace,
                    includeReceived: false,
                  })
                  .toPromise()
              : Promise.resolve({ data: null, error: null }),
            buyerSkip !== null
              ? client(chainId)
                  .query(userInvoicesPageQuery, {
                    address: address.toLowerCase(),
                    first,
                    skip: buyerSkip,
                    includeOwned: false,
                    includePaid: !isMarketplace,
                    includeIssued: false,
                    includeReceived: isMarketplace,
                  })
                  .toPromise()
              : Promise.resolve({ data: null, error: null }),
          ]);

          if (id !== fetchIdRef.current) return;
          if (sellerResult.error) throw sellerResult.error;
          if (buyerResult.error) throw buyerResult.error;

          rawSeller =
            sellerSkip !== null
              ? isMarketplace
                ? (sellerResult.data?.user?.issuedInvoices ?? [])
                : (sellerResult.data?.user?.ownedInvoices ?? [])
              : [];
          rawBuyer =
            buyerSkip !== null
              ? isMarketplace
                ? (buyerResult.data?.user?.receivedInvoices ?? [])
                : (buyerResult.data?.user?.paidInvoices ?? [])
              : [];
        }

        const hasMoreSel =
          sellerSkip !== null && rawSeller.length > INVOICE_FETCH_SIZE;
        const hasMoreBuy =
          buyerSkip !== null && rawBuyer.length > INVOICE_FETCH_SIZE;

        const newSeller: Invoice[] = rawSeller
          .slice(0, INVOICE_FETCH_SIZE)
          .map((inv) =>
            isMarketplace
              ? transformMarketplace(inv, "IssuedInvoice")
              : transformSimple(inv, "Seller"),
          );

        const newBuyer: Invoice[] = rawBuyer
          .slice(0, INVOICE_FETCH_SIZE)
          .map((inv) =>
            isMarketplace
              ? transformMarketplace(inv, "ReceivedInvoice")
              : transformSimple(inv, "Buyer"),
          );

        if (sellerSkip !== null) {
          setHasMoreSeller(hasMoreSel);
          setSellerInvoices((prev) =>
            append ? [...prev, ...newSeller] : newSeller,
          );
          nextSellerSkipRef.current = sellerSkip + INVOICE_FETCH_SIZE;
        }

        if (buyerSkip !== null) {
          setHasMoreBuyer(hasMoreBuy);
          setBuyerInvoices((prev) =>
            append ? [...prev, ...newBuyer] : newBuyer,
          );
          nextBuyerSkipRef.current = buyerSkip + INVOICE_FETCH_SIZE;
        }
      } catch (err) {
        if (id !== fetchIdRef.current) return;
        console.error("[usePagedInvoiceQuery] Error:", err);
        setError("Failed to load invoices. Please try again.");
      } finally {
        if (id === fetchIdRef.current) setIsLoading(false);
      }
    },
    [address, chainId, isMarketplace, enabled],
  );

  // Initial load: fetch both categories at once
  useEffect(() => {
    if (!enabled) {
      nextSellerSkipRef.current = 0;
      nextBuyerSkipRef.current = 0;
      setSellerInvoices([]);
      setBuyerInvoices([]);
      setHasMoreSeller(false);
      setHasMoreBuyer(false);
      setError(null);
      setIsLoading(false);
      return;
    }

    nextSellerSkipRef.current = 0;
    nextBuyerSkipRef.current = 0;
    void doFetch({ sellerSkip: 0, buyerSkip: 0, append: false });
  }, [doFetch, enabled]);

  const refetch = useCallback(() => {
    if (!enabled) return;
    nextSellerSkipRef.current = 0;
    nextBuyerSkipRef.current = 0;
    void doFetch({ sellerSkip: 0, buyerSkip: 0, append: false });
  }, [doFetch, enabled]);

  const loadMoreSeller = useCallback(() => {
    if (!hasMoreSeller || isLoading) return;
    void doFetch({
      sellerSkip: nextSellerSkipRef.current,
      buyerSkip: null,
      append: true,
    });
  }, [doFetch, hasMoreSeller, isLoading]);

  const loadMoreBuyer = useCallback(() => {
    if (!hasMoreBuyer || isLoading) return;
    void doFetch({
      sellerSkip: null,
      buyerSkip: nextBuyerSkipRef.current,
      append: true,
    });
  }, [doFetch, hasMoreBuyer, isLoading]);

  return {
    sellerInvoices,
    buyerInvoices,
    hasMoreSeller,
    hasMoreBuyer,
    loadMoreSeller,
    loadMoreBuyer,
    isLoading,
    error,
    refetch,
  };
}

/** Sort invoices newest-first by last meaningful action time */
export function sortByLastAction(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    const tA = getLastActionTime(a);
    const tB = getLastActionTime(b);
    if (!tA && !tB) return 0;
    if (!tA) return 1;
    if (!tB) return -1;
    return tB.localeCompare(tA);
  });
}
