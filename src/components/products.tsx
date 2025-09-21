'use client'

import { useEffect, useState } from 'react'
import { Plus, Edit, Trash2, Upload, Download, Package, DollarSign, Ruler, Weight, Calendar, User, Link, Search, Filter, X } from 'lucide-react'
import Image from 'next/image'
import { createProduct, updateProduct, deleteProduct, bulkImportProducts, getProducts } from "@/actions/admin/products";
import { products as ProductType } from "@prisma/client";
import * as XLSX from 'xlsx'

type NewProduct = Omit<ProductType, "id" | "createdAt">;

// const initialProduct: NewProduct = {
//   sku: '',
//   asin: '',
//   mainCategory: '',
//   subCategory: '',
//   productTitle: '',
//   costPrice: 0,
//   salePrice: 0,
//   dealPrice: 0,
//   color: '',
//   productLength: 0,
//   productWidth: 0,
//   productHeight: 0,
//   productDimensionUnit: 'cm',
//   packageLength: 0,
//   packageWidth: 0,
//   packageHeight: 0,
//   packageDimensionUnit: 'cm',
//   packageWeight: 0,
//   weightUnit: 'Gram',
//   productImage: '',
//   productLaunchDate: new Date(Date.now()),
//   supplierUrl: '',
//   salePerson: '',
// }

export default function ProductManagement() {
  const [productsList, setProductsList] = useState<ProductType[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductType | null>(null)
  const [loading, setLoading] = useState(false)
  const [bulkImportData, setBulkImportData] = useState('')
  const [showBulkImport, setShowBulkImport] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [excelFile, setExcelFile] = useState<File | null>(null)

  useEffect(() => {
    getProducts().then(data => setProductsList(data))
  }, [])

  const handleSubmit = async (formData: FormData) => {
    try {
      setLoading(true)
      let result

      if (editingProduct) {
        result = await updateProduct(editingProduct.id, formData)
      } else {
        result = await createProduct(formData)
      }

      if (result.success) {
        window.location.reload()
      } else {
        alert('An error occurred')
      }
    } catch (error) {
      console.error('Error saving product:', error)
      alert('An error occurred while saving the product')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      setLoading(true)
      const result = await deleteProduct(id)

      if (result.success) {
        setProductsList(productsList.filter(p => p.id !== id))
      } else {
        alert('Failed to delete product')
      }
    } catch (error) {
      console.error('Error deleting product:', error)
      alert('An error occurred while deleting the product')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkImport = async () => {
    try {
      setLoading(true)
      const lines = bulkImportData.trim().split('\n')
      const newProducts: NewProduct[] = lines.map(line => {
        const fields = line.split('\t')
        return {
          sku: fields[0] || '',
          asin: fields[1] || '',
          mainCategory: fields[2] || '',
          subCategory: fields[3] || '',
          productTitle: fields[4] || '',
          costPrice: parseFloat(fields[5]) || 0,
          salePrice: parseFloat(fields[6]) || 0,
          dealPrice: parseFloat(fields[7]) || 0,
          color: fields[8] || '',
          productLength: parseFloat(fields[9]) || 0,
          productWidth: parseFloat(fields[10]) || 0,
          productHeight: parseFloat(fields[11]) || 0,
          productDimensionUnit: (fields[12] as 'cm' | 'inch') || 'cm',
          packageLength: parseFloat(fields[13]) || 0,
          packageWidth: parseFloat(fields[14]) || 0,
          packageHeight: parseFloat(fields[15]) || 0,
          packageDimensionUnit: (fields[16] as 'cm' | 'inch') || 'cm',
          packageWeight: parseFloat(fields[17]) || 0,
          weightUnit: fields[18] || 'Gram',
          productImage: fields[19] || '',
          productLaunchDate: fields[20] ? new Date(fields[20]) : new Date(),
          supplierUrl: fields[21] || '',
          salePerson: fields[22] || ''
        }
      })

      const result = await bulkImportProducts(newProducts)

      if (result.success) {
        setBulkImportData('')
        setShowBulkImport(false)
        window.location.reload()
      } else {
        alert('Failed to import products')
      }
    } catch (error) {
      console.error('Error importing products:', error)
      alert('An error occurred during bulk import')
    } finally {
      setLoading(false)
    }
  }

  const openModal = (product?: ProductType) => {
    setEditingProduct(product || null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  // Export Excel template
  const exportTemplate = () => {
    window.open('/products-template.xlsx', '_blank');
  }

  // Handle Excel file upload and parse
  const handleExcelUpload = async () => {
    if (!excelFile) return
    setLoading(true)
    try {
      const data = await excelFile.arrayBuffer()
      const workbook = XLSX.read(data)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rows: never[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      // Remove header row
      rows.shift()
      rows.shift()

      console.log(rows)

      const newProducts: NewProduct[] = rows.map(fields => ({
        sku: fields[0],
        asin: fields[1] || '',
        mainCategory: fields[2] || '',
        subCategory: fields[3] || '',
        productTitle: fields[4] || '',
        costPrice: parseFloat(fields[5]) || 0,
        salePrice: parseFloat(fields[6]) || 0,
        dealPrice: parseFloat(fields[7]) || 0,
        color: fields[8] || '',
        productLength: parseFloat(fields[9]) || 0,
        productWidth: parseFloat(fields[10]) || 0,
        productHeight: parseFloat(fields[11]) || 0,
        productDimensionUnit: (fields[12] as 'cm' | 'inch') || 'cm',
        packageLength: parseFloat(fields[13]) || 0,
        packageWidth: parseFloat(fields[14]) || 0,
        packageHeight: parseFloat(fields[15]) || 0,
        packageDimensionUnit: (fields[16] as 'cm' | 'inch') || 'cm',
        packageWeight: parseFloat(fields[17]) || 0,
        weightUnit: fields[18] || 'Gram',
        productImage: fields[19] || '',
        productLaunchDate: fields[20] ? new Date(fields[20]) : new Date(),
        supplierUrl: fields[21] || '',
        salePerson: fields[22] || ''
      }))
      const result = await bulkImportProducts(newProducts)
      if (result.success) {
        setExcelFile(null)
        setShowBulkImport(false)
        window.location.reload()
      } else {
        alert('Failed to import products')
      }
    } catch (error) {
      console.error('Error importing products:', error)
      alert('An error occurred during bulk import')
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = productsList.filter(product => {
    const matchesSearch = product.productTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.asin ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !filterCategory || product.mainCategory === filterCategory
    return matchesSearch && matchesCategory
  })

  const categories = [...new Set(productsList.map(product => product.mainCategory))]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Product Management
                </h1>
                <p className="text-slate-600 mt-2">Manage your product catalog and inventory</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={exportTemplate}
                  className="inline-flex items-center px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                >
                  <Download className="w-4 h-4 mr-2 text-slate-500" />
                  Export Template
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:from-amber-600 hover:to-orange-600 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Bulk Import
                </button>
                <button
                  onClick={() => openModal()}
                  className="inline-flex items-center px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Product
                </button>
              </div>
            </div>

            {/* Search and Filter Section */}
            <div className="flex flex-col sm:flex-row gap-4 mt-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-950 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by product title, SKU, or ASIN..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm transition-all duration-200 text-gray-950"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="pl-10 pr-8 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 backdrop-blur-sm min-w-48"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category ?? undefined}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Product
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    SKU/ASIN
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Pricing (AED)
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <Ruler className="w-4 h-4" />
                      Dimensions
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-blue-50/30 transition-all duration-200 group">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-12 w-12 rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-200 group-hover:shadow-md transition-all duration-200">
                          <Image
                            className="h-full w-full object-cover"
                            src={product.productImage || '/placeholder.jpg'}
                            alt={product.productTitle}
                            width={48}
                            height={48}
                            style={{ objectFit: 'cover' }}
                            unoptimized={product.productImage?.startsWith('http') ?? false}
                          />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-semibold text-slate-800 max-w-xs truncate">
                            {product.productTitle}
                          </div>
                          <div className="text-sm text-slate-500 flex items-center gap-1">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: product.color || '#e2e8f0' }}></div>
                            {product.color || 'No color'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-800">{product.sku}</div>
                      <div
                        className="text-sm text-slate-500 cursor-pointer hover:underline"
                        onClick={() => {
                          const extractedAsin = product.asin;
                          if (extractedAsin) {
                            window.open(`https://amazon.com/dp/${extractedAsin}`, '_blank');
                          }
                        }}
                        title={product.asin ? "View on Amazon" : ""}
                      >
                        {product.asin}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-800">{product.mainCategory}</div>
                      <div className="text-sm text-slate-500">{product.subCategory}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="text-sm text-slate-600">Cost: <span className="font-semibold">{product.costPrice}</span></div>
                        <div className="text-sm text-slate-600">Sale: <span className="font-semibold text-blue-600">{product.salePrice}</span></div>
                        {product.dealPrice != null && product.dealPrice > 0 && (
                          <div className="text-sm text-green-600 font-semibold">Deal: {product.dealPrice}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      <div className="space-y-1">
                        <div>P: {product.productLength}×{product.productWidth}×{product.productHeight} {product.productDimensionUnit}</div>
                        <div>Pkg: {product.packageLength}×{product.packageWidth}×{product.packageHeight} {product.packageDimensionUnit}</div>
                        <div className="flex items-center gap-1">
                          <Weight className="w-3 h-3" />
                          {product.packageWeight} {product.weightUnit}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openModal(product)}
                          className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id!)}
                          className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredProducts.length === 0 && !loading && (
            <div className="text-center py-16">
              <Package className="mx-auto h-12 w-12 text-slate-400 mb-4" />
              <p className="text-slate-500 text-lg">No orders found</p>
              <p className="text-slate-400 text-sm mt-1">Add your first product to get started</p>
            </div>
          )}
        </div>

        {/* Add/Edit Product Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-hidden">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-800">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
                <form action={handleSubmit} className="space-y-8">
                  {/* Basic Information */}
                  <div className="bg-slate-50/50 rounded-xl p-6 border border-slate-100">
                    <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5" />
                      Basic Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">SKU *</label>
                        <input
                          type="text"
                          name="sku"
                          defaultValue={editingProduct?.sku || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">ASIN</label>
                        <input
                          type="text"
                          name="asin"
                          defaultValue={editingProduct?.asin || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Main Category</label>
                        <input
                          type="text"
                          name="mainCategory"
                          defaultValue={editingProduct?.mainCategory || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Sub Category</label>
                        <input
                          type="text"
                          name="subCategory"
                          defaultValue={editingProduct?.subCategory || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Product Title</label>
                        <input
                          type="text"
                          name="productTitle"
                          defaultValue={editingProduct?.productTitle || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
                        <input
                          type="text"
                          name="color"
                          defaultValue={editingProduct?.color || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pricing Section */}
                  <div className="bg-green-50/50 rounded-xl p-6 border border-green-100">
                    <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5" />
                      Pricing
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Cost Price (AED)</label>
                        <input
                          type="number"
                          step="0.01"
                          name="packageWidth"
                          defaultValue={editingProduct?.packageWidth || 0}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Height</label>
                        <input
                          type="number"
                          step="0.01"
                          name="packageHeight"
                          defaultValue={editingProduct?.packageHeight || 0}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Unit</label>
                        <select
                          name="packageDimensionUnit"
                          defaultValue={editingProduct?.packageDimensionUnit || 'cm'}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        >
                          <option value="cm">cm</option>
                          <option value="inch">inch</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                          <Weight className="w-4 h-4" />
                          Package Weight
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          name="packageWeight"
                          defaultValue={editingProduct?.packageWeight || 0}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Weight Unit</label>
                        <select
                          name="weightUnit"
                          defaultValue={editingProduct?.weightUnit || 'Gram'}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        >
                          <option value="Gram">Gram</option>
                          <option value="Kg">Kg</option>
                          <option value="Pound">Pound</option>
                          <option value="Ounce">Ounce</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Additional Information */}
                  <div className="bg-orange-50/50 rounded-xl p-6 border border-orange-100">
                    <h4 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <Link className="w-5 h-5" />
                      Additional Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Product Image URL</label>
                        <input
                          type="url"
                          name="productImage"
                          defaultValue={editingProduct?.productImage || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          placeholder="https://example.com/image.jpg"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Launch Date
                        </label>
                        <input
                          type="date"
                          name="productLaunchDate"
                          defaultValue={
                            editingProduct?.productLaunchDate
                              ? typeof editingProduct.productLaunchDate === 'string'
                                ? editingProduct.productLaunchDate
                                : editingProduct.productLaunchDate.toISOString().split('T')[0]
                              : ''
                          }
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Sale Person
                        </label>
                        <input
                          type="text"
                          name="salePerson"
                          defaultValue={editingProduct?.salePerson || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Supplier URL</label>
                        <input
                          type="url"
                          name="supplierUrl"
                          defaultValue={editingProduct?.supplierUrl || ''}
                          className="w-full border border-slate-300 text-slate-500 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                          placeholder="https://supplier.com/product"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-6 py-2.5 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-6 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Saving...
                        </div>
                      ) : (
                        editingProduct ? 'Update Product' : 'Create Product'
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkImport && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-white/20 max-h-[90vh] overflow-hidden">
              <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Upload className="w-6 h-6 text-blue-600" />
                    Bulk Import Products
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    Import multiple products using Excel (.xlsx) or tab-separated values
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors duration-200"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Download className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        First, download the Excel template to see the correct format
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        The template contains all required columns in the proper product format.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-950 mb-3">
                    Upload Excel file (.xlsx):
                  </label>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={e => setExcelFile(e.target.files?.[0] || null)}
                    className="mb-4 text-slate-700 opacity-100 border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 w-full"
                  />
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                  <div className="text-sm text-slate-600">
                    {excelFile
                      ? `${excelFile.name} selected`
                      : bulkImportData.trim()
                        ? `${bulkImportData.trim().split('\n').length} orders ready to import`
                        : 'No data entered'}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowBulkImport(false)}
                      className="px-4 py-2.5 border border-slate-300rounded-xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 transition-all duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={excelFile ? handleExcelUpload : handleBulkImport}
                      disabled={loading || (!bulkImportData.trim() && !excelFile)}
                      className="px-6 py-2.5 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Importing...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Upload className="w-4 h-4" />
                          Import Products
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}