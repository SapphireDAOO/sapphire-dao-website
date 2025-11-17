import AdminInvoices from "@/components/action-components/admin/admin-invoices";
import Container from "@/components/Container";
export const dynamic = "force-dynamic";

export default function Invoices() {
  return (
    <main>
      <Container>
        <AdminInvoices />
      </Container>
    </main>
  );
}
