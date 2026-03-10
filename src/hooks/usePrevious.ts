import { useEffect, useRef } from "react";

/**
 * Returns the value from the previous render.
 * Useful for detecting address/chain changes without triggering extra effects.
 * Pattern from the Uniswap interface.
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}
