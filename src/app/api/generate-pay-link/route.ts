import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function POST(req: NextRequest) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let invoiceId: string;
  try {
    const body = await req.json();
    invoiceId = String(body?.invoiceId ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!invoiceId) {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  const token = jwt.sign({ invoiceId }, secret, { expiresIn: "7d" });
  return NextResponse.json({ token });
}