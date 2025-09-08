import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, setAuthCookie } from "@/utils/auth";

export async function POST(req: Request) {
  const { email, otp } = await req.json();
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user || !user.otp_code || !user.otp_expiry)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (user.otp_code !== otp || new Date(Date.now()) > user.otp_expiry) {
    return NextResponse.json(
      { error: "Invalid or expired OTP" },
      { status: 401 }
    );
  }

  const token = createToken({
    id: user.id,
    role: user.role,
    email: user.email,
  });
  setAuthCookie(token);

  // Clear OTP
  await prisma.users.update({
    where: { email },
    data: { otp_code: null, otp_expiry: null },
  });

  return NextResponse.json({ message: "Login successful", role: user.role });
}
