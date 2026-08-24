"use client";

import { useSyncExternalStore } from "react";
import type { HintMoment } from "./walletHints";

/**
 * Tracks wallet interactions that this app drives through viem's wallet client
 * directly rather than through a wagmi hook.
 *
 * wagmi actions are react-query mutations, so they are observable from
 * anywhere; a bare `walletClient.sendTransaction(...)` is not, even though it
 * opens exactly the same wallet popup. This store is what makes those visible.
 * It lives outside React so plain service modules can announce into it.
 */

const listeners = new Set<() => void>();

// A stack, not a flag: one interaction can begin before another ends, and the
// most recent one is what the wallet is actually showing.
const active: HintMoment[] = [];
let snapshot: HintMoment | undefined;

const emit = () => {
  const next = active.at(-1);
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
};

/**
 * Marks a wallet interaction as pending. Returns the function that ends it —
 * call it in a `finally`, or the hint stays on screen forever.
 */
export const beginWalletMoment = (moment: HintMoment) => {
  active.push(moment);
  emit();

  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const index = active.lastIndexOf(moment);
    if (index !== -1) active.splice(index, 1);
    emit();
  };
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;
const getServerSnapshot = () => undefined;

/** The wallet interaction currently awaiting the user, if any. */
export const useWalletMoment = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
