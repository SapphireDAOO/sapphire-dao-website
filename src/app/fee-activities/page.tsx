import FeesCollected from "@/components/action-components/admin/FeesCollected";
import Container from "@/components/Container";
import ProtectedPage from "@/components/ProtectedPage";

export default function FeeActivities() {
  return (
    <ProtectedPage>
      <main>
        <Container>
          <div className="py-8 space-y-6 max-w-4xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold">Fee Activities</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Platform fees held across the one-time fee receivers, and the
                sweeps that have moved them out. Sweeping is a multisig
                action, so propose one from the Multisig page.
              </p>
            </div>
            <FeesCollected />
          </div>
        </Container>
      </main>
    </ProtectedPage>
  );
}
