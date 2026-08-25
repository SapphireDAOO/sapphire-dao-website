/**
 * Copy and artwork for the hints shown to first-time users during a wallet
 * interaction.
 *
 * `image` is a path under `public/`. Leave it undefined until a screenshot
 * exists; a hint renders text-only rather than showing a broken image.
 */

/** The wallet interactions a newcomer needs talking through. */
export type HintMoment =
  | "connecting"
  | "signing"
  | "sendingTransaction"
  | "switchingChain"
  | "wrongNetwork";

export type WalletHint = {
  /** e.g. "Open Phantom". */
  title: string;
  /**
   * One or two lines naming the exact action to take. `{network}` is replaced
   * with the network this app actually targets, read from the wagmi config —
   * hardcoding a chain name here would drift the moment the config changes.
   */
  body: string;
  /** Reassurance for the "wait, is this safe?" beat. Optional. */
  note?: string;
  /** Optional screenshot of the wallet popup, cropped tight. */
  image?: string;
  /** Describes the action to take, not the picture. Required with `image`. */
  alt?: string;
};

const MOMENTS: Record<HintMoment, WalletHint> = {
  connecting: {
    title: "Check your wallet",
    body: "Your wallet is asking you to approve this connection. Open it and click Connect to continue.",
    note: "Connecting only lets this site see your address and balance.",
  },
  signing: {
    title: "Sign to prove it's you",
    body: "Your wallet is asking you to sign a message. Open it and click Sign.",
    note: "Signing is free and never moves funds — it only proves you control this wallet. A signature cannot approve a payment.",
  },
  sendingTransaction: {
    title: "Confirm in your wallet",
    body: "Review the details in your wallet, then click Confirm to continue.",
    note: "This is a real transaction: it costs a network fee and is recorded on the blockchain once confirmed.",
  },
  switchingChain: {
    title: "Approve the network switch",
    body: "Your wallet is asking permission to switch to {network}. Approve it to continue.",
  },
  wrongNetwork: {
    title: "You're on the wrong network",
    body: "Your wallet is connected to a network this app doesn't support. Switch it to {network} to continue.",
    note: "Use the network button in the top bar, or your wallet's own network menu.",
  },
};

/**
 * Per-wallet overrides for the connect step. Keyed by lowercased connector id
 * or name: RainbowKit has renamed connector ids across versions (metaMask ->
 * metaMaskSDK), so keying on id alone silently drops the hint on an upgrade.
 */
const CONNECT_BY_WALLET: Record<string, WalletHint> = {
  phantom: {
    title: "Open Phantom to finish",
    body: "Phantom opened in the top-right of your browser. Click Connect there to link your wallet.",
    note: "Connecting only lets this site see your address and balance.",
  },
  metamask: {
    title: "Open MetaMask to finish",
    body: "MetaMask opened in the top-right of your browser. Choose an account, then click Connect.",
    note: "Connecting only lets this site see your address and balance.",
  },
  metamasksdk: {
    title: "Open MetaMask to finish",
    body: "MetaMask opened in the top-right of your browser. Choose an account, then click Connect.",
    note: "Connecting only lets this site see your address and balance.",
  },
  walletconnect: {
    // WalletConnect hands off to a phone, so extension wording is wrong here.
    title: "Check your phone",
    body: "Approve the connection request in your wallet app to continue.",
    note: "Connecting only lets this site see your address and balance.",
  },
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/** Resolves the hint for a moment, preferring wallet-specific connect copy. */
export const getWalletHint = (
  moment: HintMoment,
  connector?: { id?: string; name?: string },
): WalletHint => {
  if (moment === "connecting") {
    for (const key of [connector?.id, connector?.name]) {
      const match = key && CONNECT_BY_WALLET[normalize(key)];
      if (match) return match;
    }
  }
  return MOMENTS[moment];
};

/** Fills the `{network}` placeholder with the chain the app actually targets. */
export const fillNetwork = (text: string, network: string) =>
  text.replace(/\{network\}/g, network);
