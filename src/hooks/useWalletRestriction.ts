"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGetOwner } from "./useGetOwner";

const useWalletRestriction = () => {
  const { data } = useGetOwner();
  const [isAllowed, setIsAllowed] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkWallet = async () => {
      if (typeof window !== "undefined" && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({
            method: "eth_accounts",
          });

          if (accounts.length > 0) {
            const wal = accounts[0].toLowerCase();
            const dataResult = data?.toLowerCase();
            setWalletConnected(true);

            if (wal === dataResult) {
              setIsAllowed(true);
            }
          } else {
            setWalletConnected(false);
          }
        } catch (error) {
          console.error("Error fetching wallet address:", error);
        }
      } else {
        console.error("Ethereum wallet not detected");
      }
    };

    checkWallet();
  }, [router, data]); // ✅ effect runs again when `data` is ready

  return { isAllowed, walletConnected };
};

export default useWalletRestriction;
