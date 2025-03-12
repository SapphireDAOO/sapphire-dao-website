import AdminCard from "@/components/action-components/admin/admin-card";
import Container from "@/components/Container";

export default function Admin() {
  return (
    <main>
      <Container>
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <AdminCard />
        </div>
      </Container>
    </main>
  );
}
