'use client';

import { useState, useEffect } from 'react';
import { getRacks, createRack, getWarehouses, getStockItems } from '@/actions/stock';
import { Plus, Layers, Filter } from 'lucide-react';

export default function RackManagement() {
  const [racks, setRacks] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [filterWarehouse, setFilterWarehouse] = useState<number | null>(null);
  const [selectedRack, setSelectedRack] = useState<any>(null);

  const [formData, setFormData] = useState({
    warehouse_id: '',
    code: '',
    level: '',
    capacity: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [r, w, s] = await Promise.all([
        getRacks(),
        getWarehouses(),
        getStockItems()
      ]);
      setRacks(r);
      setWarehouses(w);
      setStockItems(s);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRack = async () => {
    if (!formData.warehouse_id || !formData.code || !formData.level || !formData.capacity) {
      alert('Please fill all fields');
      return;
    }

    try {
      await createRack({
        warehouse_id: parseInt(formData.warehouse_id),
        code: formData.code,
        level: parseInt(formData.level),
        capacity: parseInt(formData.capacity)
      });

      setFormData({ warehouse_id: '', code: '', level: '', capacity: '' });
      setShowModal(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to create rack:', error);
    }
  };

  const filteredRacks = filterWarehouse
    ? racks.filter(r => r.warehouse_id === filterWarehouse)
    : racks;

  const getRackUsage = (rack: any) => {
    const items = stockItems.filter(s => s.rack_id === rack.id);
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    return { items: items.length, totalQuantity };
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Rack Management</h1>
              <p className="text-gray-600">Organize and manage warehouse racks</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Rack
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium">Total Racks</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{racks.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium">Active</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {racks.filter(r => r.status === 'active').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium">Avg Capacity Used</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {racks.length > 0
                ? Math.round(
                  (racks.reduce((sum, r) => sum + (r.capacity - r.available_space), 0) /
                    racks.reduce((sum, r) => sum + r.capacity, 0)) *
                  100
                ) + '%'
                : '0%'}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium">Total Stored</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {stockItems.filter(s => s.rack_id !== null).reduce((sum, s) => sum + s.quantity, 0)}
            </p>
          </div>
        </div>

        {/* Filter */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilterWarehouse(null)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filterWarehouse === null
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 text-gray-800 hover:bg-gray-50'
              }`}
          >
            All Warehouses
          </button>
          {warehouses.map(w => (
            <button
              key={w.id}
              onClick={() => setFilterWarehouse(w.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${filterWarehouse === w.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 text-gray-800 hover:bg-gray-50'
                }`}
            >
              {w.code}
            </button>
          ))}
        </div>

        {/* Racks Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRacks.map(rack => {
            const usage = getRackUsage(rack);
            const usagePercent = ((rack.capacity - rack.available_space) / rack.capacity) * 100;

            return (
              <div
                key={rack.id}
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{rack.code}</h3>
                      <p className="text-sm text-gray-600">{rack.warehouse.name}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${rack.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                      }`}>
                      {rack.status}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Level</span>
                        <span className="text-sm font-bold text-gray-900">{rack.level}</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">Items Stored</span>
                        <span className="text-sm font-bold text-gray-900">{usage.items}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Capacity</span>
                        <span className="text-sm font-bold text-gray-900">
                          {rack.capacity - rack.available_space}/{rack.capacity}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-medium text-gray-600">Utilization</span>
                        <span className="text-xs font-bold text-gray-900">{Math.round(usagePercent)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full transition-all ${usagePercent > 90 ? 'bg-red-500' :
                              usagePercent > 70 ? 'bg-yellow-500' :
                                'bg-green-500'
                            }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>

                    {usage.totalQuantity > 0 && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                          Total Units: <span className="font-bold text-gray-900">{usage.totalQuantity}</span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 border-t border-gray-200 flex gap-2">
                  <button
                    onClick={() => setSelectedRack(rack)}
                    className="flex-1 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    View Items
                  </button>
                  <button className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                    Edit
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRacks.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Layers className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No racks found</p>
          </div>
        )}
      </div>

      {/* Create Rack Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Add New Rack</h2>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Warehouse</label>
                <select
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, warehouse_id: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Rack Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., RACK-A1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Level</label>
                <input
                  type="number"
                  value={formData.level}
                  onChange={(e) => setFormData(prev => ({ ...prev, level: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1, 2, 3"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Capacity (Units)</label>
                <input
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 1000"
                  min="1"
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRack}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? 'Creating...' : 'Create Rack'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rack Details Modal */}
      {selectedRack && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">{selectedRack.code}</h2>
                <button
                  onClick={() => setSelectedRack(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Warehouse</p>
                  <p className="font-semibold text-gray-900">{selectedRack.warehouse.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Level</p>
                  <p className="font-semibold text-gray-900">{selectedRack.level}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Capacity</p>
                  <p className="font-semibold text-gray-900">{selectedRack.capacity} units</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Status</p>
                  <p className="font-semibold text-gray-900 capitalize">{selectedRack.status}</p>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-4">Items in this Rack</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                {stockItems.filter(s => s.rack_id === selectedRack.id).length === 0 ? (
                  <div className="p-6 text-center text-gray-600">
                    No items stored in this rack
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Available</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stockItems.filter(s => s.rack_id === selectedRack.id).map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.sku}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.available_quantity}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${item.status === 'in_stock' ? 'bg-green-100 text-green-800' :
                                item.status === 'low_stock' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                              }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedRack(null)}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}