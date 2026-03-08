import { Invoice } from "@/model/model";

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

type CachedInvoice = Omit<Invoice, "orderId"> & { orderId: string };
type InvoiceCachePayload = {
  version: number;
  updatedAt: number;
  invoices: CachedInvoice[];
};

export const getInvoiceCacheKey = (
  address?: string,
  chainId?: number,
): string | undefined => {
  if (!address || !chainId) return undefined;
  return `invoice-cache:v${CACHE_VERSION}:${chainId}:${address.toLowerCase()}`;
};

const toCachedInvoice = (invoice: Invoice): CachedInvoice => ({
  ...invoice,
  orderId: invoice.orderId.toString(),
});

const fromCachedInvoice = (cached: CachedInvoice): Invoice | null => {
  try {
    return {
      ...cached,
      orderId: BigInt(cached.orderId),
    };
  } catch {
    return null;
  }
};

export const readInvoiceCache = (key?: string): Invoice[] => {
  if (!key || typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as InvoiceCachePayload;
    if (!parsed || parsed.version !== CACHE_VERSION) return [];
    if (Date.now() - parsed.updatedAt > CACHE_TTL_MS) return [];

    return parsed.invoices
      .map(fromCachedInvoice)
      .filter((invoice): invoice is Invoice => Boolean(invoice));
  } catch {
    return [];
  }
};

export const writeInvoiceCache = (key: string | undefined, invoices: Invoice[]) => {
  if (!key || typeof window === "undefined") return;

  try {
    const payload: InvoiceCachePayload = {
      version: CACHE_VERSION,
      updatedAt: Date.now(),
      invoices: invoices.map(toCachedInvoice),
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};
