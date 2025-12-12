'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { products } from "@prisma/client";

export async function getProducts() {
  try {
    const products = await prisma.products.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return products
  } catch (error) {
    console.error('Error fetching products:', error)
    return []
  }
}

export async function createProduct(formData: FormData) {
  try {
    const productData: Omit<products, 'id' | 'createdAt'> = {
      sku: formData.get('sku') as string,
      asin: formData.get('asin') as string || null,
      mainCategory: formData.get('mainCategory') as string,
      subCategory: formData.get('subCategory') as string || null,
      productTitle: formData.get('productTitle') as string,
      costPrice: parseFloat(formData.get('costPrice') as string),
      salePrice: parseFloat(formData.get('salePrice') as string),
      dealPrice: formData.get('dealPrice') ? parseFloat(formData.get('dealPrice') as string) : null,
      color: formData.get('color') as string || null,
      productLength: parseFloat(formData.get('productLength') as string) || 0,
      productWidth: parseFloat(formData.get('productWidth') as string) || 0,
      productHeight: parseFloat(formData.get('productHeight') as string) || 0,
      productDimensionUnit: formData.get('productDimensionUnit') as string || 'cm',
      packageLength: parseFloat(formData.get('packageLength') as string) || 0,
      packageWidth: parseFloat(formData.get('packageWidth') as string) || 0,
      packageHeight: parseFloat(formData.get('packageHeight') as string) || 0,
      packageDimensionUnit: formData.get('packageDimensionUnit') as string || 'cm',
      packageWeight: parseFloat(formData.get('packageWeight') as string) || 0,
      weightUnit: formData.get('weightUnit') as string || 'Gram',
      productImage: formData.get('productImage') as string || null,
      productLaunchDate: formData.get('productLaunchDate') ? new Date(formData.get('productLaunchDate') as string) : null,
      supplierUrl: formData.get('supplierUrl') as string || null,
      salePerson: formData.get('salePerson') as string || null,
    }

    await prisma.products.create({ data: productData})

    revalidatePath('/products')
    return { success: true }
  } catch (error) {
    console.error('Error creating product:', error)
    return { success: false, error: 'Failed to create product' }
  }
}

export async function updateProduct(id: number, formData: FormData) {
  try {
    const productData = {
      sku: formData.get('sku') as string,
      asin: formData.get('asin') as string || null,
      mainCategory: formData.get('mainCategory') as string,
      subCategory: formData.get('subCategory') as string || null,
      productTitle: formData.get('productTitle') as string,
      costPrice: parseFloat(formData.get('costPrice') as string),
      salePrice: parseFloat(formData.get('salePrice') as string),
      dealPrice: formData.get('dealPrice') ? parseFloat(formData.get('dealPrice') as string) : null,
      color: formData.get('color') as string || null,
      productLength: parseFloat(formData.get('productLength') as string) || 0,
      productWidth: parseFloat(formData.get('productWidth') as string) || 0,
      productHeight: parseFloat(formData.get('productHeight') as string) || 0,
      productDimensionUnit: formData.get('productDimensionUnit') as string || 'cm',
      packageLength: parseFloat(formData.get('packageLength') as string) || 0,
      packageWidth: parseFloat(formData.get('packageWidth') as string) || 0,
      packageHeight: parseFloat(formData.get('packageHeight') as string) || 0,
      packageDimensionUnit: formData.get('packageDimensionUnit') as string || 'cm',
      packageWeight: parseFloat(formData.get('packageWeight') as string) || 0,
      weightUnit: formData.get('weightUnit') as string || 'Gram',
      productImage: formData.get('productImage') as string || null,
      productLaunchDate: formData.get('productLaunchDate') as string || null,
      supplierUrl: formData.get('supplierUrl') as string || null,
      salePerson: formData.get('salePerson') as string || null,
    }

    await prisma.products.update({
      where: { id },
      data: productData
    })

    revalidatePath('/products')
    return { success: true }
  } catch (error) {
    console.error('Error updating product:', error)
    return { success: false, error: 'Failed to update product' }
  }
}

export async function deleteProduct(id: number) {
  try {
    await prisma.products.delete({
      where: { id }
    })

    revalidatePath('/products')
    return { success: true }
  } catch (error) {
    console.error('Error deleting product:', error)
    return { success: false, error: 'Failed to delete product' }
  }
}

export async function bulkImportProducts(products: Omit<products, 'id' | 'createdAt'>[]) {
  try {
    const result = await prisma.products.createMany({
      data: products,
      skipDuplicates: true
    })

    revalidatePath('/products')
    return { success: true, count: result.count }
  } catch (error) {
    console.error('Error importing products:', error)
    return { success: false, error: 'Failed to import products' }
  }
}