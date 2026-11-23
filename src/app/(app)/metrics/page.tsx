import { Suspense } from "react";
import MetricsIndex from "@/components/action-components/metrics/MetricsIndex";


export default function MetricsPage() {
  return (
    <main>
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
        <MetricsIndex />
      </Suspense>
    </main>
  );
}
