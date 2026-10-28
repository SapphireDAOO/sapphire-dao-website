import type { Config } from "wagmi";
import { reconnect } from "wagmi/actions";

// A stalled wallet shouldn't keep the page waiting past this.
const SETTLE_AFTER_MS = 8_000;

let settled = false;
const listeners = new Set<() => void>();

const settle = () => {
  if (settled) return;
  settled = true;
  for (const listener of listeners) listener();
};

export const isMountReconnectSettled = () => settled;

export const subscribeMountReconnect = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Reconnects only the wallet used last, plus Safe inside its app frame, so
 * wallets nobody picked aren't started on load and can't stall the page.
 */
export const reconnectRecentWallet = async (config: Config) => {
  const timer = setTimeout(settle, SETTLE_AFTER_MS);
  try {
    const recentId = await config.storage?.getItem("recentConnectorId");
    const framed = window.parent !== window;
    const connectors = config.connectors.filter(
      (connector) =>
        connector.id === recentId || (framed && connector.id === "safe"),
    );
    if (connectors.length) await reconnect(config, { connectors });
  } catch {
    // Nothing to restore; the user connects again.
  } finally {
    clearTimeout(timer);
    settle();
  }
};
