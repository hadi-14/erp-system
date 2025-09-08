import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

const SECRET = process.env.JWT_SECRET || "supersecret";

export function createToken(payload: object) {
  return jwt.sign(payload, SECRET, { expiresIn: "30Days" });
}

export function verifyToken(token: string) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });
}

export async function getAuthCookie() {
  return (await cookies()).get("session")?.value || null;
}

export async function clearAuthCookie() {
  (await cookies()).delete("session");
}
