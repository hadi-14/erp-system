'use client';

import { useState, useEffect } from 'react';
import { getWarehouses, getStockItems, createStockItem, updateStockQuantity, downloadStockTemplate, uploadStockBulk, deleteStockItem } from '@/actions/stock';
import { Download, Upload, Plus, Edit2, Trash2, X, AlertCircle } from 'lucide-react';

interface StockItemForm {
  sku: string;
  warehouse_id: string;
  rack_id: string;
  quantity: string;
  reorder_level: string;
}

export default function StockDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [filterWarehouse, setFilterWarehouse] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [error, setError] = useState('');
  const [racks, setRacks] = useState<any[]>([]);

  const [formData, setFormData] = useState<StockItemForm>({
    sku: '',
    warehouse_id: '',
    rack_id: '',
    quantity: '',
    reorder_level: ''
  });

  const [editData, setEditData] = useState({
    quantity: '',
    reason: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [w, s] = await Promise.all([
        getWarehouses(),
        getStockItems()
      ]);
      setWarehouses(w);
      setStockItems(s);
      
      // Extract racks from warehouses
      const allRacks: any[] = [];
      w.forEach(warehouse => {
        if (warehouse.racks) {
          allRacks.push(...warehouse.racks);
        }
      });
      setRacks(allRacks);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const csv = await downloadStockTemplate();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'stock-template.csv';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      setError('Failed to download template');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setLoading(true);
    try {
      await uploadStockBulk(uploadFile);
      setUploadFile(null);
      setError('');
      await fetchData();
    } catch (error) {
      console.error('Upload failed:', error);
      setError('Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const validateStockForm = () => {
    if (!formData.sku.trim()) {
      setError('SKU is required');
      return false;
    }
    if (!formData.warehouse_id) {
      setError('Warehouse is required');
      return false;
    }
    if (!formData.quantity || parseInt(formData.quantity) < 0) {
      setError('Quantity must be 0 or greater');
      return false;
    }
    setError('');
    return true;
  };

  const handleAddStock = async () => {
    if (!validateStockForm()) return;

    try {
      setLoading(true);
      await createStockItem({
        sku: formData.sku.trim(),
        warehouse_id: parseInt(formData.warehouse_id),
        rack_id: formData.rack_id ? parseInt(formData.rack_id) : undefined,
        quantity: parseInt(formData.quantity),
        reorder_level: formData.reorder_level ? parseInt(formData.reorder_level) : 10
      });

      setFormData({ sku: '', warehouse_id: '', rack_id: '', quantity: '', reorder_level: '' });
      setShowAddModal(false);
      setError('');
      await fetchData();
    } catch (error) {
      setError('Failed to add stock: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleEditStock = async () => {
    if (!selectedItem || !editData.quantity) {
      setError('Quantity is required');
      return;
    }

    try {
      setLoading(true);
      const newQuantity = parseInt(editData.quantity);
      const difference = newQuantity - selectedItem.quantity;
      const movementType = difference > 0 ? 'inbound' : 'outbound';

      await updateStockQuantity(
        selectedItem.id,
        Math.abs(difference),
        movementType,
        editData.reason || 'Manual adjustment'
      );

      setEditData({ quantity: '', reason: '' });
      setShowEditModal(false);
      setSelectedItem(null);
      setError('');
      await fetchData();
    } catch (error) {
      setError('Failed to update stock: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStock = async () => {
    if (!selectedItem) return;

    try {
      setLoading(true);
      await deleteStockItem(selectedItem.id);
      setShowDeleteModal(false);
      setSelectedItem(null);
      setError('');
      await fetchData();
    } catch (error) {
      setError('Failed to delete stock: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (item: any) => {
    setSelectedItem(item);
    setEditData({ quantity: item.quantity.toString(), reason: '' });
    setShowEditModal(true);
    setError('');
  };

  const openDeleteModal = (item: any) => {
    setSelectedItem(item);
    setShowDeleteModal(true);
    setError('');
  };

  const filteredItems = filterWarehouse
    ? stockItems.filter(item => item.warehouse_id === filterWarehouse)
    : stockItems;

  const lowStockCount = stockItems.filter(i => i.status === 'low_stock').length;
  const outOfStockCount = stockItems.filter(i => i.status === 'out_of_stock').length;
  const totalValue = stockItems.reduce((sum, item) => sum + item.quantity, 0);

  const getRacksForWarehouse = (warehouseId: number) => {
    return racks.filter(r => r.warehouse_id === warehouseId);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Stock Management</h1>
          <p className="text-gray-600">Manage warehouses, racks, and inventory</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
            <p className="text-gray-600 text-sm font-medium">Total Items</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{stockItems.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-400">
            <p className="text-gray-600 text-sm font-medium">Warehouses</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{warehouses.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-400">
            <p className="text-gray-600 text-sm font-medium">Low Stock</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">{lowStockCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-400">
            <p className="text-gray-600 text-sm font-medium">Out of Stock</p>
            <p className="text-3xl font-bold text-red-600 mt-2">{outOfStockCount}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-400">
            <p className="text-gray-600 text-sm font-medium">Total Units</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{totalValue.toLocaleString()}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('stock')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'stock'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
            >
              Stock Items
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'bulk'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
            >
              Bulk Operations
            </button>
            <button
              onClick={() => setActiveTab('warehouses')}
              className={`pb-3 px-1 font-medium text-sm border-b-2 transition-colors ${activeTab === 'warehouses'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
            >
              Warehouses
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Warehouse Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {warehouses.map(warehouse => (
                <div key={warehouse.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">{warehouse.name}</h3>
                      <p className="text-sm text-gray-600">{warehouse.location}</p>
                    </div>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                      {warehouse.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-gray-600">Code: <span className="font-medium">{warehouse.code}</span></p>
                    <p className="text-gray-600">Racks: <span className="font-medium">{warehouse.racks?.length || 0}</span></p>
                    <p className="text-gray-600">
                      Capacity: <span className="font-medium">{warehouse.available_space}/{warehouse.capacity}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Stock Items</h2>
                <button
                  onClick={() => {
                    setShowAddModal(true);
                    setError('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add Stock Item
                </button>
              </div>
              <select
                value={filterWarehouse || ''}
                onChange={(e) => setFilterWarehouse(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 border border-gray-300 text-gray-800 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">SKU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Warehouse</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Rack</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Available</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Reorder Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.sku}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.warehouse?.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.rack?.code ? item.rack.code : <span className="text-gray-400 italic">No rack assigned</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">{item.quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{item.available_quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.reorder_level}</td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                            item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                          }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Edit stock"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openDeleteModal(item)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete stock"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredItems.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-500">No stock items found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bulk' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Bulk Operations</h2>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                onClick={handleDownloadTemplate}
                className="border-2 border-dashed border-gray-300 text-gray-800 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              >
                <Download className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="font-medium text-gray-900 mb-1">Download Template</p>
                <p className="text-sm text-gray-600">CSV format for bulk upload</p>
              </div>

              <div className="border-2 border-dashed border-gray-300 text-gray-800 rounded-lg p-8">
                <label className="text-center hover:border-blue-500 transition-colors cursor-pointer block">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="font-medium text-gray-900 mb-1">Upload Stock File</p>
                  <p className="text-sm text-gray-600 mb-4">CSV or Excel file</p>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                {uploadFile && (
                  <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-200">
                    <p className="text-sm text-gray-900 font-medium">{uploadFile.name}</p>
                    <button
                      onClick={handleUpload}
                      disabled={loading}
                      className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                    >
                      {loading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'warehouses' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Warehouses</h2>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors">
                <Plus className="h-4 w-4" />
                Add Warehouse
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {warehouses.map(warehouse => (
                <div key={warehouse.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{warehouse.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">Code: {warehouse.code}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${warehouse.status === 'active' ? 'bg-green-100 text-green-800' :
                        warehouse.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {warehouse.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{warehouse.location}</p>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Racks:</span>
                      <span className="font-medium">{warehouse.racks?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Capacity Usage:</span>
                      <span className="font-medium">
                        {warehouse.capacity - warehouse.available_space}/{warehouse.capacity}
                      </span>
                    </div>
                    <div className="mt-2 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full"
                        style={{
                          width: `${((warehouse.capacity - warehouse.available_space) / warehouse.capacity) * 100}%`
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                      Edit
                    </button>
                    <button className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      View Racks
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Stock Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Add Stock Item</h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-6 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">SKU *</label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., SKU-001"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Warehouse *</label>
                <select
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value, rack_id: '' }))}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Rack (Optional)</label>
                <select
                  value={formData.rack_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, rack_id: e.target.value }))}
                  disabled={!formData.warehouse_id}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white disabled:bg-gray-100"
                >
                  <option value="">No specific rack</option>
                  {formData.warehouse_id && getRacksForWarehouse(parseInt(formData.warehouse_id)).map(r => (
                    <option key={r.id} value={r.id}>{r.code}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity *</label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reorder Level (Optional)</label>
                <input
                  type="number"
                  value={formData.reorder_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, reorder_level: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="10"
                  min="0"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setError('');
                }}
                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddStock}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Adding...' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Stock Item Modal */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Edit Stock: {selectedItem.sku}</h2>
                <p className="text-sm text-gray-600 mt-1">Current Quantity: {selectedItem.quantity}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mx-6 mt-6 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">New Quantity *</label>
                <input
                  type="number"
                  value={editData.quantity}
                  onChange={(e) => setEditData(prev => ({ ...prev, quantity: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder={selectedItem.quantity.toString()}
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Reason (Optional)</label>
                <textarea
                  value={editData.reason}
                  onChange={(e) => setEditData(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Stock adjustment, recount, damage"
                  rows={3}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-gray-600 mb-2">Change Summary:</p>
                <div className="space-y-1">
                  <p className="text-sm">
                    <span className="text-gray-600">Current:</span>
                    <span className="font-semibold text-gray-900 ml-2">{selectedItem.quantity}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">New:</span>
                    <span className="font-semibold text-gray-900 ml-2">{editData.quantity || 0}</span>
                  </p>
                  {editData.quantity && (
                    <p className="text-sm pt-2 border-t border-blue-200">
                      <span className="text-gray-600">Difference:</span>
                      <span className={`font-semibold ml-2 ${parseInt(editData.quantity) > selectedItem.quantity ? 'text-green-600' :
                          parseInt(editData.quantity) < selectedItem.quantity ? 'text-red-600' :
                            'text-gray-600'
                        }`}>
                        {parseInt(editData.quantity) > selectedItem.quantity ? '+' : ''}{parseInt(editData.quantity) - selectedItem.quantity}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setError('');
                }}
                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditStock}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Updating...' : 'Update Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Stock Item Confirmation Modal */}
      {showDeleteModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Delete Stock Item</h2>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900 mb-1">Warning</p>
                  <p className="text-sm text-red-700">This action cannot be undone. The stock item will be permanently deleted.</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-xs text-gray-600 mb-3 uppercase font-semibold">Item Details:</p>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="text-gray-600">SKU:</span>
                    <span className="font-semibold text-gray-900 ml-2">{selectedItem.sku}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Warehouse:</span>
                    <span className="font-semibold text-gray-900 ml-2">{selectedItem.warehouse?.name}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-gray-600">Quantity:</span>
                    <span className="font-semibold text-gray-900 ml-2">{selectedItem.quantity}</span>
                  </p>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setError('');
                }}
                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Keep Item
              </button>
              <button
                onClick={handleDeleteStock}
                disabled={loading}
                className="px-6 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Deleting...' : 'Delete Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}