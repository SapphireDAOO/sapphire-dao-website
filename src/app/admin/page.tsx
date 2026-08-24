import AdminCard from "@/components/action-components/admin/AdminCard";
import FeesCollected from "@/components/action-components/admin/FeesCollected";
import Container from "@/components/Container";
import ProtectedPage from "@/components/ProtectedPage";

export default function Admin() {
  return (
    <ProtectedPage>
      <main>
        <Container>
          <div className="py-8 space-y-6 max-w-4xl mx-auto">
            <AdminCard />
            <FeesCollected />
          </div>
        </Container>
      </main>
    </ProtectedPage>
  );
}
