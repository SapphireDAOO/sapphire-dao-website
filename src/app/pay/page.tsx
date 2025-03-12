import PayContent from "@/components/action-components/pay-page/pay-content";
import { Suspense } from "react";

export default function Pay() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <PayContent />
      </Suspense>
    </main>
  );
}
