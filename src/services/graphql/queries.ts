// Barrel re-export — import from the specific query files for new code,
// or continue importing from "@/services/graphql/queries" for backwards compatibility.

export {
  userInvoicesPageQuery,
  invoiceQuery,
  paymentTokenQuery,
  invoiceOwnerQuery,
  smartInvoiceQuery,
  metaInvoiceQuery,
} from "./userQueries";

export { GET_ALL_INVOICES } from "./adminQueries";

export { NOTES_BY_ORDER_QUERY } from "./notesQueries";
