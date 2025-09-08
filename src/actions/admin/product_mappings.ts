"use server";

import { prisma } from "@/lib/prisma";
import { order_mappings } from "@prisma/client";

export async function getAmazonProducts() {
  try {
    const products = await prisma.aMZN_PRODUCT_LIST.findMany();
    return { success: true, products: products };
  } catch (error) {
    return { success: false, message: error };
  }
}

export async function get1688Products() {
  try {
    const products = await prisma.product_list_en.findMany();
    return { success: true, products: products };
  } catch (error) {
    return { success: false, message: error };
  }
}

export async function getMappings() {
  try {
    const mappings = await prisma.order_mappings.findMany();
    return { success: true, mappings: mappings };
  } catch (error) {
    return { success: false, message: error };
  }
}

export async function deleteMapping(id: number) {
  try {
    await prisma.order_mappings.delete({
      where: { id },
    });
  
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error };
  }
}

export async function editMapping(id: number, data: order_mappings) {
  try {
    await prisma.order_mappings.update({
      where: { id },
      data: {
        ...data
      }
    });
  
    return { success: true, id };
  } catch (error) {
    return { success: false, message: error };
  }
}

// ===== CREATE MAPPING =====
export async function createMapping(data: order_mappings) {
  try {
    const mapping = await prisma.order_mappings.create({
      data: { ...data },
    });

    return { success: true, mapping };
  } catch (error) {
    console.log(error);
    return { success: false, message: error };
  }
}