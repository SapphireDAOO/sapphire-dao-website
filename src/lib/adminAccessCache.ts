// Whether an address passed the admin check last time it was asked.
//
// The owner/isSigner reads behind `useAdminAccess` are RPC calls with no
// cross-reload cache, so on every fresh load the nav renders as "not an admin"
// for a few hundred milliseconds and the Admin entry pops in afterwards. This
// remembers the previous answer so a returning admin sees it immediately.
//
// It only decides whether a nav entry is drawn. Every admin page re-verifies
// through ProtectedPage, and the contracts enforce authority on-chain, so a
// tampered value buys nothing beyond a link to a page that refuses.

const CACHE_VERSION = 1;
const CACHE_KEY = `admin-access:v${CACHE_VERSION}`;
// Long enough to cover normal use, short enough that a revoked signer is not
// greeted by the entry indefinitely if they never load a resolving page.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type CachedAccess = { allowed: boolean; updatedAt: number };
type AccessCache = Record<string, CachedAccess>;

const entryKey = (chainId: number, address: string) =>
  `${chainId}:${address.toLowerCase()}`;

const readCache = (): AccessCache => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AccessCache;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([, entry]) =>
          typeof entry?.allowed === "boolean" &&
          Date.now() - entry.updatedAt < CACHE_TTL_MS,
      ),
    );
  } catch {
    return {};
  }
};

/** What this address resolved to last time, if it is still remembered. */
export const readAdminAccess = (
  chainId?: number,
  address?: string,
): boolean | undefined => {
  if (!chainId || !address) return undefined;
  return readCache()[entryKey(chainId, address)]?.allowed;
};

export const writeAdminAccess = (
  chainId: number | undefined,
  address: string | undefined,
  allowed: boolean,
) => {
  if (!chainId || !address || typeof window === "undefined") return;

  try {
    const cache = readCache();
    cache[entryKey(chainId, address)] = { allowed, updatedAt: Date.now() };
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
};
