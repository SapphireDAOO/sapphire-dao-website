"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PLATFORMS,
  WALLET_GUIDES,
  detectPlatform,
  hasInjectedWallet,
  metaMaskDeepLink,
  type GuideStep,
  type Platform,
} from "./walletGuides";

type Stage = "install" | "connect" | "balance";

const STAGES: { id: Stage; title: string }[] = [
  { id: "install", title: "Install a wallet" },
  { id: "connect", title: "Connect it" },
  { id: "balance", title: "Check your balance" },
];

const STEP_LETTERS = "abcde";

const actionClass =
  "mt-1 inline-flex items-center gap-1 font-medium text-blue-900 underline underline-offset-4 hover:text-blue-950";

const GuideAction = ({
  step,
  platform,
  onConnect,
}: {
  step: GuideStep;
  platform: Platform;
  onConnect: () => void;
}) => {
  const guide = WALLET_GUIDES[platform];
  switch (step.action) {
    case "store":
      return (
        <a
          href={guide.store.href}
          target="_blank"
          rel="noopener noreferrer"
          className={actionClass}
        >
          {guide.store.label}
        </a>
      );
    case "openInWallet":
      return (
        <a href={metaMaskDeepLink()} className={actionClass}>
          Open in MetaMask
        </a>
      );
    case "reload":
      return (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={actionClass}
        >
          Reload
        </button>
      );
    case "connect":
      return (
        <button type="button" onClick={onConnect} className={actionClass}>
          Connect wallet
        </button>
      );
    default:
      return null;
  }
};

const InstallGuide = ({ onConnect }: { onConnect: () => void }) => {
  const [platform, setPlatform] = useState<Platform>("other");
  useEffect(() => setPlatform(detectPlatform()), []);
  const guide = WALLET_GUIDES[platform];

  return (
    <div className="mb-4 space-y-3 rounded-xl bg-white/70 p-3 sm:p-4">
      <p>
        Suggested wallet:{" "}
        <span className="font-medium text-stone-900">{guide.wallet}</span>
      </p>
      <label className="block">
        <span className="text-stone-400">Steps for </span>
        <select
          value={platform}
          onChange={(event) => setPlatform(event.target.value as Platform)}
          className="cursor-pointer border-b border-stone-400 bg-transparent font-medium text-stone-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-900"
        >
          {PLATFORMS.map((option) => (
            <option key={option} value={option}>
              {WALLET_GUIDES[option].label}
            </option>
          ))}
        </select>
      </label>
      <ol className="space-y-2.5">
        {guide.steps.map((step, index) => (
          <li key={step.text} className="flex gap-2">
            <span className="w-5 shrink-0 font-mono text-[10px] leading-5 text-stone-400 sm:text-xs">
              1{STEP_LETTERS[index]}
            </span>
            <div className="min-w-0">
              <p>{step.text}</p>
              <GuideAction
                step={step}
                platform={platform}
                onConnect={onConnect}
              />
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
};

/**
 * Step 1's progression: install a wallet if this browser has none,
 * connect it, then wait while its balance is read.
 */
const WalletSetup = ({
  connected,
  wrongNetwork,
  networkName,
  isSwitching,
  onConnect,
  onSwitchNetwork,
}: {
  connected: boolean;
  wrongNetwork: boolean;
  networkName: string;
  isSwitching: boolean;
  onConnect: () => void;
  onSwitchNetwork: () => void;
}) => {
  const [injected, setInjected] = useState(false);
  useEffect(() => setInjected(hasInjectedWallet()), []);

  const stage: Stage =
    connected && !wrongNetwork
      ? "balance"
      : connected || injected
        ? "connect"
        : "install";
  const current = STAGES.findIndex(({ id }) => id === stage);

  return (
    <ol className="space-y-1 border-t border-stone-300 pt-4">
      {STAGES.map(({ id, title }, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={id}>
            <div className="flex gap-2.5 sm:gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold sm:h-5 sm:w-5 sm:text-[10px]",
                  done && "bg-stone-800 text-white",
                  active && "bg-blue-900 text-white",
                  !done && !active && "border border-stone-300 text-stone-400",
                )}
              >
                {done ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  index + 1
                )}
              </span>
              <div
                className={cn(
                  "min-w-0 flex-1 pb-3",
                  !active && "text-stone-400",
                )}
              >
                <p
                  className={cn(
                    "font-medium",
                    active
                      ? "text-stone-900"
                      : done &&
                          "text-stone-500 line-through decoration-stone-300",
                  )}
                >
                  {title}
                </p>
                {active && id === "connect" && (
                  <p className="mt-1">
                    {wrongNetwork ? (
                      <>
                        Your wallet is on another network.{" "}
                        {/* Stays enabled: a phone can lose the request, and a tap resends it. */}
                        <button
                          type="button"
                          onClick={onSwitchNetwork}
                          className={actionClass}
                        >
                          {isSwitching && (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          )}
                          Switch to {networkName}
                        </button>
                      </>
                    ) : (
                      "We found a wallet in this browser. Tap Connect wallet, then approve the request in your wallet."
                    )}
                  </p>
                )}
                {active && id === "balance" && (
                  <p className="mt-1 flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Reading your balance…
                  </p>
                )}
              </div>
            </div>
            {active && id === "install" && (
              <InstallGuide onConnect={onConnect} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default WalletSetup;
