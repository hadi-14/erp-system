'use client';

import { useState, useEffect } from 'react';
import { getTransits, createTransit, receiveTransit, getWarehouses, getStockItems } from '@/actions/stock';
import { Truck, Plus, Check, X, ArrowRight, Calendar, Package } from 'lucide-react';

interface TransitData {
    id: number;
    reference_no: string;
    status: string;
    from_warehouse?: { name: string };
    to_warehouse?: { name: string };
    shipped_date?: string;
    expected_delivery?: string;
    received_date?: string;
    items: Array<{
        id: number;
        stock_item?: { sku: string };
        quantity: number;
        received_quantity: number;
        status: string;
    }>;
}

export default function TransitManagement() {
    const [transits, setTransits] = useState<TransitData[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedTransit, setSelectedTransit] = useState<TransitData | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const [formData, setFormData] = useState({
        reference_no: '',
        from_warehouse: '',
        to_warehouse: '',
        items: [{ stock_item_id: '', quantity: '' }]
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [t, w, s] = await Promise.all([
                getTransits(),
                getWarehouses(),
                getStockItems()
            ]);
            setTransits(t);
            setWarehouses(w);
            setStockItems(s);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTransit = async () => {
        try {
            const items = formData.items
                .filter(item => item.stock_item_id && item.quantity)
                .map(item => ({
                    stock_item_id: parseInt(item.stock_item_id),
                    quantity: parseInt(item.quantity)
                }));

            if (!formData.reference_no || !formData.to_warehouse || items.length === 0) {
                alert('Please fill in all required fields');
                return;
            }

            await createTransit({
                reference_no: formData.reference_no,
                from_warehouse_id: formData.from_warehouse ? parseInt(formData.from_warehouse) : undefined,
                to_warehouse_id: parseInt(formData.to_warehouse),
                items
            });

            setFormData({ reference_no: '', from_warehouse: '', to_warehouse: '', items: [{ stock_item_id: '', quantity: '' }] });
            setShowCreateModal(false);
            await fetchData();
        } catch (error) {
            console.error('Failed to create transit:', error);
        }
    };

    const handleReceiveTransit = async (transitId: number) => {
        try {
            const transit = transits.find(t => t.id === transitId);
            if (!transit) return;

            const receivedItems = transit.items.map((item: any) => ({
                id: item.id,
                quantity: item.quantity
            }));

            await receiveTransit(transitId, receivedItems);
            await fetchData();
            setSelectedTransit(null);
        } catch (error) {
            console.error('Failed to receive transit:', error);
        }
    };

    const filteredTransits = filterStatus === 'all'
        ? transits
        : transits.filter(t => t.status === filterStatus);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            case 'in_transit': return 'bg-blue-100 text-blue-800 border-blue-300';
            case 'received': return 'bg-green-100 text-green-800 border-green-300';
            case 'cancelled': return 'bg-red-100 text-red-800 border-red-300';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusBgColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-50';
            case 'in_transit': return 'bg-blue-50';
            case 'received': return 'bg-green-50';
            case 'cancelled': return 'bg-red-50';
            default: return 'bg-gray-50';
        }
    };

    const addItemField = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { stock_item_id: '', quantity: '' }]
        }));
    };

    const removeItemField = (index: number) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const updateItemField = (index: number, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map((item, i) =>
                i === index ? { ...item, [field]: value } : item
            )
        }));
    };

    const totalItems = transits.reduce((sum, t) => sum + (t.items?.length || 0), 0);
    const totalUnits = transits.reduce((sum, t) => sum + t.items.reduce((s: number, i: any) => s + i.quantity, 0), 0);

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h1 className="text-4xl font-bold text-gray-900 mb-2">Transit Management</h1>
                            <p className="text-gray-600">Track inter-warehouse transfers and shipments</p>
                        </div>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
                        >
                            <Plus className="h-5 w-5" />
                            Create Transit
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-400">
                        <p className="text-gray-600 text-sm font-medium">Total Transits</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{transits.length}</p>
                        <p className="text-xs text-gray-500 mt-2">{totalUnits} units</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-400">
                        <p className="text-gray-600 text-sm font-medium">Pending</p>
                        <p className="text-3xl font-bold text-yellow-600 mt-2">
                            {transits.filter(t => t.status === 'pending').length}
                        </p>
                        <p className="text-xs text-yellow-600 mt-2">Awaiting shipment</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-400">
                        <p className="text-gray-600 text-sm font-medium">In Transit</p>
                        <p className="text-3xl font-bold text-blue-600 mt-2">
                            {transits.filter(t => t.status === 'in_transit').length}
                        </p>
                        <p className="text-xs text-blue-600 mt-2">On the way</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-400">
                        <p className="text-gray-600 text-sm font-medium">Received</p>
                        <p className="text-3xl font-bold text-green-600 mt-2">
                            {transits.filter(t => t.status === 'received').length}
                        </p>
                        <p className="text-xs text-green-600 mt-2">Completed</p>
                    </div>
                    <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-400">
                        <p className="text-gray-600 text-sm font-medium">Total Items</p>
                        <p className="text-3xl font-bold text-purple-600 mt-2">{totalItems}</p>
                        <p className="text-xs text-purple-600 mt-2">SKU count</p>
                    </div>
                </div>

                {/* Filter */}
                <div className="mb-6 flex gap-2 flex-wrap">
                    {['all', 'pending', 'in_transit', 'received', 'cancelled'].map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${filterStatus === status
                                    ? 'bg-blue-600 text-white shadow-md'
                                    : 'bg-white text-gray-700 border border-gray-300 text-gray-800 hover:border-gray-400 hover:shadow-sm'
                                }`}
                        >
                            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                        </button>
                    ))}
                </div>

                {/* Transit List */}
                <div className="space-y-4">
                    {filteredTransits.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-12 text-center">
                            <Truck className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 font-medium text-lg">No transits found</p>
                            <p className="text-gray-500 text-sm mt-1">Create a new transit to get started</p>
                        </div>
                    ) : (
                        filteredTransits.map(transit => (
                            <div key={transit.id} className={`rounded-lg shadow hover:shadow-lg transition-shadow border ${getStatusBgColor(transit.status)}`}>
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="text-lg font-semibold text-gray-900">{transit.reference_no}</h3>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(transit.status)}`}>
                                                    {transit.status.toUpperCase().replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                                                <div className="flex items-center gap-2">
                                                    <Warehouse className="h-4 w-4 text-gray-500" />
                                                    <span className="text-gray-600">From: <span className="font-medium text-gray-900">{transit.from_warehouse?.name || 'External'}</span></span>
                                                </div>
                                                <ArrowRight className="h-4 w-4 text-gray-400 hidden sm:block" />
                                                <div className="flex items-center gap-2">
                                                    <Warehouse className="h-4 w-4 text-gray-500" />
                                                    <span className="text-gray-600">To: <span className="font-medium text-gray-900">{transit.to_warehouse?.name || 'N/A'}</span></span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-2xl font-bold text-gray-900">{transit.items?.length || 0}</p>
                                            <p className="text-xs text-gray-500">items</p>
                                        </div>
                                    </div>

                                    {/* Items Table */}
                                    <div className="mb-4 -mx-6 px-6">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-white/50 border-t border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">SKU</th>
                                                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Qty Ordered</th>
                                                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Qty Received</th>
                                                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transit.items?.slice(0, 3).map((item: any) => (
                                                        <tr key={item.id} className="border-b border-gray-100 last:border-b-0 hover:bg-white/50">
                                                            <td className="px-3 py-2 font-medium text-gray-900">{item.stock_item?.sku || 'N/A'}</td>
                                                            <td className="px-3 py-2 text-gray-600">{item.quantity}</td>
                                                            <td className="px-3 py-2 text-gray-600">{item.received_quantity}</td>
                                                            <td className="px-3 py-2">
                                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.status === 'received' ? 'bg-green-100 text-green-800' :
                                                                        item.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                                                                            'bg-yellow-100 text-yellow-800'
                                                                    }`}>
                                                                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 pt-4 border-t border-gray-200">
                                        {transit.shipped_date && (
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">Shipped Date</p>
                                                <p className="text-sm text-gray-900 font-medium mt-1">{new Date(transit.shipped_date).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {transit.expected_delivery && (
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">Expected Delivery</p>
                                                <p className="text-sm text-gray-900 font-medium mt-1">{new Date(transit.expected_delivery).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                        {transit.received_date && (
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium">Received Date</p>
                                                <p className="text-sm text-gray-900 font-medium mt-1">{new Date(transit.received_date).toLocaleDateString()}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-4 border-t border-gray-200">
                                        {transit.status === 'pending' && (
                                            <button className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200">
                                                Mark In Transit
                                            </button>
                                        )}
                                        {transit.status === 'in_transit' && (
                                            <button
                                                onClick={() => handleReceiveTransit(transit.id)}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg font-medium hover:bg-green-100 transition-colors border border-green-200"
                                            >
                                                <Check className="h-4 w-4" />
                                                Receive Shipment
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setSelectedTransit(transit)}
                                            className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors border border-gray-300 text-gray-800"
                                        >
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Create Transit Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">Create New Transit</h2>
                                <p className="text-sm text-gray-600 mt-1">Add a new warehouse transfer</p>
                            </div>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Reference Number *</label>
                                <input
                                    type="text"
                                    value={formData.reference_no}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reference_no: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="e.g., TRN-001, TRN-002"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">From Warehouse (Optional)</label>
                                    <select
                                        value={formData.from_warehouse}
                                        onChange={(e) => setFormData(prev => ({ ...prev, from_warehouse: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    >
                                        <option value="">External Source</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">To Warehouse *</label>
                                    <select
                                        value={formData.to_warehouse}
                                        onChange={(e) => setFormData(prev => ({ ...prev, to_warehouse: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                                    >
                                        <option value="">Select warehouse</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-3">
                                    <label className="block text-sm font-semibold text-gray-700">Items *</label>
                                    <button
                                        onClick={addItemField}
                                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                        + Add Item
                                    </button>
                                </div>
                                <div className="space-y-3 max-h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    {formData.items.map((item, index) => (
                                        <div key={index} className="flex gap-2">
                                            <select
                                                value={item.stock_item_id}
                                                onChange={(e) => updateItemField(index, 'stock_item_id', e.target.value)}
                                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-sm"
                                            >
                                                <option value="">Select item</option>
                                                {stockItems.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.sku} (Avail: {s.available_quantity})
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => updateItemField(index, 'quantity', e.target.value)}
                                                className="w-28 px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                                                placeholder="Qty"
                                                min="1"
                                            />
                                            {formData.items.length > 1 && (
                                                <button
                                                    onClick={() => removeItemField(index)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                >
                                                    <X className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">Add items to be transferred</p>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3 justify-end sticky bottom-0 bg-white">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-6 py-2.5 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateTransit}
                                disabled={loading}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
                            >
                                {loading ? 'Creating...' : 'Create Transit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Transit Details Modal */}
            {selectedTransit && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 sticky top-0 bg-white flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-gray-900">Transit Details: {selectedTransit.reference_no}</h2>
                            <button
                                onClick={() => setSelectedTransit(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Header Info */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-600 font-medium mb-1">Status</p>
                                    <p className={`text-sm font-semibold ${selectedTransit.status === 'pending' ? 'text-yellow-600' :
                                            selectedTransit.status === 'in_transit' ? 'text-blue-600' :
                                                selectedTransit.status === 'received' ? 'text-green-600' :
                                                    'text-red-600'
                                        }`}>{selectedTransit.status.toUpperCase().replace('_', ' ')}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-600 font-medium mb-1">Total Items</p>
                                    <p className="text-2xl font-bold text-gray-900">{selectedTransit.items?.length || 0}</p>
                                </div>
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <p className="text-xs text-gray-600 font-medium mb-1">Total Units</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {selectedTransit.items?.reduce((sum, item) => sum + item.quantity, 0) || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Route */}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <p className="text-sm font-semibold text-gray-900 mb-3">Route</p>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs text-gray-600 mb-1">From</p>
                                        <p className="font-semibold text-gray-900">{selectedTransit.from_warehouse?.name || 'External'}</p>
                                    </div>
                                    <ArrowRight className="h-6 w-6 text-blue-600 flex-shrink-0" />
                                    <div className="text-right">
                                        <p className="text-xs text-gray-600 mb-1">To</p>
                                        <p className="font-semibold text-gray-900">{selectedTransit.to_warehouse?.name}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Dates */}
                            <div>
                                <p className="text-sm font-semibold text-gray-900 mb-3">Timeline</p>
                                <div className="space-y-2">
                                    {selectedTransit.shipped_date && (
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <span className="text-sm text-gray-600">Shipped:</span>
                                            <span className="font-medium text-gray-900">{new Date(selectedTransit.shipped_date).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {selectedTransit.expected_delivery && (
                                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <span className="text-sm text-gray-600">Expected Delivery:</span>
                                            <span className="font-medium text-gray-900">{new Date(selectedTransit.expected_delivery).toLocaleString()}</span>
                                        </div>
                                    )}
                                    {selectedTransit.received_date && (
                                        <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                                            <span className="text-sm text-gray-600">Received:</span>
                                            <span className="font-medium text-green-700">{new Date(selectedTransit.received_date).toLocaleString()}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Items Table */}
                            <div>
                                <p className="text-sm font-semibold text-gray-900 mb-3">Items</p>
                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                    <table className="w-full">
                                        <thead className="bg-gray-100 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">SKU</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Ordered</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Received</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Pending</th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {selectedTransit.items?.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.stock_item?.sku}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{item.quantity}</td>
                                                    <td className="px-4 py-3 text-sm text-gray-600">{item.received_quantity}</td>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                        {item.quantity - item.received_quantity}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${item.status === 'received' ? 'bg-green-100 text-green-800' :
                                                                item.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                                                                    'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                            <button
                                onClick={() => setSelectedTransit(null)}
                                className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
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