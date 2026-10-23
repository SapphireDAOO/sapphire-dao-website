import { BaseError, UserRejectedRequestError } from "viem";

export const WALLET_CANCELLED = "Cancelled in your wallet.";

/** True when the user turned the request down in their wallet. */
export const isUserRejection = (error: unknown): boolean => {
  if (error instanceof BaseError) {
    return Boolean(
      error.walk(
        (cause) =>
          cause instanceof UserRejectedRequestError ||
          (cause as { code?: unknown }).code === 4001,
      ),
    );
  }
  // Some wallets throw plain EIP-1193 errors rather than viem's.
  const raw = error as { code?: unknown; message?: unknown } | undefined;
  return (
    raw?.code === 4001 ||
    raw?.code === "ACTION_REJECTED" ||
    /user (rejected|denied)/i.test(String(raw?.message ?? ""))
  );
};
