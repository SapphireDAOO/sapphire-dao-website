import AdminCard from "@/components/action-components/admin/AdminCard";
import EmergencyPause from "@/components/action-components/admin/EmergencyPause";
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
            <EmergencyPause />
            <FeesCollected />
          </div>
        </Container>
      </main>
    </ProtectedPage>
  );
}
