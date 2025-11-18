import { Suspense } from "react";
import DashboardIndex from "@/components/action-components/dashboard/DashboardIndex";
export const revalidate = 0;

export default function DashboardPage() {
  return (
    <main>
      <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
        <DashboardIndex isMarketplaceTab={false} />
      </Suspense>
    </main>
  );
}
