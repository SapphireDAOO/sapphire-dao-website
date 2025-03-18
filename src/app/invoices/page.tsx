import InvoicePage from "@/components/action-components/admin/invoice-list";
import Container from "@/components/Container";
import ProtectedPage from "@/components/ProtectedPage";

export default function Invoices() {
  return (
    <ProtectedPage>
      <main>
        <Container>
          <InvoicePage />
        </Container>
      </main>
    </ProtectedPage>
  );
}
