import { Suspense } from "react";
import DashboardIndex from "@/components/action-components/dashboard/DashboardIndex";

export default function Dashboard() {
  return (
    <main>
      <Suspense
        fallback={<div className="p-8 text-gray-500">Loading dashboard...</div>}
      >
        <DashboardIndex />
      </Suspense>
    </main>
  );
}
