import OwnerControls from "@/components/action-components/admin/OwnerControls";
import Container from "@/components/Container";
import ProtectedPage from "@/components/ProtectedPage";

export default function Controls() {
  return (
    <ProtectedPage>
      <main>
        <Container>
          <div className="py-8 space-y-6 max-w-4xl mx-auto">
            <OwnerControls />
          </div>
        </Container>
      </main>
    </ProtectedPage>
  );
}
