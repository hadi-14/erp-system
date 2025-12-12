import { NextResponse } from "next/server";
import { getAuthCookie, verifyToken } from "@/utils/auth";

export async function GET() {
  const token = await getAuthCookie();
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({ user: payload });
}
