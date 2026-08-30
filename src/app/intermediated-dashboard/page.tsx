import { Suspense } from "react";
import DashboardIndex from "@/components/action-components/dashboard/DashboardIndex";
export const dynamic = "force-dynamic";

export default function IntermediatedDashboardPage() {
  return (
    <main>
      <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
        <DashboardIndex isIntermediatedTab={true} />
      </Suspense>
    </main>
  );
}
