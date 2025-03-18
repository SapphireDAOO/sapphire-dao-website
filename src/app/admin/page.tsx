import AdminCard from "@/components/action-components/admin/admin-card";
import Container from "@/components/Container";
import useWalletRestriction from "@/hooks/useWalletRestriction";

export default function Admin() {
  const isAllowed = useWalletRestriction();

  if (!isAllowed) {
    return (
      <main>
        <Container>
          <div className="text-center mt-10">
            <h1 className="text-xl font-semibold text-red-500">
              Access Denied
            </h1>
            <p className="text-gray-600 mt-2">
              Your wallet is not authorized to view this page.
            </p>
          </div>
        </Container>
      </main>
    );
  }

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
