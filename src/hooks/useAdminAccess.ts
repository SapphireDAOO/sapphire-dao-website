"use client";

import { useEffect, useMemo, useState } from "react";
import { type Address } from "viem";
import { useAccount, useChainId } from "wagmi";
import { BASE_SEPOLIA } from "@/constants";
import { readAdminAccess, writeAdminAccess } from "@/lib/adminAccessCache";
import { useGetOwner } from "./useGetOwner";
import { useGetEmergencyPauser } from "./useGetEmergencyPauser";
import { useIsSigner } from "./useIsSigner";

export const useAdminAccess = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const { data: ownerAddress, isLoading: isOwnerLoading } = useGetOwner();
  const { data: isSigner, isLoading: isSignerLoading } = useIsSigner(
    address as Address | undefined,
  );
  const { data: emergencyPauser, isLoading: isPauserLoading } =
    useGetEmergencyPauser();

  const isOwner = useMemo(() => {
    if (!address || !ownerAddress) return false;
    return address.toLowerCase() === ownerAddress.toLowerCase();
  }, [address, ownerAddress]);

  const isEmergencyPauser = useMemo(() => {
    if (!address || !emergencyPauser) return false;
    return address.toLowerCase() === emergencyPauser.toLowerCase();
  }, [address, emergencyPauser]);

  const isLoading =
    isConnected && (isOwnerLoading || isSignerLoading || isPauserLoading);
  const resolved = isConnected && !isLoading;
  const liveAllowed = isOwner || Boolean(isSigner);

  // Falls back to the last resolved answer until the RPC
  // reads land, so the Admin entry doesn't pop in late.
  const [remembered, setRemembered] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setRemembered(readAdminAccess(chainId, address));
  }, [chainId, address]);

  const isAllowed = resolved
    ? liveAllowed
    : isConnected && (remembered ?? false);

  useEffect(() => {
    if (resolved) writeAdminAccess(chainId, address, liveAllowed);
  }, [resolved, chainId, address, liveAllowed]);

  return {
    address,
    walletConnected: isConnected,
    isAllowed,
    isOwner,
    isSigner: Boolean(isSigner),
    isEmergencyPauser,
    canAccessGovernance: isAllowed || isEmergencyPauser,
    isLoading,
  };
};
