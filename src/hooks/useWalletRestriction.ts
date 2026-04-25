"use client";

import { useAdminAccess } from "./useAdminAccess";

const useWalletRestriction = () => {
  const { isAllowed, walletConnected, isLoading } = useAdminAccess();

  return { isAllowed, walletConnected, isLoading };
};

export default useWalletRestriction;
