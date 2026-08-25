import { useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import type { Address } from "viem";
import { BASE_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";

// An emergency control should not sit on stale data, so the live state is
// polled rather than only refetched after our own writes — someone else may
// have paused or unpaused from elsewhere.
const PAUSE_STATE_POLL_MS = 15_000;

/**
 * Reads the emergency pause state from PaymentProcessorStorage: whether the
 * protocol is paused, who is allowed to trigger an emergency pause, when the
 * current pause lapses, and how long a fresh one lasts.
 */
export const useEmergencyPause = () => {
  const { address } = useAccount();
  const chainId = useChainId() || BASE_SEPOLIA;
  const address_ = PAYMENT_PROCESSOR_STORAGE[chainId];
  const shared = {
    abi: PaymentProcessorStorage,
    chainId,
    address: address_,
    account: address,
  };

  const { data: isPaused, refetch: refetchIsPaused } =
    useViemReadContract<boolean>({
      ...shared,
      functionName: "isPaused",
      refetchInterval: PAUSE_STATE_POLL_MS,
    });

  const { data: pauseExpiry, refetch: refetchPauseExpiry } =
    useViemReadContract<bigint>({
      ...shared,
      functionName: "getEmergencyPauseExpiry",
      refetchInterval: PAUSE_STATE_POLL_MS,
    });

  const { data: emergencyPauser } = useViemReadContract<Address>({
    ...shared,
    functionName: "getEmergencyPauser",
  });

  const { data: pauseDuration } = useViemReadContract<bigint>({
    ...shared,
    functionName: "EMERGENCY_PAUSE_DURATION",
  });

  const canPause = Boolean(
    address &&
      emergencyPauser &&
      address.toLowerCase() === emergencyPauser.toLowerCase(),
  );

  const refetch = useCallback(async () => {
    await Promise.all([refetchIsPaused(), refetchPauseExpiry()]);
  }, [refetchIsPaused, refetchPauseExpiry]);

  return {
    isPaused,
    pauseExpiry,
    emergencyPauser,
    pauseDuration,
    /** True when the connected wallet is the designated emergency pauser. */
    canPause,
    refetch,
  };
};
