import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/utils/auth";

export async function POST(req: Request) {
  await clearAuthCookie();

  return NextResponse.json({ message: "Logout successful" });
}
