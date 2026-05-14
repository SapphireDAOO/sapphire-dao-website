import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const secrets = [process.env.JWT_SECRET, process.env.SECRET_KEY].filter(
    (s): s is string => !!s,
  );
  if (secrets.length === 0) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let decoded: { invoiceId?: unknown; orderId?: unknown } | null = null;
  let lastError: unknown = null;
  for (const secret of secrets) {
    try {
      decoded = jwt.verify(token, secret) as {
        invoiceId?: unknown;
        orderId?: unknown;
      };
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!decoded) {
    console.warn("verify-token: signature verification failed", lastError);
    return NextResponse.json(
      { valid: false, error: "Invalid or expired token" },
      { status: 401 },
    );
  }

  const invoiceId = decoded.invoiceId ?? decoded.orderId;
  return NextResponse.json({ valid: true, data: { invoiceId } });
}
