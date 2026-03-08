"use client";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Container from "@/components/Container";
import PaymentCard from "@/components/action-components/pay-page/PaymentCard";

const PayContent = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("data");

  const [decryptedData, setDecryptedData] = useState<{ orderId: string } | null>(null);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/verify-token?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((result: { valid?: boolean; data?: { orderId?: string } }) => {
        const orderId = result.data?.orderId;
        if (result.valid && orderId) {
          setDecryptedData({ orderId });
        }
      })
      .catch(console.error);
  }, [token]);

  return (
    <Container>
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <PaymentCard data={decryptedData} />
      </div>
    </Container>
  );
};

export default PayContent;
