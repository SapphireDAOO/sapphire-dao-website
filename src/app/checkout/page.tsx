import CheckoutContent from "@/components/action-components/checkout/checkout-content";
import { Suspense } from "react";

export default function Checkout() {
  return (
    <main>
      <Suspense fallback={<div>Loading...</div>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}
