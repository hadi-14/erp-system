import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const reports = await prisma.reports.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ reports });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}