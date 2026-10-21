import PayContent from "@/components/action-components/pay-page/PayContent";
import { Suspense } from "react";

export default function Pay() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-100" />}>
      <PayContent />
    </Suspense>
  );
}
