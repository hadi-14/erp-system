"use server";

import { prisma } from "@/lib/prisma";

export async function deleteReport(id: number) {
  try {
    await prisma.reports.delete({
      where: { id },
    });
  
    return { id };
  } catch (error) {
    return { message: error };
  }
}

export async function editReport(id: number, name: string, url: string) {
  try {
    await prisma.reports.update({
      where: { id },
      data: {
        name,
        url
      }
    });
  
    return { id };
  } catch (error) {
    return { message: error };
  }
}

// ===== CREATE REPORT =====
export async function createReport(name: string, url: string) {
  try {

    if (await prisma.reports.findUnique({ where: { name } })) {
      return { success: false, message: "Report already exists" };
    }

    const newReport = await prisma.reports.create({
      data: {
        name,
        url,
      },
    });

    return { report: newReport };
  } catch (error) {
    return { message: error };
  }
}
  