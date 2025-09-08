"use server";

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function deleteUser(id: number) {
  try {
    await prisma.users.delete({
      where: { id },
    });
  
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error };
  }
}

export async function editUser(id: number, email: string, role: "USER" | "ADMIN") {
  try {
    await prisma.users.update({
      where: { id },
      data: {
        email,
        role
      }
    });
  
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error };
  }
}

// ===== CREATE USER =====
export async function createUser(email: string, role: "USER" | "ADMIN", password: string) {
  try {

    if (await prisma.users.findUnique({ where: { email } })) {
      return { success: false, message: "User already exists" };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.users.create({
      data: { email, role, password: hashedPassword },
    });

    return { success: true, user };
  } catch (error) {
    return { success: false, message: error };
  }
}

  