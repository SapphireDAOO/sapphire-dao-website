import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useIsWindowVisible } from "./useIsWindowVisible";
import { client } from "@/services/graphql/client";
import { userInvoicesPageQuery } from "@/services/graphql/userQueries";
import { Invoice } from "@/model/model";
import { BASE_SEPOLIA } from "@/constants";
import { getLastActionTime } from "@/lib/invoiceHistory";
import {
  transformSimple,
  transformIntermediated,
} from "@/services/invoice-transformers";

export const INVOICE_FETCH_SIZE = 24;
export const INVOICE_PAGE_SIZE = 12;

export type InvoiceTab = "all" | "seller" | "buyer";

interface Params {
  isIntermediated: boolean;
  enabled?: boolean;
}

interface Result {
  /** Owned (simple) or Issued (intermediated) invoices */
  sellerInvoices: Invoice[];
  /** Paid (simple) or Received (intermediated) invoices */
  buyerInvoices: Invoice[];
  hasMoreSeller: boolean;
  hasMoreBuyer: boolean;
  loadMoreSeller: () => void;
  loadMoreBuyer: () => void;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

type CachedPages = {
  seller: Invoice[];
  buyer: Invoice[];
  hasMoreSeller: boolean;
  hasMoreBuyer: boolean;
  nextSellerSkip: number;
  nextBuyerSkip: number;
};

const pageCache = new Map<string, CachedPages>();
const pageCacheKey = (
  chainId: number,
  address: string,
  isIntermediated: boolean,
) => `${chainId}:${address.toLowerCase()}:${isIntermediated ? "i" : "s"}`;

export function usePagedInvoiceQuery({
  isIntermediated,
  enabled = true,
}: Params): Result {
  const { address, chain } = useAccount();
  const chainId = chain?.id ?? BASE_SEPOLIA;
  const isWindowVisible = useIsWindowVisible();

  const cacheKey = address
    ? pageCacheKey(chainId, address, isIntermediated)
    : null;
  const cached = cacheKey ? pageCache.get(cacheKey) : undefined;

  const [sellerInvoices, setSellerInvoices] = useState<Invoice[]>(
    () => cached?.seller ?? [],
  );
  const [buyerInvoices, setBuyerInvoices] = useState<Invoice[]>(
    () => cached?.buyer ?? [],
  );
  const [hasMoreSeller, setHasMoreSeller] = useState(
    () => cached?.hasMoreSeller ?? false,
  );
  const [hasMoreBuyer, setHasMoreBuyer] = useState(
    () => cached?.hasMoreBuyer ?? false,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextSellerSkipRef = useRef(cached?.nextSellerSkip ?? 0);
  const nextBuyerSkipRef = useRef(cached?.nextBuyerSkip ?? 0);
  const fetchIdRef = useRef(0);

  // Another account or chain: show its cached lists, never the previous one's.
  useEffect(() => {
    const entry = cacheKey ? pageCache.get(cacheKey) : undefined;
    setSellerInvoices(entry?.seller ?? []);
    setBuyerInvoices(entry?.buyer ?? []);
    setHasMoreSeller(entry?.hasMoreSeller ?? false);
    setHasMoreBuyer(entry?.hasMoreBuyer ?? false);
    nextSellerSkipRef.current = entry?.nextSellerSkip ?? 0;
    nextBuyerSkipRef.current = entry?.nextBuyerSkip ?? 0;
  }, [cacheKey]);

  const doFetch = useCallback(
    async ({
      sellerSkip,
      buyerSkip,
      append,
      requestPolicy,
    }: {
      sellerSkip: number | null; // null = skip this category
      buyerSkip: number | null; // null = skip this category
      append: boolean;
      requestPolicy?:
        | "cache-first"
        | "cache-and-network"
        | "network-only"
        | "cache-only";
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
          const { data, error: gqlError } = await client(chainId)
            .query(
              userInvoicesPageQuery,
              {
                address: address.toLowerCase(),
                first,
                skip: sellerSkip,
                includeOwned: !isIntermediated,
                includePaid: !isIntermediated,
                includeIssued: isIntermediated,
                includeReceived: isIntermediated,
              },
              requestPolicy ? { requestPolicy } : undefined,
            )
            .toPromise();

          if (id !== fetchIdRef.current) return;
          if (gqlError) throw gqlError;

          const raw = data?.user;
          rawSeller = isIntermediated
            ? (raw?.issuedAdvancedInvoices ?? [])
            : (raw?.ownedSimpleInvoices ?? []);
          rawBuyer = isIntermediated
            ? (raw?.receivedAdvancedInvoices ?? [])
            : (raw?.paidSimpleInvoices ?? []);
        } else {
          const [sellerResult, buyerResult] = await Promise.all([
            sellerSkip !== null
              ? client(chainId)
                  .query(
                    userInvoicesPageQuery,
                    {
                      address: address.toLowerCase(),
                      first,
                      skip: sellerSkip,
                      includeOwned: !isIntermediated,
                      includePaid: false,
                      includeIssued: isIntermediated,
                      includeReceived: false,
                    },
                    requestPolicy ? { requestPolicy } : undefined,
                  )
                  .toPromise()
              : Promise.resolve({ data: null, error: null }),
            buyerSkip !== null
              ? client(chainId)
                  .query(
                    userInvoicesPageQuery,
                    {
                      address: address.toLowerCase(),
                      first,
                      skip: buyerSkip,
                      includeOwned: false,
                      includePaid: !isIntermediated,
                      includeIssued: false,
                      includeReceived: isIntermediated,
                    },
                    requestPolicy ? { requestPolicy } : undefined,
                  )
                  .toPromise()
              : Promise.resolve({ data: null, error: null }),
          ]);

          if (id !== fetchIdRef.current) return;
          if (sellerResult.error) throw sellerResult.error;
          if (buyerResult.error) throw buyerResult.error;

          rawSeller =
            sellerSkip !== null
              ? isIntermediated
                ? (sellerResult.data?.user?.issuedAdvancedInvoices ?? [])
                : (sellerResult.data?.user?.ownedSimpleInvoices ?? [])
              : [];
          rawBuyer =
            buyerSkip !== null
              ? isIntermediated
                ? (buyerResult.data?.user?.receivedAdvancedInvoices ?? [])
                : (buyerResult.data?.user?.paidSimpleInvoices ?? [])
              : [];
        }

        const hasMoreSel =
          sellerSkip !== null && rawSeller.length > INVOICE_FETCH_SIZE;
        const hasMoreBuy =
          buyerSkip !== null && rawBuyer.length > INVOICE_FETCH_SIZE;

        const newSeller: Invoice[] = rawSeller
          .slice(0, INVOICE_FETCH_SIZE)
          .map((inv) =>
            isIntermediated
              ? transformIntermediated(inv, "IssuedInvoice")
              : transformSimple(inv, "Seller"),
          );

        const newBuyer: Invoice[] = rawBuyer
          .slice(0, INVOICE_FETCH_SIZE)
          .map((inv) =>
            isIntermediated
              ? transformIntermediated(inv, "ReceivedInvoice")
              : transformSimple(inv, "Buyer"),
          );

        const key = pageCacheKey(chainId, address, isIntermediated);
        const entry: CachedPages = pageCache.get(key) ?? {
          seller: [],
          buyer: [],
          hasMoreSeller: false,
          hasMoreBuyer: false,
          nextSellerSkip: 0,
          nextBuyerSkip: 0,
        };

        if (sellerSkip !== null) {
          entry.seller = append ? [...entry.seller, ...newSeller] : newSeller;
          entry.hasMoreSeller = hasMoreSel;
          entry.nextSellerSkip = sellerSkip + INVOICE_FETCH_SIZE;
          setHasMoreSeller(hasMoreSel);
          setSellerInvoices(entry.seller);
          nextSellerSkipRef.current = entry.nextSellerSkip;
        }

        if (buyerSkip !== null) {
          entry.buyer = append ? [...entry.buyer, ...newBuyer] : newBuyer;
          entry.hasMoreBuyer = hasMoreBuy;
          entry.nextBuyerSkip = buyerSkip + INVOICE_FETCH_SIZE;
          setHasMoreBuyer(hasMoreBuy);
          setBuyerInvoices(entry.buyer);
          nextBuyerSkipRef.current = entry.nextBuyerSkip;
        }

        pageCache.set(key, entry);
      } catch (err) {
        if (id !== fetchIdRef.current) return;
        console.error("[usePagedInvoiceQuery] Error:", err);
        setError("Failed to load invoices. Please try again.");
      } finally {
        if (id === fetchIdRef.current) setIsLoading(false);
      }
    },
    [address, chainId, isIntermediated, enabled],
  );

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

    if (!isWindowVisible) return;

    nextSellerSkipRef.current = 0;
    nextBuyerSkipRef.current = 0;
    // cache-first on purpose: the endpoint rate-limits.
    void doFetch({ sellerSkip: 0, buyerSkip: 0, append: false });
  }, [doFetch, enabled, isWindowVisible]);

  const refetch = useCallback(() => {
    if (!enabled) return;
    nextSellerSkipRef.current = 0;
    nextBuyerSkipRef.current = 0;
    void doFetch({
      sellerSkip: 0,
      buyerSkip: 0,
      append: false,
      requestPolicy: "network-only",
    });
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

const toSortableMs = (t: string): number => {
  const n = Number(t);
  if (!isNaN(n) && n > 0) return n * 1000;
  return Date.parse(t) || 0;
};

export function sortByLastAction(invoices: Invoice[]): Invoice[] {
  return [...invoices].sort((a, b) => {
    const tA = getLastActionTime(a);
    const tB = getLastActionTime(b);
    if (!tA && !tB) return 0;
    if (!tA) return 1;
    if (!tB) return -1;
    return toSortableMs(tB) - toSortableMs(tA);
  });
}
