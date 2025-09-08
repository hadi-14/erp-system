import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createToken, setAuthCookie } from "@/utils/auth";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { email, pass } = await req.json();
  const user = await prisma.users.findUnique({ where: { email } });

  if (!user || !user.password)
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (!bcrypt.compareSync(pass, user.password)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
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
