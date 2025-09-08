import { PrismaClient } from "@prisma/client";
import { preloadStyle } from "next/dist/server/app-render/entry-base";

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") global.prisma = prisma;
