'use client';

import { useState, useEffect } from 'react';
import { getWarehouses, createWarehouse, updateWarehouse, getRacks, getStockItems } from '@/actions/stock';
import { Plus, Warehouse, Edit2, Trash2, MapPin, Grid3X3, Package, AlertCircle, X } from 'lucide-react';

interface WarehouseData {
    id: number;
    code: string;
    name: string;
    location: string;
    capacity: number;
    available_space: number;
    status: string;
    created_at: Date;
    racks?: any[];
}

export default function WarehousesManagement() {
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
    const [allRacks, setAllRacks] = useState<any[]>([]);
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseData | null>(null);
    const [viewType, setViewType] = useState<'grid' | 'list'>('grid');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        code: '',
        name: '',
        location: '',
        capacity: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [w, r, s] = await Promise.all([
                getWarehouses(),
                getRacks(),
                getStockItems()
            ]);
            setWarehouses(w);
            setAllRacks(r);
            setStockItems(s);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            setError('Failed to load warehouses');
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        if (!formData.code.trim()) {
            setError('Warehouse code is required');
            return false;
        }
        if (!formData.name.trim()) {
            setError('Warehouse name is required');
            return false;
        }
        if (!formData.location.trim()) {
            setError('Location is required');
            return false;
        }
        if (!formData.capacity || parseInt(formData.capacity) <= 0) {
            setError('Capacity must be greater than 0');
            return false;
        }
        setError('');
        return true;
    };

    const handleCreateWarehouse = async () => {
        if (!validateForm()) return;

        try {
            setLoading(true);
            await createWarehouse({
                code: formData.code.trim(),
                name: formData.name.trim(),
                location: formData.location.trim(),
                capacity: parseInt(formData.capacity)
            });

            setFormData({ code: '', name: '', location: '', capacity: '' });
            setShowCreateModal(false);
            setError('');
            await fetchData();
        } catch (error) {
            setError('Failed to create warehouse');
            console.error('Failed to create warehouse:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditWarehouse = async () => {
        if (!selectedWarehouse || !validateForm()) return;

        try {
            setLoading(true);
            await updateWarehouse(selectedWarehouse.id, {
                code: formData.code || selectedWarehouse.code,
                name: formData.name || selectedWarehouse.name,
                location: formData.location || selectedWarehouse.location,
                capacity: formData.capacity ? parseInt(formData.capacity) : selectedWarehouse.capacity,
                status: selectedWarehouse.status
            });

            setFormData({ code: '', name: '', location: '', capacity: '' });
            setShowEditModal(false);
            setSelectedWarehouse(null);
            setError('');
            await fetchData();
        } catch (error) {
            setError('Failed to update warehouse');
            console.error('Failed to update warehouse:', error);
        } finally {
            setLoading(false);
        }
    };

    const openEditModal = (warehouse: WarehouseData) => {
        setSelectedWarehouse(warehouse);
        setFormData({
            code: warehouse.code,
            name: warehouse.name,
            location: warehouse.location,
            capacity: warehouse.capacity.toString()
        });
        setShowEditModal(true);
        setError('');
    };

    const closeModals = () => {
        setShowCreateModal(false);
        setShowEditModal(false);
        setSelectedWarehouse(null);
        setFormData({ code: '', name: '', location: '', capacity: '' });
        setError('');
    };

    const getWarehouseStats = (warehouse: WarehouseData) => {
        const racks = allRacks.filter(r => r.warehouse_id === warehouse.id);
        const items = stockItems.filter(s => s.warehouse_id === warehouse.id);
        const usedCapacity = warehouse.capacity - warehouse.available_space;
        const usagePercent = Math.round((usedCapacity / warehouse.capacity) * 100);

        return {
            rackCount: racks.length,
            itemCount: items.length,
            totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
            usedCapacity,
            usagePercent,
            capacityStatus: usagePercent >= 90 ? 'critical' : usagePercent >= 75 ? 'high' : usagePercent >= 50 ? 'moderate' : 'low'
        };
    };

    const getProgressBarColor = (status: string) => {
        switch (status) {
            case 'critical': return 'bg-red-500';
            case 'high': return 'bg-yellow-500';
            case 'moderate': return 'bg-blue-500';
            default: return 'bg-green-500';
        }
    };

    const totalCapacity = warehouses.reduce((sum, w) => sum + w.capacity, 0);
    const totalUsed = warehouses.reduce((sum, w) => sum + (w.capacity - w.available_space), 0);
    const totalUtilization = totalCapacity > 0 ? Math.round((totalUsed / totalCapacity) * 100) : 0;
    const activeWarehouses = warehouses.filter(w => w.status === 'active').length;

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">Warehouses</h1>
                            <p className="text-gray-600">Manage and monitor all warehouse locations</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowCreateModal(true);
                                setError('');
                            }}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                        >
                            <Plus className="h-5 w-5" />
                            Add Warehouse
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
                        <p className="text-gray-600 text-sm font-medium">Total Warehouses</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{warehouses.length}</p>
                        <p className="text-xs text-blue-600 mt-2">{activeWarehouses} active</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-400">
                        <p className="text-gray-600 text-sm font-medium">Total Capacity</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{totalCapacity.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-2">units</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-400">
                        <p className="text-gray-600 text-sm font-medium">Used Capacity</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{totalUsed.toLocaleString()}</p>
                        <p className="text-xs text-purple-600 mt-2">{totalUtilization}% utilized</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-400">
                        <p className="text-gray-600 text-sm font-medium">Available</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{(totalCapacity - totalUsed).toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-2">capacity left</p>
                    </div>
                </div>

                {/* View Toggle */}
                <div className="mb-6 flex gap-2 justify-between items-center">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewType('grid')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${viewType === 'grid'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-300 text-gray-800 hover:border-gray-400'
                                }`}
                        >
                            Grid View
                        </button>
                        <button
                            onClick={() => setViewType('list')}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${viewType === 'list'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-white text-gray-700 border border-gray-300 text-gray-800 hover:border-gray-400'
                                }`}
                        >
                            List View
                        </button>
                    </div>
                    <div className="text-sm text-gray-600">
                        Showing {warehouses.length} warehouse{warehouses.length !== 1 ? 's' : ''}
                    </div>
                </div>

                {/* Grid View */}
                {viewType === 'grid' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {warehouses.map(warehouse => {
                            const stats = getWarehouseStats(warehouse);
                            return (
                                <div key={warehouse.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-all overflow-hidden group">
                                    <div className={`h-1 ${getProgressBarColor(stats.capacityStatus)}`} />

                                    <div className="p-6">
                                        {/* Header */}
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{warehouse.name}</h3>
                                                <p className="text-sm text-gray-600 mt-1 font-mono">{warehouse.code}</p>
                                            </div>
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ml-2 ${warehouse.status === 'active'
                                                ? 'bg-green-100 text-green-800 border-green-300'
                                                : warehouse.status === 'maintenance'
                                                    ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                                    : 'bg-gray-100 text-gray-800 border-gray-300 text-gray-800'
                                                }`}>
                                                {warehouse.status.charAt(0).toUpperCase() + warehouse.status.slice(1)}
                                            </span>
                                        </div>

                                        {/* Location */}
                                        <div className="flex items-start gap-2 mb-4">
                                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                            <p className="text-sm text-gray-600">{warehouse.location}</p>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 gap-3 mb-4 py-4 border-y border-gray-200">
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-600 font-medium mb-1">Racks</p>
                                                <p className="text-2xl font-bold text-gray-900">{stats.rackCount}</p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-600 font-medium mb-1">Items</p>
                                                <p className="text-2xl font-bold text-gray-900">{stats.itemCount}</p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-600 font-medium mb-1">Units</p>
                                                <p className="text-lg font-bold text-gray-900">{stats.totalQuantity}</p>
                                            </div>
                                            <div className="bg-gray-50 p-3 rounded-lg">
                                                <p className="text-xs text-gray-600 font-medium mb-1">Usage</p>
                                                <p className="text-lg font-bold text-gray-900">{stats.usagePercent}%</p>
                                            </div>
                                        </div>

                                        {/* Capacity Bar */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-medium text-gray-700">Capacity</span>
                                                <span className="text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                                    {stats.usedCapacity}/{warehouse.capacity}
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                                <div
                                                    className={`h-full transition-all duration-500 rounded-full ${getProgressBarColor(stats.capacityStatus)}`}
                                                    style={{ width: `${stats.usagePercent}%` }}
                                                />
                                            </div>
                                            {stats.capacityStatus === 'critical' && (
                                                <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">
                                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                    Capacity critical - Consider expansion
                                                </div>
                                            )}
                                            {stats.capacityStatus === 'high' && (
                                                <div className="mt-3 flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 px-3 py-2 rounded border border-yellow-200">
                                                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                                    High capacity usage
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="bg-gray-50 p-4 border-t border-gray-200 flex gap-2">
                                        <button
                                            onClick={() => openEditModal(warehouse)}
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-200"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                            Edit
                                        </button>
                                        <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors border border-gray-300 text-gray-800">
                                            <Grid3X3 className="h-4 w-4" />
                                            Racks
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* List View */}
                {viewType === 'list' && (
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-100 border-b-2 border-gray-300 text-gray-800">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Warehouse</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Location</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Racks</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Items</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Capacity</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {warehouses.map(warehouse => {
                                        const stats = getWarehouseStats(warehouse);
                                        return (
                                            <tr key={warehouse.id} className="hover:bg-blue-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-semibold text-gray-900">{warehouse.name}</p>
                                                        <p className="text-xs text-gray-600 font-mono mt-0.5">{warehouse.code}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-600">{warehouse.location}</td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-700 font-bold rounded-full">
                                                        {stats.rackCount}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm">
                                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 font-bold rounded-full">
                                                        {stats.itemCount}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="flex items-center justify-between mb-1">
                                                            <p className="text-sm font-medium text-gray-900">{stats.usedCapacity}/{warehouse.capacity}</p>
                                                            <p className="text-xs font-bold text-gray-700">{stats.usagePercent}%</p>
                                                        </div>
                                                        <div className="w-32 bg-gray-200 rounded-full h-2 overflow-hidden">
                                                            <div
                                                                className={`h-full ${getProgressBarColor(stats.capacityStatus)}`}
                                                                style={{ width: `${stats.usagePercent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold border ${warehouse.status === 'active'
                                                        ? 'bg-green-100 text-green-800 border-green-300'
                                                        : warehouse.status === 'maintenance'
                                                            ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                                                            : 'bg-gray-100 text-gray-800 border-gray-300 text-gray-800'
                                                        }`}>
                                                        {warehouse.status.charAt(0).toUpperCase() + warehouse.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex gap-1">
                                                        <button
                                                            onClick={() => openEditModal(warehouse)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            title="Edit warehouse"
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </button>
                                                        <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Delete warehouse">
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {warehouses.length === 0 && (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <Warehouse className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 font-medium text-lg">No warehouses yet</p>
                        <p className="text-gray-500 text-sm mt-1">Create your first warehouse to get started</p>
                        <button
                            onClick={() => {
                                setShowCreateModal(true);
                                setError('');
                            }}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                        >
                            Create Warehouse
                        </button>
                    </div>
                )}
            </div>

            {/* Create Warehouse Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Add New Warehouse</h2>
                                <p className="text-sm text-gray-600 mt-1">Create a new warehouse location</p>
                            </div>
                            <button
                                onClick={closeModals}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
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

                        <div className={`p-6 space-y-4 ${error ? 'mt-0' : ''}`}>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Warehouse Code *</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., WH-01, NYC-01"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Warehouse Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., Main Warehouse, East Coast Hub"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Location *</label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., 123 Industrial Ave, New York, NY"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Capacity (Units) *</label>
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., 10000"
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                            <button
                                onClick={closeModals}
                                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateWarehouse}
                                disabled={loading}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                            >
                                {loading ? 'Creating...' : 'Create Warehouse'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Warehouse Modal */}
            {showEditModal && selectedWarehouse && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
                        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Edit Warehouse</h2>
                                <p className="text-sm text-gray-600 mt-1">Update warehouse information</p>
                            </div>
                            <button
                                onClick={closeModals}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
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

                        <div className={`p-6 space-y-4 ${error ? 'mt-0' : ''}`}>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Warehouse Code</label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={selectedWarehouse.code}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Warehouse Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={selectedWarehouse.name}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={formData.location}
                                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={selectedWarehouse.location}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Capacity (Units)</label>
                                <input
                                    type="number"
                                    value={formData.capacity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder={selectedWarehouse.capacity.toString()}
                                    min="1"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end">
                            <button
                                onClick={closeModals}
                                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditWarehouse}
                                disabled={loading}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                            >
                                {loading ? 'Updating...' : 'Update Warehouse'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}