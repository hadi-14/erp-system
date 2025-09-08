import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ===== GET ALL USERS =====
export async function GET() {
  const users = await prisma.users.findMany({
    orderBy: { created_at: "desc" },
    select: { id: true, email: true, role: true, created_at: true },
  });
  return NextResponse.json(users);
}

