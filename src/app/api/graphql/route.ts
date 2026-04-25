import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { LRUCache } from "lru-cache";
import { THE_GRAPH_API_URL } from "@/constants";

export const runtime = "nodejs";

const SUCCESS_CACHE_TTL_MS = 15_000; // 15 seconds
const RATE_LIMIT_COOLDOWN_MS = 15_000;
const RATE_LIMIT_MESSAGE =
  "Subgraph rate limited the request. Retry in a few seconds.";
const MAX_REQUEST_BODY_SIZE = 100_000;

type ProxyResult = {
  status: number;
  payload: unknown;
  retryAfterSeconds?: number;
};

const responseCache = new LRUCache<
  string,
  { expiresAt: number; result: ProxyResult }
>({
  max: 2000,
  ttl: SUCCESS_CACHE_TTL_MS,
  allowStale: false,
});

const inflightRequests = new Map<string, Promise<ProxyResult>>();
const chainCooldowns = new Map<number, number>();

const getCachedResult = (key: string): ProxyResult | null => {
  return responseCache.get(key)?.result ?? null;
};

const getRetryAfterSeconds = (retryAfterHeader: string | null) => {
  if (!retryAfterHeader) return undefined;

  const seconds = Number(retryAfterHeader);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;

  const retryAt = Date.parse(retryAfterHeader);
  if (Number.isNaN(retryAt)) return undefined;

  const remainingMs = retryAt - Date.now();
  if (remainingMs <= 0) return undefined;

  return Math.ceil(remainingMs / 1000);
};

const makeRateLimitedResult = (retryAfterSeconds?: number): ProxyResult => ({
  status: 429,
  payload: { errors: [{ message: RATE_LIMIT_MESSAGE }] },
  retryAfterSeconds,
});

const toResponse = ({ status, payload, retryAfterSeconds }: ProxyResult) => {
  return NextResponse.json(payload, {
    status,
    headers:
      retryAfterSeconds && retryAfterSeconds > 0
        ? { "Retry-After": String(retryAfterSeconds) }
        : undefined,
  });
};

// ─────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const chainId = Number(req.nextUrl.searchParams.get("chainId") ?? "84532");

  const subgraphUrl = THE_GRAPH_API_URL[chainId];
  if (!subgraphUrl) {
    return NextResponse.json(
      { errors: [{ message: "Unsupported chain" }] },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errors: [{ message: "Invalid request body" }] },
      { status: 400 },
    );
  }

  const serializedBody = JSON.stringify(body);

  // Optional: protect against abuse
  if (serializedBody.length > MAX_REQUEST_BODY_SIZE) {
    return NextResponse.json(
      { errors: [{ message: "Query too large" }] },
      { status: 413 },
    );
  }

  // Use a hash for the cache key (smaller memory footprint)
  const requestKey = `${chainId}:${createHash("sha256").update(serializedBody).digest("hex")}`;

  // Global per-chain cooldown
  const blockedUntil = chainCooldowns.get(chainId) ?? 0;
  if (blockedUntil > Date.now()) {
    const retryAfterSeconds = Math.ceil((blockedUntil - Date.now()) / 1000);
    return toResponse(makeRateLimitedResult(retryAfterSeconds));
  }

  // Check cache
  const cached = getCachedResult(requestKey);
  if (cached) return toResponse(cached);

  // Prepare headers
  const apiKey = process.env.GRAPH_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  try {
    let inflight = inflightRequests.get(requestKey);

    if (!inflight) {
      inflight = fetch(subgraphUrl, {
        method: "POST",
        headers,
        body: serializedBody,
      })
        .then(async (upstream): Promise<ProxyResult> => {
          const raw = await upstream.text();
          const normalized = raw.trim();
          const retryAfterSeconds = getRetryAfterSeconds(
            upstream.headers.get("retry-after"),
          );

          const isRateLimited =
            upstream.status === 429 || /too many requests/i.test(normalized);

          if (isRateLimited) {
            const cooldownMs = Math.max(
              retryAfterSeconds ? retryAfterSeconds * 1000 : 0,
              RATE_LIMIT_COOLDOWN_MS,
            );
            chainCooldowns.set(chainId, Date.now() + cooldownMs);
            return makeRateLimitedResult(
              retryAfterSeconds ?? Math.ceil(cooldownMs / 1000),
            );
          }

          try {
            const data = JSON.parse(raw);
            return { status: upstream.status, payload: data };
          } catch {
            return {
              status: upstream.status || 502,
              payload: {
                errors: [
                  {
                    message:
                      normalized || "Upstream returned a non-JSON response.",
                  },
                ],
              },
            };
          }
        })
        .then((result) => {
          // Only cache successful responses
          if (result.status < 400) {
            responseCache.set(requestKey, {
              expiresAt: Date.now() + SUCCESS_CACHE_TTL_MS,
              result,
            });
          }
          return result;
        })
        .finally(() => {
          inflightRequests.delete(requestKey);
        });

      inflightRequests.set(requestKey, inflight);
    }

    const result = await inflight;
    return toResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream error";
    return NextResponse.json({ errors: [{ message }] }, { status: 502 });
  }
}
