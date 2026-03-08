import AdminCard from "@/components/action-components/admin/AdminCard";
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
