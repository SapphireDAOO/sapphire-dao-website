import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { THE_GRAPH_API_URL } from "@/constants";

export const runtime = "nodejs";

const RATE_LIMIT_COOLDOWN_MS = 15_000;
const UPSTREAM_TIMEOUT_MS = 15_000;
const MAX_REQUEST_BODY_SIZE = 100_000;

const RATE_LIMIT_MESSAGE =
  "Subgraph rate limited the request. Retry in a few seconds.";

type ProxyResult = {
  status: number;
  payload: unknown;
  retryAfterSeconds?: number;
};

const inflightRequests = new Map<string, Promise<ProxyResult>>();
const chainCooldowns = new Map<number, number>();

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

const isRateLimitResponse = (status: number, body: string): boolean => {
  return status === 429 || /too many requests/i.test(body);
};

const fetchSubgraph = async (
  subgraphUrl: string,
  headers: Record<string, string>,
  serializedBody: string,
  chainId: number,
): Promise<ProxyResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(subgraphUrl, {
      method: "POST",
      headers,
      body: serializedBody,
      signal: controller.signal,
    });

    const raw = await upstream.text();
    const normalized = raw.trim();

    const retryAfterSeconds = getRetryAfterSeconds(
      upstream.headers.get("retry-after"),
    );

    if (isRateLimitResponse(upstream.status, normalized)) {
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
      const data = JSON.parse(raw) as unknown;

      return {
        status: upstream.status,
        payload: data,
      };
    } catch {
      return {
        status: upstream.status || 502,
        payload: {
          errors: [
            {
              message: normalized || "Upstream returned a non-JSON response.",
            },
          ],
        },
      };
    }
  } finally {
    clearTimeout(timeout);
  }
};

export async function POST(req: NextRequest) {
  const chainId = Number(req.nextUrl.searchParams.get("chainId") ?? "84532");

  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    return NextResponse.json(
      { errors: [{ message: "Invalid chainId" }] },
      { status: 400 },
    );
  }

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

  if (serializedBody.length > MAX_REQUEST_BODY_SIZE) {
    return NextResponse.json(
      { errors: [{ message: "Query too large" }] },
      { status: 413 },
    );
  }

  const requestKey = `${chainId}:${createHash("sha256")
    .update(serializedBody)
    .digest("hex")}`;

  const now = Date.now();
  const blockedUntil = chainCooldowns.get(chainId) ?? 0;

  if (blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((blockedUntil - now) / 1000);
    return toResponse(makeRateLimitedResult(retryAfterSeconds));
  }

  const apiKey = process.env.GRAPH_API_KEY;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    let inflight = inflightRequests.get(requestKey);

    if (!inflight) {
      inflight = fetchSubgraph(subgraphUrl, headers, serializedBody, chainId)
        .finally(() => {
          inflightRequests.delete(requestKey);
        });

      inflightRequests.set(requestKey, inflight);
    }

    const result = await inflight;
    return toResponse(result);
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Subgraph request timed out."
        : err instanceof Error
          ? err.message
          : "Upstream error";

    return NextResponse.json({ errors: [{ message }] }, { status: 502 });
  }
}
