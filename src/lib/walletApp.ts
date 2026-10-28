/** A phone or tablet browser, where wallets are separate apps. */
export const isMobileBrowser = () => {
  if (typeof navigator === "undefined") return false;
  const agent = navigator.userAgent;
  return (
    /Android|iPhone|iPad|iPod/i.test(agent) ||
    // iPadOS reports itself as a Mac.
    (/Macintosh/.test(agent) && navigator.maxTouchPoints > 1)
  );
};

/**
 * True on a phone with no in-browser wallet, where every wallet request opens
 * the wallet app. Opened without a tap, the browser asks first, so requests
 * there should each start from the user's own tap.
 */
export const signsInAnotherApp = () => {
  if (typeof window === "undefined") return false;
  if ((window as { ethereum?: unknown }).ethereum) return false;
  return isMobileBrowser();
};
