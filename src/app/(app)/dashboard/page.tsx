import { Suspense } from "react";
import DashboardIndex from "@/components/action-components/dashboard/DashboardIndex";

export default function DashboardPage() {
  return (
    <main>
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
        <DashboardIndex isIntermediatedTab={false} />
      </Suspense>
    </main>
  );
}
