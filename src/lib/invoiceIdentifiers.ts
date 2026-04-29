export const toInvoiceIdString = (value: unknown): string | undefined => {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.trunc(value).toString() : undefined;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

export const toInvoiceIdBigInt = (value: unknown): bigint | undefined => {
  const id = toInvoiceIdString(value);
  if (!id) return undefined;

  try {
    return BigInt(id);
  } catch {
    return undefined;
  }
};

export const getContractInvoiceIdString = (invoice: {
  id?: unknown;
  invoiceId?: unknown;
}): string => {
  return toInvoiceIdString(invoice.id) ?? toInvoiceIdString(invoice.invoiceId) ?? "";
};

export const getContractInvoiceIdBigInt = (invoice: {
  id?: unknown;
  invoiceId?: unknown;
}): bigint => {
  return toInvoiceIdBigInt(getContractInvoiceIdString(invoice)) ?? BigInt(0);
};

export const getDisplayInvoiceIdString = (invoice: {
  invoiceNonce?: unknown;
  invoiceId?: unknown;
  id?: unknown;
}): string => {
  return (
    toInvoiceIdString(invoice.invoiceNonce) ??
    toInvoiceIdString(invoice.invoiceId) ??
    toInvoiceIdString(invoice.id) ??
    ""
  );
};

export const getInvoiceMergeKey = (invoice: {
  invoiceId?: unknown;
  type?: unknown;
  source?: unknown;
}): string => {
  const invoiceId = toInvoiceIdString(invoice.invoiceId) ?? "";
  const type = typeof invoice.type === "string" ? invoice.type : "";
  const source = typeof invoice.source === "string" ? invoice.source : "";

  return `${invoiceId}-${type}-${source}`;
};

export const matchesInvoiceIdentity = (
  invoice: { invoiceId?: unknown; source?: unknown },
  invoiceId: unknown,
  source: string,
): boolean => {
  return (
    toInvoiceIdString(invoice.invoiceId) === toInvoiceIdString(invoiceId) &&
    invoice.source === source
  );
};
