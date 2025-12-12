import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  const { email } = await req.json();
  const user = await prisma.users.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.users.update({
    where: { email },
    data: { otp_code: otp, otp_expiry: expiry },
  });

  // Configure mailer
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: email,
    subject: "Your OTP Code",
    text: `Your login code is: ${otp}`,
  });

  return NextResponse.json({ message: "OTP sent" });
}
