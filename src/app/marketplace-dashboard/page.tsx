import { Suspense } from "react";
import DashboardIndex from "@/components/action-components/dashboard/DashboardIndex";

export default function MarketplaceDashboardPage() {
  return (
    <main>
      <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
        <DashboardIndex isMarketplaceTab={true} />
      </Suspense>
    </main>
  );
}
