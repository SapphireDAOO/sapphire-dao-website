"use client";
import { useSearchParams } from "next/navigation";
import Container from "@/components/Container";
import PaymentCard from "@/components/action-components/pay-page/payment-card";
import CryptoJS from "crypto-js";

const PayContent = () => {
  const searchParams = useSearchParams();
  const params = searchParams.get("data");

  let decryptedData = null;
  if (params) {
    try {
      const decodedData = decodeURIComponent(params);
      const bytes = CryptoJS.AES.decrypt(
        decodedData,
        process.env.NEXT_PUBLIC_SECRET_KEY!
      );
      decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      console.error("Decryption failed", error);
    }
  }

  return (
    <Container>
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <PaymentCard data={decryptedData} />
      </div>
    </Container>
  );
};

export default PayContent;
