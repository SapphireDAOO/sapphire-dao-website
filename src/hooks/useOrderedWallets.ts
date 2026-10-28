import { useEffect, useMemo, useState } from "react";
import { useConfig, useConnectors, type Connector } from "wagmi";
import metaMaskIcon from "@/assets/wallets/metamask.svg";
import phantomIcon from "@/assets/wallets/phantom.png";
import rainbowIcon from "@/assets/wallets/rainbow.svg";
import walletConnectIcon from "@/assets/wallets/walletconnect.svg";
import zerionIcon from "@/assets/wallets/zerion.svg";
import { isMobileBrowser } from "@/lib/walletApp";

type WalletBase = {
  /** Stable key for the list. */
  key: string;
  name: string;
  icon?: string;
  /** Running in this browser, as an extension or the wallet's own browser. */
  installed: boolean;
  recent: boolean;
};

export type WalletOption =
  | (WalletBase & {
      kind: "connector";
      connector: Connector;
      /** The wallet app's own link for a WalletConnect URI, opened from a tap. */
      appLink?: (uri: string) => string;
    })
  | (WalletBase & { kind: "link"; href: string });

const METAMASK_SDK_ID = "metaMaskSDK";
const METAMASK_RDNS = "io.metamask";
const WALLETCONNECT_ID = "walletConnect";

const src = (image: unknown) => (image as { src: string }).src;

const ICONS: Record<string, string> = {
  [METAMASK_SDK_ID]: src(metaMaskIcon),
  [WALLETCONNECT_ID]: src(walletConnectIcon),
  rainbowWalletConnect: src(rainbowIcon),
  zerionWalletConnect: src(zerionIcon),
};

// Documented by each wallet for opening a WalletConnect pairing.
const APP_LINKS: Record<string, (uri: string) => string> = {
  rainbowWalletConnect: (uri) => `rainbow://wc?uri=${encodeURIComponent(uri)}`,
  zerionWalletConnect: (uri) => `zerion://wc?uri=${encodeURIComponent(uri)}`,
};

/** Phantom has no WalletConnect; its browse link reopens this page inside the app. */
const phantomOption = (): WalletOption => ({
  kind: "link",
  key: "phantom",
  name: "Phantom",
  icon: src(phantomIcon),
  installed: false,
  recent: false,
  href: `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=${encodeURIComponent(window.location.origin)}`,
});

const toOption = (
  connector: Connector,
  installed: boolean,
  recentId: string | undefined,
): WalletOption => ({
  kind: "connector",
  key: connector.uid,
  connector,
  name: connector.name,
  icon: ICONS[connector.id] ?? connector.icon,
  installed,
  recent: connector.id === recentId,
  appLink: APP_LINKS[connector.id],
});

/**
 * Wallets to offer, ordered as Uniswap does: wallets in this browser, then
 * WalletConnect and MetaMask's app, the last one used first. Inside a wallet's
 * own browser on a phone, only that wallet; on a phone with no wallet in the
 * browser, also Rainbow, Zerion and Phantom's apps.
 */
export const useOrderedWallets = (): WalletOption[] => {
  const config = useConfig();
  const connectors = useConnectors();
  const [recentId, setRecentId] = useState<string>();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobileBrowser());
    Promise.resolve(config.storage?.getItem("recentConnectorId"))
      .then((id) => setRecentId(id ?? undefined))
      .catch(() => undefined);
  }, [config]);

  return useMemo(() => {
    const byId = (id: string) => connectors.find((c) => c.id === id);
    const metaMask = byId(METAMASK_SDK_ID);
    const walletConnect = byId(WALLETCONNECT_ID);
    const announced = connectors.filter((c) => c.type === "injected");
    const hasMetaMaskExtension = announced.some((c) => c.id === METAMASK_RDNS);

    // MetaMask Connect drives the extension too, so it stands in for it.
    const installed = announced.map((c) =>
      c.id === METAMASK_RDNS && metaMask
        ? toOption(metaMask, true, recentId)
        : toOption(c, true, recentId),
    );

    if (mobile && installed.length === 1) return installed;

    const walletApps =
      mobile && installed.length === 0
        ? [
            ...Object.keys(APP_LINKS).map((id) => {
              const connector = byId(id);
              return connector && toOption(connector, false, recentId);
            }),
            phantomOption(),
          ]
        : [];

    const others = [
      walletConnect && toOption(walletConnect, false, recentId),
      !hasMetaMaskExtension && metaMask && toOption(metaMask, false, recentId),
      ...walletApps,
    ].filter((option): option is WalletOption => Boolean(option));

    return [...installed, ...others].sort(
      (a, b) => Number(b.recent) - Number(a.recent),
    );
  }, [connectors, mobile, recentId]);
};
