import AdminInvoices from "@/components/action-components/admin/AdminInvoices";
import Container from "@/components/Container";
import ProtectedPage from "@/components/ProtectedPage";
export const dynamic = "force-dynamic";

export default function Invoices() {
  return (
    <ProtectedPage>
      <main>
        <Container>
          <AdminInvoices />
        </Container>
      </main>
    </ProtectedPage>
  );
}
