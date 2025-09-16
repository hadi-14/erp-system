// app/orders/page.tsx
'use client';

import { useState, useEffect, useTransition } from 'react';
import Image from 'next/image';
import { updateOrderApproval, bulkUpdateOrderApproval, getOrdersWithProducts, getOrderStats, getProductDetails } from '@/actions/admin/orders';
import { TrendingUp, Users, Package, DollarSign, Eye, X, ChevronDown, ChevronUp, Square, CheckSquare, Image as ImageIcon } from 'lucide-react';

// Updated types to match the serialized data structure from orders.ts
interface Product {
  productID: string;
  name: string;
  quantity: string;
  price: number;
  itemAmount: number;
  productImgUrl: string | null;
  product_list_en?: {
    productID: string;
    name: string;
    price: number;
    productImgUrl: string;
    productSnapshotUrl: string;
    unit: string;
  } | null;
}

interface Order {
  id: string;
  baseInfo_id: string;
  baseInfo_createTime: Date | null;
  baseInfo_totalAmount: number | null;
  baseInfo_status: string | null;
  baseInfo_buyerID: string | null;
  baseInfo_buyerContact_name: string | null;
  baseInfo_buyerContact_companyName: string | null;
  approved_: boolean | null;
  products: Product[];
}

interface OrderStats {
  total: number;
  approved: number;
  pending: number;
  totalValue: number;
  topBuyers: Array<{
    baseInfo_buyerID: string;
    baseInfo_buyerContact_name: string;
    baseInfo_buyerContact_companyName: string;
    _count: { id: number };
    _sum: { baseInfo_totalAmount: number };
  }>;
  topProducts: Array<{
    productItems_productID: string;
    productItems_name: string;
    _count: { id: number };
    _sum: { productItems_quantity: string; productItems_itemAmount: number };
  }>;
}

interface ProductDetails {
  product: {
    productID: string;
    name: string;
    price: number;
    productImgUrl: string;
    productSnapshotUrl: string;
    unit: string;
  } | null;
  relatedOrders: Array<{
    baseInfo_id: string;
    baseInfo_createTime: Date | null;
    baseInfo_status: string | null;
    baseInfo_buyerContact_name: string | null;
    productItems_quantity: string | null;
    productItems_price: number | null;
    approved_: boolean | null;
  }>;
  likesCount: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  // const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [showStatsDetails, setShowStatsDetails] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const ordersPerPage = 10;

  // Load orders and stats on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [fetchedOrders, fetchedStats] = await Promise.all([
          getOrdersWithProducts(),
          getOrderStats(),
        ]);
        setOrders(fetchedOrders);
        setStats(fetchedStats);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Handle product modal
  const handleProductModal = async (productId: string) => {
    // setSelectedProductId(productId);
    try {
      const details = await getProductDetails(productId);
      setProductDetails(details);
      setShowProductModal(true);
    } catch (error) {
      console.error('Error fetching product details:', error);
    }
  };

  // Filter orders based on approval status and search term
  const filteredOrders = orders.filter(order => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'approved' && order.approved_) ||
      (filter === 'pending' && !order.approved_);

    const matchesSearch =
      searchTerm === '' ||
      order.baseInfo_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.baseInfo_buyerContact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.baseInfo_buyerContact_companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.products.some(product =>
        product.product_list_en?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

    return matchesFilter && matchesSearch;
  });

  // Pagination
  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);

  // Handle individual order selection
  const handleOrderSelect = (orderId: string) => {
    const newSelectedOrders = new Set(selectedOrders);
    if (newSelectedOrders.has(orderId)) {
      newSelectedOrders.delete(orderId);
    } else {
      newSelectedOrders.add(orderId);
    }
    setSelectedOrders(newSelectedOrders);
    setSelectAll(newSelectedOrders.size === currentOrders.length);
  };

  // Handle select all orders on current page
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedOrders(new Set());
      setSelectAll(false);
    } else {
      const currentOrderIds = currentOrders.map(order => order.baseInfo_id);
      setSelectedOrders(new Set(currentOrderIds));
      setSelectAll(true);
    }
  };

  // Handle approval toggle
  const handleApprovalToggle = (orderId: string, currentStatus: boolean) => {
    startTransition(async () => {
      try {
        const result = await updateOrderApproval(orderId, !currentStatus);

        if (result.success) {
          setOrders(prevOrders =>
            prevOrders.map(order =>
              order.baseInfo_id === orderId
                ? { ...order, approved_: !currentStatus }
                : order
            )
          );
        } else {
          alert(result.error || 'Failed to update order approval status');
        }
      } catch (error) {
        console.error('Error updating approval:', error);
        alert('Error updating order approval status');
      }
    });
  };

  // Bulk approve selected orders
  const handleBulkApproval = (approve: boolean, useSelected: boolean = false) => {
    const orderIds = useSelected && selectedOrders.size > 0
      ? Array.from(selectedOrders)
      : currentOrders
        .filter(order => order.approved_ !== approve)
        .map(order => order.baseInfo_id);

    if (orderIds.length === 0) {
      alert(`No orders to ${approve ? 'approve' : 'unapprove'}`);
      return;
    }

    const actionText = useSelected ? 'selected' : 'visible';
    if (!confirm(`Are you sure you want to ${approve ? 'approve' : 'unapprove'} ${orderIds.length} ${actionText} orders?`)) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdateOrderApproval(orderIds, approve);

        if (result.success) {
          setOrders(prevOrders =>
            prevOrders.map(order =>
              orderIds.includes(order.baseInfo_id)
                ? { ...order, approved_: approve }
                : order
            )
          );

          // Clear selection if we were working with selected orders
          if (useSelected) {
            setSelectedOrders(new Set());
            setSelectAll(false);
          }

          alert(`Successfully ${approve ? 'approved' : 'unapproved'} ${result.count} order items`);
        } else {
          alert(result.error || 'Failed to update orders');
        }
      } catch (error) {
        console.error('Error bulk updating orders:', error);
        alert('Error updating orders');
      }
    });
  };

  const formatCurrency = (amount: number | null) => {
    return amount ? `$${amount.toFixed(2)}` : 'N/A';
  };

  const formatDate = (date: Date | null) => {
    return date ? new Date(date).toLocaleDateString() : 'N/A';
  };

  const getStatusBadge = (status: string | null) => {
    const statusColors = {
      'waitbuyerreceive': 'bg-green-100 text-green-800',
      'waitsellersend': 'bg-yellow-100 text-yellow-800',
      'cancel': 'bg-red-100 text-red-800',
      'waitbuyerpay': 'bg-gray-100 text-gray-800',
    };

    const colorClass = statusColors[status as keyof typeof statusColors] || 'bg-blue-100 text-blue-800';

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colorClass}`}>
        {status || 'Unknown'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          <p className="mt-2 text-gray-600">Manage and approve orders from your 1688 store</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Approved</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.approved.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    {stats.total > 0 ? ((stats.approved / stats.total) * 100).toFixed(1) : 0}% approval rate
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pending.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">
                    {stats.total > 0 ? ((stats.pending / stats.total) * 100).toFixed(1) : 0}% pending
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Value</p>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalValue)}</p>
                  <p className="text-xs text-gray-500">
                    Avg: {formatCurrency(stats.total > 0 ? stats.totalValue / stats.total : 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Top Performance Cards */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <button
                onClick={() => setShowStatsDetails(!showStatsDetails)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-semibold text-gray-900">Performance Overview</h3>
                {showStatsDetails ? (
                  <ChevronUp className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                )}
              </button>
            </div>

            {showStatsDetails && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Top Buyers</h4>
                  <div className="space-y-3">
                    {stats.topBuyers.slice(0, 5).map((buyer, index) => (
                      <div key={buyer.baseInfo_buyerID} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {buyer.baseInfo_buyerContact_name || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {buyer.baseInfo_buyerContact_companyName || 'No company'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {buyer._count.id} orders
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatCurrency(buyer._sum.baseInfo_totalAmount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-md font-semibold text-gray-900 mb-4">Top Products</h4>
                  <div className="space-y-3">
                    {stats.topProducts.slice(0, 5).map((product, index) => (
                      <div key={product.productItems_productID} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {product.productItems_name || 'N/A'}
                            </p>
                            <p className="text-xs text-gray-500">
                              ID: {product.productItems_productID}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">
                            {product._count.id} orders
                          </p>
                          <p className="text-xs text-gray-500">
                            {product._sum.productItems_quantity} units
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters, Search, and Selection Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
                  <select
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="block w-48 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-700"
                  >
                    <option value="all">All Orders</option>
                    <option value="approved">Approved</option>
                    <option value="pending">Pending Approval</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                  <input
                    type="text"
                    placeholder="Search orders, buyers, products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-64 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Selection and Bulk Actions */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between border-t pt-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
                >
                  {selectAll ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  Select All Visible ({currentOrders.length})
                </button>
                {selectedOrders.size > 0 && (
                  <div className="text-sm text-gray-600">
                    {selectedOrders.size} order{selectedOrders.size > 1 ? 's' : ''} selected
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {/* Bulk actions for all visible orders */}
                <button
                  onClick={() => handleBulkApproval(true, false)}
                  disabled={isPending}
                  className="px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Processing...' : 'Approve All Visible'}
                </button>
                <button
                  onClick={() => handleBulkApproval(false, false)}
                  disabled={isPending}
                  className="px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Processing...' : 'Unapprove All Visible'}
                </button>

                {/* Bulk actions for selected orders */}
                {selectedOrders.size > 0 && (
                  <>
                    <div className="border-l border-gray-300 mx-2"></div>
                    <button
                      onClick={() => handleBulkApproval(true, true)}
                      disabled={isPending}
                      className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Approve Selected ({selectedOrders.size})
                    </button>
                    <button
                      onClick={() => handleBulkApproval(false, true)}
                      disabled={isPending}
                      className="px-3 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Unapprove Selected ({selectedOrders.size})
                    </button>
                    <button
                      onClick={() => {
                        setSelectedOrders(new Set());
                        setSelectAll(false);
                      }}
                      className="px-3 py-2 bg-gray-500 text-white text-sm font-medium rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Clear Selection
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden relative">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center justify-center w-5 h-5"
                    >
                      {selectAll ? (
                        <CheckSquare className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Buyer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Products
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Approval
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentOrders.map((order) => {
                  const orderId = order.baseInfo_id;
                  const isSelected = selectedOrders.has(orderId);

                  return (
                    <tr key={order.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-blue-200' : ''}`}>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleOrderSelect(orderId)}
                          className="flex items-center justify-center w-5 h-5"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-blue-600" />
                          ) : (
                            <Square className="h-4 w-4 text-gray-400 hover:text-blue-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.baseInfo_id || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(order.baseInfo_createTime)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div>
                          <div className="font-medium">{order.baseInfo_buyerContact_name || 'N/A'}</div>
                          <div className="text-gray-500 text-xs">{order.baseInfo_buyerContact_companyName}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="space-y-1">
                          {order.products.slice(0, 2).map((product, index) => {
                            const productName = product.product_list_en?.name || `Product ${product.productID}`;
                            return (
                              <div
                                key={index}
                                className="cursor-pointer flex items-center gap-2"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate max-w-xs">{productName}</div>
                                  <div className="text-gray-500 text-xs">
                                    Qty: {product.quantity} × {formatCurrency(product.price)}
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleProductModal(product.productID)}
                                  className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
                                >
                                  <Eye className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                                </button>
                              </div>
                            );
                          })}
                          {order.products.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{order.products.length - 2} more products
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(order.baseInfo_totalAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(order.baseInfo_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleApprovalToggle(order.baseInfo_id, order.approved_ || false)}
                          disabled={isPending}
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${order.approved_
                              ? 'bg-green-100 text-green-800 hover:bg-green-200'
                              : 'bg-red-100 text-red-800 hover:bg-red-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isPending ? '...' : order.approved_ ? '✓ Approved' : '✗ Pending'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>


          {currentOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg font-medium mb-2">No orders found</p>
              <p className="text-gray-400 text-sm">Try adjusting your filters or search terms</p>
            </div>
          )}
        </div>

        {/* Product Details Modal */}
        {showProductModal && productDetails && productDetails.product && (
          <div className="fixed inset-0 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-start justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Product Details</h3>
                <button
                  onClick={() => setShowProductModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {productDetails.product.productImgUrl ? (
                    <Image
                      src={productDetails.product.productImgUrl}
                      alt={productDetails.product.name}
                      width={800}
                      height={256}
                      className="w-full h-64 object-cover rounded-lg mb-4"
                      unoptimized={!!productDetails.product.productImgUrl && productDetails.product.productImgUrl.startsWith('http')}
                    />
                  ) : (
                    <div className="w-full h-64 flex items-center justify-center bg-gray-100 rounded-lg mb-4">
                      <ImageIcon className="h-20 w-20 text-gray-400" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <h4 className="font-semibold text-gray-900 text-lg">{productDetails.product.name}</h4>
                    <div className="flex items-center gap-4">
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(productDetails.product.price)}
                      </p>
                      <span className="text-sm text-gray-500">per {productDetails.product.unit}</span>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Product ID:</span> {productDetails.product.productID}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setShowProductModal(false)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-6 rounded-lg shadow-sm">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-700 px-4 py-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{indexOfFirstOrder + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(indexOfLastOrder, filteredOrders.length)}</span> of{' '}
                  <span className="font-medium">{filteredOrders.length}</span> results
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Previous</span>
                    <ChevronDown className="h-5 w-5 rotate-90" />
                  </button>

                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 7) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 4) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNumber = totalPages - 6 + i;
                    } else {
                      pageNumber = currentPage - 3 + i;
                    }

                    return (
                      <button
                        key={pageNumber}
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${currentPage === pageNumber
                            ? 'z-10 bg-blue-600 text-white focus:z-20 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                            : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                          }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="sr-only">Next</span>
                    <ChevronDown className="h-5 w-5 -rotate-90" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">
              Showing {currentOrders.length} of {filteredOrders.length} filtered orders
              {filteredOrders.length !== orders.length && (
                <span className="ml-1">
                  ({orders.length} total orders)
                </span>
              )}
            </p>
            {filteredOrders.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {((filteredOrders.filter(order => order.approved_).length / filteredOrders.length) * 100).toFixed(1)}%
                of filtered orders are approved
              </p>
            )}
            {selectedOrders.size > 0 && (
              <p className="text-xs text-blue-600 mt-1 font-medium">
                {selectedOrders.size} orders currently selected
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}