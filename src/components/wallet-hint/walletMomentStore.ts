"use client";

import { useSyncExternalStore } from "react";
import type { HintMoment } from "./walletHints";

// Wallet interactions made through viem's wallet client
// directly, which wagmi's mutation cache can't see.

const listeners = new Set<() => void>();

const active: HintMoment[] = [];
let snapshot: HintMoment | undefined;

// A token approval also announces
// sendingTransaction; the specific hint should win.
const OUTRANKS_NESTED: HintMoment[] = ["approvingToken"];

const currentMoment = () =>
  active.find((moment) => OUTRANKS_NESTED.includes(moment)) ?? active.at(-1);

const emit = () => {
  const next = currentMoment();
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
};

/** Returns the function that ends the moment; call it in a `finally`. */
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

export const useWalletMoment = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
