"use client";

import { useEffect, useState } from "react";
import { useGetOwner } from "./useGetOwner";

const useWalletRestriction = () => {
  const { data } = useGetOwner();
  const [isAllowed, setIsAllowed] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  // const router = useRouter();

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
          } else {
            setIsAllowed(false);
          }
        } else {
          setWalletConnected(false);
          setIsAllowed(false);
        }
      } catch (error) {
        console.error("Error fetching wallet address:", error);
      }
    } else {
      console.error("Ethereum wallet not detected");
    }
  };

  useEffect(() => {
    const safeCheck = async () => {
      try {
        await checkWallet();
      } catch (err) {
        console.error("Wallet check failed:", err);
      }
    };

    safeCheck();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", safeCheck);

      return () => {
        window.ethereum.removeListener("accountsChanged", safeCheck);
      };
    }
  }, [data]);
  return { isAllowed, walletConnected };
};

export default useWalletRestriction;
