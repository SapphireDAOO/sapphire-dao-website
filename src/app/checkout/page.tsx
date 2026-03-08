import CheckoutContent from "@/components/action-components/checkout/CheckoutContent";
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
