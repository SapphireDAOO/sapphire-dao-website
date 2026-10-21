export type Platform = "ios" | "android" | "chromium" | "firefox" | "other";

export type GuideAction = "store" | "openInWallet" | "reload" | "connect";

export type GuideStep = {
  text: string;
  action?: GuideAction;
};

export type WalletGuide = {
  platform: Platform;
  label: string;
  wallet: string;
  store: { label: string; href: string };
  steps: GuideStep[];
};

const RECOVERY_PHRASE_STEP: GuideStep = {
  text: "Create a new wallet and write your Secret Recovery Phrase on paper. Anyone who has it can take your funds, so keep it offline.",
};

export const WALLET_GUIDES: Record<Platform, WalletGuide> = {
  ios: {
    platform: "ios",
    label: "iPhone & iPad",
    wallet: "MetaMask",
    store: {
      label: "Get MetaMask on the App Store",
      href: "https://apps.apple.com/app/metamask/id1438144202",
    },
    steps: [
      { text: "Open the App Store.", action: "store" },
      { text: "Install MetaMask, then open it." },
      RECOVERY_PHRASE_STEP,
      { text: "Set a passcode or Face ID so only you can approve payments." },
      {
        text: "Open this page inside MetaMask to connect.",
        action: "openInWallet",
      },
    ],
  },
  android: {
    platform: "android",
    label: "Android",
    wallet: "MetaMask",
    store: {
      label: "Get MetaMask on Google Play",
      href: "https://play.google.com/store/apps/details?id=io.metamask",
    },
    steps: [
      { text: "Open Google Play.", action: "store" },
      { text: "Install MetaMask, then open it." },
      RECOVERY_PHRASE_STEP,
      {
        text: "Set a passcode or fingerprint so only you can approve payments.",
      },
      {
        text: "Open this page inside MetaMask to connect.",
        action: "openInWallet",
      },
    ],
  },
  chromium: {
    platform: "chromium",
    label: "Chrome, Edge & Brave",
    wallet: "MetaMask",
    store: {
      label: "Add MetaMask from the Chrome Web Store",
      href: "https://chromewebstore.google.com/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn",
    },
    steps: [
      { text: "Open the Chrome Web Store.", action: "store" },
      { text: "Click Add to Chrome, then Add extension." },
      {
        text: "Pin MetaMask: click the puzzle icon in the toolbar, then the pin beside MetaMask.",
      },
      RECOVERY_PHRASE_STEP,
      { text: "Reload this page.", action: "reload" },
    ],
  },
  firefox: {
    platform: "firefox",
    label: "Firefox",
    wallet: "MetaMask",
    store: {
      label: "Add MetaMask from Firefox Add-ons",
      href: "https://addons.mozilla.org/firefox/addon/ether-metamask/",
    },
    steps: [
      { text: "Open Firefox Add-ons.", action: "store" },
      { text: "Click Add to Firefox, then Add." },
      {
        text: "Pin MetaMask: click the extensions icon in the toolbar, then Pin to Toolbar.",
      },
      RECOVERY_PHRASE_STEP,
      { text: "Reload this page.", action: "reload" },
    ],
  },
  // Safari and other desktop browsers have no MetaMask
  // extension, so a phone wallet connects by QR code.
  other: {
    platform: "other",
    label: "Other browsers",
    wallet: "MetaMask Mobile",
    store: {
      label: "Get MetaMask for your phone",
      href: "https://metamask.io/download/",
    },
    steps: [
      { text: "Install MetaMask on your phone.", action: "store" },
      RECOVERY_PHRASE_STEP,
      {
        text: "Click Connect wallet here and choose WalletConnect.",
        action: "connect",
      },
      { text: "In MetaMask, tap the scan icon and scan the QR code." },
      { text: "Approve the connection in MetaMask." },
    ],
  },
};

export const PLATFORMS = Object.keys(WALLET_GUIDES) as Platform[];

export const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac.
  if (
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  ) {
    return "ios";
  }
  if (/Android/.test(ua)) return "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\/|Chromium\//.test(ua)) return "chromium";
  return "other";
};

export const hasInjectedWallet = () =>
  typeof window !== "undefined" &&
  Boolean((window as { ethereum?: unknown }).ethereum);

/** Reopens the current page in MetaMask's in-app browser. */
export const metaMaskDeepLink = () =>
  typeof window === "undefined"
    ? "https://metamask.app.link"
    : `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.search}`;
