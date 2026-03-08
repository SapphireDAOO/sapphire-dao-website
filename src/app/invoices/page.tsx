import AdminInvoices from "@/components/action-components/admin/AdminInvoices";
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
