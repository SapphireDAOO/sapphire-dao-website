import { CONTRACT_API_URL } from "@/constants";
import type { Address, Hex } from "viem";
import { createSiweMessage } from "viem/siwe";

export type SignInSession = {
  token: string;
  address: Address;
  /** Unix ms. */
  expiresAt: number;
};

type ApiResponse<T> = Partial<T> & { success?: boolean; error?: string };

export class SessionRejectedError extends Error {}

const SESSION_KEY = "sapphire.siwe";
const STATEMENT = "Sign in to Sapphire DAO.";

const EXPIRY_MARGIN_MS = 60_000;

const getStorage = () =>
  typeof window === "undefined" ? null : window.localStorage;

const readSessions = (): Record<string, SignInSession> => {
  const storage = getStorage();
  if (!storage) return {};
  try {
    const parsed = JSON.parse(storage.getItem(SESSION_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeSessions = (sessions: Record<string, SignInSession>) => {
  const storage = getStorage();
  if (!storage) return;
  try {
    if (Object.keys(sessions).length === 0) storage.removeItem(SESSION_KEY);
    else storage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch {
  }
};

export const readSession = (address: Address): SignInSession | null => {
  const session = readSessions()[address.toLowerCase()];
  if (
    typeof session?.token !== "string" ||
    typeof session.expiresAt !== "number" ||
    session.expiresAt - EXPIRY_MARGIN_MS <= Date.now()
  ) {
    return null;
  }
  return session;
};

export const clearSession = (address?: Address) => {
  if (!address) {
    writeSessions({});
    return;
  }
  const sessions = readSessions();
  delete sessions[address.toLowerCase()];
  writeSessions(sessions);
};

const request = async <T>(
  path: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> => {
  const response = await fetch(`${CONTRACT_API_URL}${path}`, {
    ...init,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok || !data.success) {
    throw new Error(data.error || `request failed (${response.status})`);
  }
  return data;
};

/**
 * The message names this page's host, which
 * must be in the API's `auth.domains`.
 */
export const signIn = async (params: {
  address: Address;
  chainId: number;
  signMessage: (message: string) => Promise<Hex>;
}): Promise<SignInSession> => {
  const { nonce, expiresAt: nonceExpiresAt } = await request<{
    nonce: string;
    expiresAt: string;
  }>("/v1/auth/nonce");
  if (!nonce) throw new Error("no nonce was issued");

  const message = createSiweMessage({
    domain: window.location.host,
    uri: window.location.origin,
    address: params.address,
    chainId: params.chainId,
    nonce,
    statement: STATEMENT,
    version: "1",
    issuedAt: new Date(),
    expirationTime: nonceExpiresAt ? new Date(nonceExpiresAt) : undefined,
  });

  const signature = await params.signMessage(message);

  const { token, address, expiresAt } = await request<{
    token: string;
    address: Address;
    expiresAt: string;
  }>("/v1/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  });
  if (!token || !expiresAt) {
    throw new Error("no session was issued");
  }

  const session: SignInSession = {
    token,
    address: address ?? params.address,
    expiresAt: Date.parse(expiresAt),
  };
  writeSessions({
    ...readSessions(),
    [params.address.toLowerCase()]: session,
  });
  return session;
};
