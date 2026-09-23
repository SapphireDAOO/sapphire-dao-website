"use client";

import { useAdminAccess } from "./useAdminAccess";

const useWalletRestriction = () => {
  const { isAllowed, canAccessGovernance, walletConnected, isLoading } =
    useAdminAccess();

  return { isAllowed, canAccessGovernance, walletConnected, isLoading };
};

export default useWalletRestriction;
