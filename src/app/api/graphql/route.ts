import { NextRequest, NextResponse } from "next/server";
import { THE_GRAPH_API_URL } from "@/constants";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const chainId = Number(
    req.nextUrl.searchParams.get("chainId") ?? "11155111"
  );

  const subgraphUrl = THE_GRAPH_API_URL[chainId];
  if (!subgraphUrl) {
    return NextResponse.json(
      { errors: [{ message: "Unsupported chain" }] },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { errors: [{ message: "Invalid request body" }] },
      { status: 400 }
    );
  }

  const apiKey = process.env.GRAPH_API_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

  try {
    const upstream = await fetch(subgraphUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upstream error";
    return NextResponse.json(
      { errors: [{ message }] },
      { status: 502 }
    );
  }
}