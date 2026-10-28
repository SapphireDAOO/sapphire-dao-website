import { useCallback, useEffect } from "react";
import { useConnection, useChainId } from "wagmi";
import type { Address } from "viem";
import { BASE_SEPOLIA, PAYMENT_PROCESSOR_STORAGE } from "@/constants";
import { PaymentProcessorStorage } from "@/abis/PaymentProcessorStorage";
import { useViemReadContract } from "./useViemReadContract";

// A pause lapses without an event, so the chain is
// re-read after expiry; its clock can trail ours.
const LAPSE_RECHECK_DELAYS_MS = [2_000, 10_000, 30_000];
// setTimeout fires immediately for anything longer than this (~24.8 days).
const MAX_TIMEOUT_MS = 2_147_483_647;
// Changes only by a governance vote; usePauseState refreshes it on the event.
const PAUSER_STALE_TIME_MS = 60 * 60 * 1_000;

export const useEmergencyPause = () => {
  const { address } = useConnection();
  const chainId = useChainId() || BASE_SEPOLIA;
  const address_ = PAYMENT_PROCESSOR_STORAGE[chainId];
  // No `account`: these are global views, and a sender both splits the
  // cache per wallet and stops viem batching the reads into one multicall.
  const shared = {
    abi: PaymentProcessorStorage,
    chainId,
    address: address_,
  };

  const { data: isPaused, refetch: refetchIsPaused } =
    useViemReadContract<boolean>({
      ...shared,
      functionName: "isPaused",
      refetchOnWindowFocus: true,
    });

  const { data: pauseExpiry, refetch: refetchPauseExpiry } =
    useViemReadContract<bigint>({
      ...shared,
      functionName: "getEmergencyPauseExpiry",
      refetchOnWindowFocus: true,
    });

  const { data: emergencyPauser } = useViemReadContract<Address>({
    ...shared,
    functionName: "getEmergencyPauser",
    staleTime: PAUSER_STALE_TIME_MS,
  });

  const { data: pauseDuration } = useViemReadContract<bigint>({
    ...shared,
    functionName: "EMERGENCY_PAUSE_DURATION",
    staleTime: Infinity,
  });

  const canPause = Boolean(
    address &&
    emergencyPauser &&
    address.toLowerCase() === emergencyPauser.toLowerCase(),
  );

  const refetch = useCallback(async () => {
    await Promise.all([refetchIsPaused(), refetchPauseExpiry()]);
  }, [refetchIsPaused, refetchPauseExpiry]);

  useEffect(() => {
    const expiryMs = Number(pauseExpiry ?? 0) * 1000;
    if (!isPaused || !expiryMs) return;

    const recheck = () => {
      void refetchIsPaused({ cancelRefetch: false });
      void refetchPauseExpiry({ cancelRefetch: false });
    };
    const untilExpiry = expiryMs - Date.now();
    const timers = LAPSE_RECHECK_DELAYS_MS.map((delay) => untilExpiry + delay)
      .filter((delay) => delay > 0 && delay <= MAX_TIMEOUT_MS)
      .map((delay) => setTimeout(recheck, delay));

    return () => timers.forEach(clearTimeout);
  }, [isPaused, pauseExpiry, refetchIsPaused, refetchPauseExpiry]);

  return {
    isPaused,
    pauseExpiry,
    emergencyPauser,
    pauseDuration,
    canPause,
    refetch,
  };
};
