import AdminInvoices from "@/components/action-components/admin/admin-invoices";
import Container from "@/components/Container";
import ProtectedPage from "@/components/ProtectedPage";

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
