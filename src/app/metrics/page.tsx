import { Suspense } from "react";
import MetricsIndex from "@/components/action-components/metrics/MetricsIndex";

export const revalidate = 0;

export default function MetricsPage() {
  return (
    <main>
      <Suspense fallback={<div className="p-8 text-gray-500">Loading…</div>}>
        <MetricsIndex />
      </Suspense>
    </main>
  );
}
