import CheckoutContent from "@/components/action-components/checkout/CheckoutContent";
import { Suspense } from "react";

export default function Checkout() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-100" />}>
      <CheckoutContent />
    </Suspense>
  );
}
