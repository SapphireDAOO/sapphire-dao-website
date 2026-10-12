// The last admin check per address, so the Admin nav entry doesn't pop in
// after load. Admin pages re-verify through ProtectedPage, so a tampered value
// only shows a link.

const CACHE_VERSION = 1;
const CACHE_KEY = `admin-access:v${CACHE_VERSION}`;
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
  }
};
