import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const decoded = jwt.verify(token, secret) as { invoiceId?: unknown };
    return NextResponse.json({ valid: true, data: { invoiceId: decoded.invoiceId } });
  } catch {
    return NextResponse.json(
      { valid: false, error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}
