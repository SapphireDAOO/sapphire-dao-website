"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMutationState } from "@tanstack/react-query";
import { useConnection, useConfig } from "wagmi";
import { X } from "lucide-react";
import { fillNetwork, getWalletHint, type HintMoment } from "./walletHints";
import { useHintsDismissed } from "./useHintsDismissed";
import { useWalletMoment } from "./walletMomentStore";

// Above the wallet picker dialog.
const Z_INDEX = 2147483647;

const hasMetaMaskExtension = () =>
  Boolean(
    (window as { ethereum?: { isMetaMask?: boolean } }).ethereum?.isMetaMask,
  );

// These show their own QR code, app prompt or Open button while connecting.
const bringsOwnPrompt = (connector: PendingConnector) =>
  connector?.type === "walletConnect" ||
  (connector?.id === "metaMaskSDK" && !hasMetaMaskExtension());

const PENDING_DELAY_MS = 600;

const WRONG_NETWORK_DELAY_MS = 2000;

const MOMENT_BY_MUTATION_KEY: Record<string, HintMoment> = {
  connect: "connecting",
  signMessage: "signing",
  signTypedData: "signing",
  sendTransaction: "sendingTransaction",
  writeContract: "sendingTransaction",
  switchChain: "switchingChain",
};

const PRIORITY: HintMoment[] = [
  "connecting",
  "signing",
  "sendingTransaction",
  "switchingChain",
];

type PendingConnector =
  | { id?: string; name?: string; type?: string }
  | undefined;

const WalletHint = () => {
  const { isConnected, chain } = useConnection();
  // Calls made straight through the wallet client
  // register no wagmi mutation; see walletMomentStore.
  const directMoment = useWalletMoment();
  const config = useConfig();
  const { dismissed, ready, dismissForever } = useHintsDismissed();
  const [visible, setVisible] = useState(false);
  const [closed, setClosed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const pending = useMutationState({
    filters: { status: "pending" },
    select: (mutation) => ({
      key: mutation.options.mutationKey?.[0],
      connector: (mutation.state.variables as { connector?: PendingConnector })
        ?.connector,
    }),
  });

  // `chain` is undefined on a network outside the configured list.
  const onWrongNetwork = isConnected && !chain;

  const { moment, connector } = useMemo(() => {
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
      setClosed(false);
      return;
    }
    const delay =
      moment === "wrongNetwork" ? WRONG_NETWORK_DELAY_MS : PENDING_DELAY_MS;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [moment]);

  if (
    !mounted ||
    !ready ||
    dismissed ||
    !visible ||
    closed ||
    !moment ||
    (moment === "connecting" && bringsOwnPrompt(connector))
  ) {
    return null;
  }

  const network = config.chains[0]?.name ?? "the supported network";
  const hint = getWalletHint(moment, connector);

  return createPortal(
    // Ignores pointer events so the RainbowKit modal's Cancel stays clickable.
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
