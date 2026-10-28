export type HintMoment =
  | "connecting"
  | "signing"
  | "approvingToken"
  | "sendingTransaction"
  | "switchingChain"
  | "wrongNetwork";

export type WalletHint = {
  title: string;
  /** `{network}` is replaced with the chain from the wagmi config. */
  body: string;
  note?: string;
  /** Path under public/; omit until a screenshot exists. */
  image?: string;
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
    note: "Signing is free and never moves funds. It only proves you control this wallet, and a signature cannot approve a payment.",
  },
  approvingToken: {
    title: "Allow the payment amount",
    body: "Your wallet is asking permission for this app to move your tokens. Open it and click Confirm.",
    note: "Tokens need this step before a contract can move them. You are approving only the amount for this payment, not unlimited access. The payment itself is a second, separate confirmation.",
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

// Keyed by connector id or name: MetaMask Connect is metaMaskSDK,
// while browser-announced wallets use their own names.
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
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

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

export const fillNetwork = (text: string, network: string) =>
  text.replace(/\{network\}/g, network);
