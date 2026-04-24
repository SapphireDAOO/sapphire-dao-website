"use client";

import { useMemo } from "react";
import { type Address } from "viem";
import { useAccount } from "wagmi";
import { useGetOwner } from "./useGetOwner";
import { useIsSigner } from "./useIsSigner";

export const useAdminAccess = () => {
  const { address, isConnected } = useAccount();
  const { data: ownerAddress, isLoading: isOwnerLoading } = useGetOwner();
  const { data: isSigner, isLoading: isSignerLoading } = useIsSigner(
    address as Address | undefined,
  );

  const isOwner = useMemo(() => {
    if (!address || !ownerAddress) return false;
    return address.toLowerCase() === ownerAddress.toLowerCase();
  }, [address, ownerAddress]);

  const isAllowed = isOwner || Boolean(isSigner);
  const isLoading = isConnected && (isOwnerLoading || isSignerLoading);

  return {
    address,
    walletConnected: isConnected,
    isAllowed,
    isOwner,
    isSigner: Boolean(isSigner),
    isLoading,
  };
};
