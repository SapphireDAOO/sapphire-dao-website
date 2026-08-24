"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutationState } from "@tanstack/react-query";
import { useAccount, useConfig } from "wagmi";
import { X } from "lucide-react";
import { fillNetwork, getWalletHint, type HintMoment } from "./walletHints";
import { useHintsDismissed } from "./useHintsDismissed";
import { useWalletMoment } from "./walletMomentStore";

/**
 * Wallet popups are browser-extension windows, so they live outside this page's
 * DOM: nothing we render can point at one directly, and first-time users
 * routinely miss them and sit on a spinner until it times out. This renders an
 * on-page hint for as long as a wallet interaction is pending.
 */

// RainbowKit's modal renders at 2147483646, so anything lower is hidden behind
// it. Sit one above.
const Z_INDEX = 2147483647;

// An unlocked, already-authorised wallet responds near-instantly. Waiting
// before showing a hint keeps it from flashing on those.
const PENDING_DELAY_MS = 600;

// The wrong-network hint is a steady state rather than a spinner, so it waits
// longer — the user may already be reaching for the network switcher.
const WRONG_NETWORK_DELAY_MS = 2000;

/** wagmi mutation keys, mapped to the moment each one represents. */
const MOMENT_BY_MUTATION_KEY: Record<string, HintMoment> = {
  connect: "connecting",
  signMessage: "signing",
  signTypedData: "signing",
  sendTransaction: "sendingTransaction",
  writeContract: "sendingTransaction",
  switchChain: "switchingChain",
};

// Checked in order, so the most immediate interaction wins when more than one
// is in flight.
const PRIORITY: HintMoment[] = [
  "connecting",
  "signing",
  "sendingTransaction",
  "switchingChain",
];

type PendingConnector = { id?: string; name?: string } | undefined;

const WalletHint = () => {
  const { isConnected, chain } = useAccount();
  // Interactions driven straight through the wallet client, which register no
  // wagmi mutation. See walletMomentStore.
  const directMoment = useWalletMoment();
  const config = useConfig();
  const { dismissed, ready, dismissForever } = useHintsDismissed();
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // wagmi actions are react-query mutations with stable keys, so every pending
  // wallet interaction is readable from here without owning the call sites.
  const pending = useMutationState({
    filters: { status: "pending" },
    select: (mutation) => ({
      key: mutation.options.mutationKey?.[0],
      connector: (mutation.state.variables as { connector?: PendingConnector })
        ?.connector,
    }),
  });

  // `chain` is undefined while connected to a chain outside the configured
  // list — see getAccount() in @wagmi/core.
  const onWrongNetwork = isConnected && !chain;

  const { moment, connector } = useMemo(() => {
    // A direct call is already open in the wallet, so it outranks anything the
    // mutation cache reports.
    if (directMoment) return { moment: directMoment, connector: undefined };

    const active = pending
      .map((entry) => ({
        moment:
          typeof entry.key === "string"
            ? MOMENT_BY_MUTATION_KEY[entry.key]
            : undefined,
        connector: entry.connector,
      }))
      .filter(
        (entry): entry is { moment: HintMoment; connector: PendingConnector } =>
          Boolean(entry.moment),
      );

    for (const candidate of PRIORITY) {
      const match = active.find((entry) => entry.moment === candidate);
      if (match) return match;
    }
    return {
      moment: onWrongNetwork ? ("wrongNetwork" as HintMoment) : undefined,
      connector: undefined,
    };
  }, [pending, onWrongNetwork, directMoment]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!moment) {
      setVisible(false);
      // Reset the manual close so the next interaction gets its own hint.
      setClosed(false);
      return;
    }
    const delay =
      moment === "wrongNetwork" ? WRONG_NETWORK_DELAY_MS : PENDING_DELAY_MS;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [moment]);

  if (!mounted || !ready || dismissed || !visible || closed || !moment) {
    return null;
  }

  const network = config.chains[0]?.name ?? "the supported network";
  const hint = getWalletHint(moment, connector);

  return createPortal(
    // The wrapper spans the viewport but ignores pointer events, so anything
    // underneath stays clickable — the user must still be able to hit Cancel in
    // the RainbowKit modal.
    <div
      className="pointer-events-none fixed inset-0 flex items-start justify-center p-4 sm:p-8"
      style={{ zIndex: Z_INDEX }}
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto relative mt-10 w-full max-w-sm rounded-xl border border-white/15 bg-neutral-950 p-5 text-center shadow-2xl"
      >
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Dismiss wallet instructions"
          className="absolute right-3 top-3 rounded-md p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-base font-semibold text-white">{hint.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          {fillNetwork(hint.body, network)}
        </p>

        {hint.image && (
          // Served from public/ as a plain asset: next/image adds nothing for a
          // fixed-size screenshot, and its optimiser has no server to run on in
          // the exported build.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hint.image}
            alt={hint.alt ?? ""}
            width={320}
            height={420}
            loading="lazy"
            className="mx-auto mt-4 w-full max-w-[240px] rounded-lg border border-white/10"
          />
        )}

        {hint.note && (
          <p className="mt-4 text-xs leading-relaxed text-white/45">
            {fillNetwork(hint.note, network)}
          </p>
        )}

        <button
          type="button"
          onClick={dismissForever}
          className="mt-4 text-xs text-white/40 underline underline-offset-2 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          Don&apos;t show these tips again
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default WalletHint;
