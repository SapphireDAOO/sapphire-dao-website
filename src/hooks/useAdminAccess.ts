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

  // The pauser is neither an owner nor a signer. Pausing lives on the
  // governance page, so they are let into that page alone rather than into
  // everything behind the Admin menu.
  const isEmergencyPauser = useMemo(() => {
    if (!address || !emergencyPauser) return false;
    return address.toLowerCase() === emergencyPauser.toLowerCase();
  }, [address, emergencyPauser]);

  const isLoading =
    isConnected && (isOwnerLoading || isSignerLoading || isPauserLoading);
  const resolved = isConnected && !isLoading;
  const liveAllowed = isOwner || Boolean(isSigner);

  // Each of these checks is an RPC read, so on a fresh load the honest answer is "not
  // known yet". Rendering that as "not an admin" is what makes the Admin entry
  // appear a beat after the rest of the nav, so fall back to whatever this
  // address resolved to last time until the reads land.
  //
  // Read in an effect rather than during render: reading storage while
  // rendering would make the first client render disagree with the server
  // markup. See useHintsDismissed for the same hazard.
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
    /** Governance is open to the pauser as well as to owners and signers. */
    canAccessGovernance: isAllowed || isEmergencyPauser,
    isLoading,
  };
};
