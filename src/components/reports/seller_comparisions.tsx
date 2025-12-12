'use client';

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { Trash2, Search, Filter, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Package, DollarSign, BarChart3, Eye, EyeOff, Users, ArrowRightLeft, ExternalLink, AlertTriangle, Bell, BellRing, ArrowUpDown, Star } from 'lucide-react';
import {
  getCompetitivePricingData,
  getCompetitionCompetitivePricingData,
  getCompetiveProductsMap,
  deleteCompetitivePricingRecord,
  getCompetitivePricingStats,
  getBulkRelatedCompetitiveData,
  getBulkProductRatings,
  getBulkCompetitorRatings,
  CompetitivePricingData,
  PaginatedResult,
  CompetitivePricingFilters
} from '@/actions/admin/seller_rankings';
import {
  getPriceAlerts,
  markAlertAsRead,
  dismissAlert,
} from '@/actions/price-alerts';
import PriceAlertsNotification from '@/components/notifications';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalPricePoints: number;
  totalSalesRankings: number;
}

interface PriceAlert {
  id: number;
  asin: string;
  seller_sku: string | null;
  product_name: string | null;
  old_price: number;
  new_price: number;
  price_change: number;
  price_change_percent: number;
  currency: string;
  alert_type: string;
  competitor_name: string | null;
  is_read: boolean;
  priority: string;
  created_at: Date;
  is_dismissed: boolean;
}

interface LoadingState {
  [key: number]: {
    basicInfoLoaded: boolean;
    competitivePricingLoaded: boolean;
    ratingsLoaded: boolean;
  };
}

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
};

const useResponsiveLimit = () => {
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const updateLimit = () => {
      if (window.innerWidth < 640) setLimit(5);
      else if (window.innerWidth < 1024) setLimit(10);
      else setLimit(15);
    };

    updateLimit();
    window.addEventListener('resize', updateLimit);
    return () => window.removeEventListener('resize', updateLimit);
  }, []);

  return limit;
};

const RatingStars = ({ rating, reviewCount }: { rating: number | null; reviewCount: number | null }) => {
  if (!rating) {
    return <span className="text-sm text-gray-400">No rating</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            size={16}
            className={i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
          />
        ))}
      </div>
      <span className="text-sm font-medium text-gray-700">{rating.toFixed(1)}</span>
      {reviewCount && <span className="text-xs text-gray-500">({reviewCount})</span>}
    </div>
  );
};

const AmazonSellerRankingsDashboard: React.FC = () => {
  const [allData, setAllData] = useState<CompetitivePricingData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalPricePoints: 0,
    totalSalesRankings: 0,
  });
  const [relatedData, setRelatedData] = useState<{ [key: string]: any }>({});
  const [productRatings, setProductRatings] = useState<{ [key: string]: any }>({});
  const [competitorRatings, setCompetitorRatings] = useState<{ [key: string]: any }>({});
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const responsiveLimit = useResponsiveLimit();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [alertFilter, setAlertFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(true);
  const [manualLimit, setManualLimit] = useState<number | null>(null);

const [sortConfig, setSortConfig] = useState<{
  column: 'sku' | 'status' | 'date' | 'price' | 'ranking' | 'rating' | null;
  order: 'asc' | 'desc';
}>({ column: null, order: 'asc' });

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const effectiveLimit = manualLimit !== null ? manualLimit : responsiveLimit;
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const asin = params.get('asin');
      const sku = params.get('sku');
      if (asin || sku) {
        setSearchTerm(asin || sku || '');
      }
    }
  }, []);

  // OPTIMIZED: Bulk load all data at once
const loadData = useCallback(async () => {
  try {
    setLoading(true);
    setError(null);

    const filters: CompetitivePricingFilters = {
      searchTerm: debouncedSearchTerm,
      statusFilter,
      page: pagination.page,
      limit: effectiveLimit,
      alertFilter,
      sortBy: sortConfig.column,
      sortOrder: sortConfig.order,
    };

    const result: PaginatedResult<CompetitivePricingData> = await getCompetitivePricingData(filters);
    setAllData(result.data);

    setPagination({
      page: result.pagination.page,
      limit: result.pagination.limit,
      total: result.pagination.total,
      totalPages: result.pagination.totalPages,
    });

    // Initialize loading state
    const initialLoadingState: LoadingState = {};
    result.data.forEach(item => {
      initialLoadingState[item.id] = {
        basicInfoLoaded: true,
        competitivePricingLoaded: false,
        ratingsLoaded: false
      };
    });
    setLoadingState(initialLoadingState);

    // Bulk load all related data
    const asins = result.data
      .map(item => item.Product_Identifiers_MarketplaceASIN_ASIN)
      .filter(Boolean) as string[];

    if (asins.length > 0) {
      const [relatedDataResult, ratingsResult, competitorRatingsResult] = await Promise.all([
        getBulkRelatedCompetitiveData(
          result.data.map(item => ({
            asin: item.Product_Identifiers_MarketplaceASIN_ASIN || undefined,
            sellerSku: item.SellerSKU || undefined
          }))
        ),
        getBulkProductRatings(asins),
        getBulkCompetitorRatings(asins),
      ]);

      setRelatedData(relatedDataResult);
      setProductRatings(ratingsResult);
      setCompetitorRatings(competitorRatingsResult);

      // Mark all as loaded
      setLoadingState(prev => {
        const updated = { ...prev };
        result.data.forEach(item => {
          updated[item.id] = {
            basicInfoLoaded: true,
            competitivePricingLoaded: true,
            ratingsLoaded: true
          };
        });
        return updated;
      });
    }
  } catch (err) {
    setError('Failed to load data. Please try again.');
    console.error('Error loading data:', err);
  } finally {
    setLoading(false);
  }
}, [debouncedSearchTerm, statusFilter, alertFilter, pagination.page, effectiveLimit, sortConfig.column, sortConfig.order]);

  const loadStats = useCallback(async () => {
    try {
      const statsData = await getCompetitivePricingStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  }, []);

  const loadPriceAlerts = useCallback(async () => {
    try {
      const alertsResult = await getPriceAlerts('all', 10000, 0);
      if (alertsResult.success) {
        setPriceAlerts(alertsResult.alerts);
      }
    } catch (err) {
      console.error('Error loading price alerts:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadPriceAlerts();
  }, [loadStats, loadPriceAlerts]);

useEffect(() => {
  loadData();
}, [loadData]);

  const getProductAlerts = (asin: string, sellerSku: string | null) => {
    return priceAlerts.filter(alert =>
      alert.asin === asin || alert.seller_sku === sellerSku
    );
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteCompetitivePricingRecord(id);

        if (result.success) {
          await Promise.all([loadData(), loadStats()]);
          setRelatedData(prev => {
            const newData = { ...prev };
            delete newData[id];
            return newData;
          });
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Failed to delete record. Please try again.');
        console.error('Delete error:', err);
      }
    });
  };

  const handleRefresh = useCallback(() => {
    setRelatedData({});
    setLoadingState({});
    setCompetitorRatings({});
    Promise.all([loadData(), loadStats(), loadPriceAlerts()]);
  }, [loadData, loadStats, loadPriceAlerts]);

const handleSort = (column: 'sku' | 'status' | 'date' | 'price' | 'ranking' | 'rating') => {
  setSortConfig(prev => {
    if (prev.column === column) {
      return {
        column,
        order: prev.order === 'asc' ? 'desc' : 'asc'
      };
    }
    return {
      column,
      order: 'asc'
    };
  });
  setPagination(prev => ({ ...prev, page: 1 }));
};

const SortableHeader = ({
  label,
  columnKey,
}: {
  label: string;
  columnKey: 'sku' | 'status' | 'date' | 'price' | 'ranking' | 'rating';
}) => (
  <th
    className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
    onClick={() => handleSort(columnKey)}
  >
    <div className="flex items-center gap-2">
      <span>{label}</span>
      <div className="flex items-center gap-1">
        <ArrowUpDown className="w-4 h-4 text-gray-400" />
        {sortConfig.column === columnKey && (
          <span className="text-blue-600 font-bold">
            {sortConfig.order === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </div>
  </th>
);


  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleAlertFilter = (value: string) => {
    setAlertFilter(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const toggleRowExpansion = (id: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (currency === 'RANK') return amount ? `#${formatBigInt(BigInt(amount))}` : 'N/A';
    if (!amount || !currency) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatBigInt = (value: bigint | null) => {
    if (!value) return 'N/A';
    return Number(value).toLocaleString();
  };

  const getCompetitorCount = (itemId: number, asin: string) => {
    const key = asin || itemId.toString();
    const related = relatedData[key];
    const state = loadingState[itemId];

    if (!state?.competitivePricingLoaded) {
      return 'Loading...';
    }
    if (!related) return 'Click to view';
    return related.competitorData ? `${related.competitorData.length} found` : '0 found';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600 bg-red-100 border-red-200';
      case 'high':
        return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'low':
        return 'text-blue-600 bg-blue-100 border-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 border-gray-200 text-gray-700';
    }
  };

  const handleMarkAlertAsRead = async (alertId: number) => {
    try {
      await markAlertAsRead(alertId);
      await loadPriceAlerts();
    } catch (err) {
      console.error('Error marking alert as read:', err);
    }
  };

  const handleDismissAlert = async (alertId: number) => {
    try {
      await dismissAlert(alertId);
      await loadPriceAlerts();
    } catch (err) {
      console.error('Error dismissing alert:', err);
    }
  };

  if (loading && allData.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h2>
          <p className="text-gray-600">Fetching competitive pricing data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-8">
        <div className="mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Amazon Competitive Pricing</h1>
              <p className="text-blue-100 text-lg">Monitor competitive pricing, sales rankings, and market insights</p>
            </div>
            <PriceAlertsNotification />
          </div>
        </div>
      </div>

      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Products</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Price Alerts</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeProducts}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Ranks Alerts</p>
                <p className="text-3xl font-bold text-orange-600">{stats.totalPricePoints}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <BarChart3 className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Competitors</p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalSalesRankings}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Alerts</p>
                <p className="text-3xl font-bold text-red-600">{priceAlerts.filter(a => !a.is_dismissed).length}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center mt-0.5">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              </div>
              <div className="flex-1">
                <p className="text-red-800 font-medium">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by SKU or ASIN..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-3 px-6 py-3 text-gray-700 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <Filter className="w-5 h-5" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200 text-gray-700">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status Filter</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                    className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alerts</label>
                  <select
                    value={alertFilter}
                    onChange={(e) => handleAlertFilter(e.target.value)}
                    className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Products</option>
                    <option value="with_alerts">Products with Alerts</option>
                    <option value="without_alerts">Products without Alerts</option>
                    <option value="critical_alerts">Critical Alerts Only</option>
                    <option value="high_alerts">High Priority Alerts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Items Per Page</label>
                  <select
                    value={manualLimit ?? effectiveLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualLimit(val === 'auto' ? null : parseInt(val));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="px-4 py-3 border border-gray-200 text-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="auto">Auto ({effectiveLimit})</option>
                    <option value="5">5 items</option>
                    <option value="10">10 items</option>
                    <option value="15">15 items</option>
                    <option value="20">20 items</option>
                    <option value="25">25 items</option>
                    <option value="50">50 items</option>
                    <option value="100">100 items</option>
                  </select>
                </div>
              </div>
            </div>
          )}

                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            {sortConfig.column && (
              <>
                <span className="text-gray-500">Sorted by:</span>
                <span className="font-medium text-gray-900 capitalize">
                  {sortConfig.column} ({sortConfig.order === 'asc' ? 'Ascending' : 'Descending'})
                </span>
                <button
                  onClick={() => setSortConfig({ column: null, order: 'asc' })}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs"
                >
                  Clear Sort
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600">
              <span className="font-medium">
                {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-medium">{pagination.total}</span> items
            </p>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`w-10 h-10 text-sm rounded-xl transition-all duration-200 ${pagination.page === page
                        ? 'bg-blue-600 text-white'
                        : 'hover:bg-gray-50 border border-gray-200 text-gray-700'
                        }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 text-sm border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
<thead className="bg-gradient-to-r from-gray-50 to-gray-100">
  <tr>
    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Product Information</th>
    <SortableHeader label="Status" columnKey="status" />
    <SortableHeader label="Ratings" columnKey="rating" />
    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Alerts</th>
    <SortableHeader label="Sales Ranking" columnKey="ranking" />
    <SortableHeader label="Price Range" columnKey="price" />
    <SortableHeader label="Created Date" columnKey="date" />
    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Competitors</th>
    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
  </tr>
</thead>              <tbody className="divide-y divide-gray-100">
                {allData.map((item) => {
                  const asin = item.Product_Identifiers_MarketplaceASIN_ASIN || '';
                  const key = asin || item.id.toString();
                  const related = relatedData[key];
                  const state = loadingState[item.id];
                  const productAlerts = getProductAlerts(asin, item.SellerSKU);
                  const hasProductAlerts = productAlerts.length > 0;
                  const highestPriority = productAlerts.reduce((highest, alert) => {
                    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
                    return (priorities[alert.priority as keyof typeof priorities] || 0) > (priorities[highest as keyof typeof priorities] || 0) ? alert.priority : highest;
                  }, 'low');
                  const rating = productRatings[asin];
                  const compRatings = competitorRatings[asin] || [];

                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-gray-50/50 transition-colors duration-200">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                              <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{item.SellerSKU || 'N/A'}</div>
                              <div className="text-sm text-gray-500">ASIN: {asin || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${item.status === 'Active'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-gray-100 text-gray-800 border border-gray-200 text-gray-700'
                            }`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${item.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                            {item.status || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {state && !state.ratingsLoaded ? (
                            <div className="flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                              <span className="text-sm text-blue-600 font-medium">Loading...</span>
                            </div>
                          ) : (
                            <RatingStars
                              rating={rating?.rating || null}
                              reviewCount={rating?.review_count || null}
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {hasProductAlerts ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <BellRing className="w-4 h-4 text-red-500" />
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(highestPriority)}`}>
                                  {productAlerts.length}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-400">
                              <Bell className="w-4 h-4" />
                              <span className="text-sm">No alerts</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-purple-500" />
                            <span className="font-medium text-gray-900">
                              {item.sales_rankings && item.sales_rankings.length > 0
                                ? `#${formatBigInt(
                                  item.sales_rankings.reduce(
                                    (min, r) => (r.rank ? (r.rank < (min ?? Infinity) ? r.rank : min) : min),
                                    item.sales_rankings[0].rank
                                  )
                                )}`
                                : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-gray-900">
                              {item.competitive_prices && item.competitive_prices.length > 0
                                ? `${formatCurrency(item.competitive_prices[0]?.price_amount, item.competitive_prices[0]?.price_currency)}`
                                : 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {state && !state.competitivePricingLoaded ? (
                              <>
                                <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                                <span className="text-sm text-blue-600 font-medium">Loading...</span>
                              </>
                            ) : (
                              <>
                                <Users className="w-4 h-4 text-orange-500" />
                                <span className="font-medium text-gray-900">
                                  {getCompetitorCount(item.id, asin)}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => toggleRowExpansion(item.id)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                              title={expandedRows.has(item.id) ? 'Hide Details' : 'Show Details'}
                            >
                              {expandedRows.has(item.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => window.open(`https://amazon.ae/dp/${asin}`, '_blank')}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View on Amazon"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={isPending}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-all duration-200"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {expandedRows.has(item.id) && (
                        <tr>
                          <td colSpan={9} className="px-6 py-6 bg-gradient-to-r from-blue-50/30 to-purple-50/30">
                            {state && !state.competitivePricingLoaded ? (
                              <div className="text-center py-8">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                                <p className="text-gray-600 font-medium">Loading competitive analysis...</p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {hasProductAlerts && (
                                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-3 mb-6">
                                      <AlertTriangle className="w-6 h-6 text-red-600" />
                                      <h3 className="text-xl font-semibold text-gray-900">Alerts</h3>
                                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium">
                                        {productAlerts.length} {productAlerts.length === 1 ? 'alert' : 'alerts'}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                      {productAlerts.map((alert) => (
                                        <div key={alert.id} className={`p-4 rounded-lg border-2 ${getPriorityColor(alert.priority)}`}>
                                          <div className="flex items-start justify-between mb-3">
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${getPriorityColor(alert.priority)}`}>
                                                  {alert.priority}
                                                </span>
                                                <span className="text-sm text-gray-600">
                                                  {alert.alert_type.replace('_', ' ')}
                                                </span>
                                              </div>
                                              {alert.product_name && (
                                                <p className="text-sm font-medium text-gray-900 mb-1">
                                                  {alert.product_name}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex gap-1">
                                              {!alert.is_read && (
                                                <button
                                                  onClick={() => handleMarkAlertAsRead(alert.id)}
                                                  className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                                                  title="Mark as read"
                                                >
                                                  <Eye className="w-4 h-4" />
                                                </button>
                                              )}
                                              <button
                                                onClick={() => handleDismissAlert(alert.id)}
                                                className="p-1 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                                                title="Dismiss alert"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </button>
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Old Price:</span>
                                              <span className="font-medium">{formatCurrency(alert.old_price, alert.currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">New Price:</span>
                                              <span className="font-medium">{formatCurrency(alert.new_price, alert.currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Change:</span>
                                              <span className={`font-bold ${alert.price_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {alert.price_change > 0 ? '+' : ''}{formatCurrency(alert.price_change, alert.currency)}
                                                ({alert.price_change_percent > 0 ? '+' : ''}{alert.price_change_percent}%)
                                              </span>
                                            </div>
                                            {alert.competitor_name && (
                                              <div className="flex justify-between items-center">
                                                <span className="text-sm text-gray-600">Competitor:</span>
                                                <span className="text-sm font-medium">{alert.competitor_name}</span>
                                              </div>
                                            )}
                                            <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                                              {formatDate(alert.created_at)}
                                              {!alert.is_read && (
                                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
                                                  Unread
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                                  <div className="flex items-center gap-3 mb-6">
                                    <ArrowRightLeft className="w-6 h-6 text-purple-600" />
                                    <h3 className="text-xl font-semibold text-gray-900">Competition Analysis</h3>
                                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
                                      {related?.competitorData?.length || 0} competitors found
                                    </span>
                                  </div>

                                  {related?.competitorData && related.competitorData.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                      {related.competitorData.map((competitor, index) => {
                                        const compRatingList = compRatings.filter(r => r.asin === competitor.Product_Identifiers_MarketplaceASIN_ASIN) || [];

                                        return (
                                          <div key={`competitor-${competitor.id}-${index}`} className="bg-gradient-to-r from-orange-50 to-red-50 rounded-lg p-5 border border-orange-200">
                                            <div className="flex items-center justify-between mb-4">
                                              <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-orange-500 text-white rounded-lg flex items-center justify-center text-sm font-bold">
                                                  C{index + 1}
                                                </div>
                                                <div>
                                                  <h4 className="font-semibold text-gray-900">Competitor {index + 1}</h4>
                                                  <p className="text-sm text-gray-600">{competitor.Product_Identifiers_MarketplaceASIN_ASIN || `ID: ${competitor.id}`}</p>
                                                </div>
                                              </div>
                                              <div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${competitor.status === 'Active'
                                                  ? 'bg-green-100 text-green-800'
                                                  : 'bg-gray-100 text-gray-800'
                                                  }`}>
                                                  {competitor.status || 'N/A'}
                                                </span>
                                                <button
                                                  onClick={() => window.open(`https://amazon.ae/dp/${competitor.Product_Identifiers_MarketplaceASIN_ASIN}`, '_blank')}
                                                  className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                                  title="View on Amazon"
                                                >
                                                  <ExternalLink className="w-4 h-4" />
                                                </button>
                                              </div>
                                            </div>

                                            <div className="space-y-3">
                                              {compRatingList.length > 0 ? (
                                                <div>
                                                  <h5 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <Star className="w-4 h-4 text-yellow-500" />
                                                    Competitor Ratings
                                                  </h5>
                                                  <div className="bg-white rounded-lg p-3 space-y-2">
                                                    {compRatingList.map((rating, ratingIndex) => (
                                                      <div key={`comp-rating-${ratingIndex}`} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                                                        <div className="flex flex-col">
                                                          <span className="text-sm text-gray-600">
                                                            {rating.competitor_name || `Competitor ${ratingIndex + 1}`}
                                                          </span>
                                                          <span className="text-xs text-gray-400">
                                                            {formatDate(rating.created_at)}
                                                          </span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                          {[...Array(5)].map((_, i) => (
                                                            <Star
                                                              key={i}
                                                              size={14}
                                                              className={i < Math.round(rating.rating || 0) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                                                            />
                                                          ))}
                                                          <span className="text-sm font-medium text-gray-700 ml-1">
                                                            {rating.rating ? rating.rating.toFixed(1) : 'N/A'}
                                                          </span>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ) : null}

                                              {competitor.competitive_prices && competitor.competitive_prices.length > 0 && (
                                                <div>
                                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Pricing</h5>
                                                  <div className="bg-white rounded-lg p-3 space-y-2">
                                                    {competitor.competitive_prices.slice(0, 3).map((price, priceIndex) => (
                                                      <div key={`price-${price.id}-${priceIndex}`} className="flex justify-between items-center py-1">
                                                        <span className="text-sm text-gray-600">
                                                          {price.condition || 'N/A'}
                                                        </span>
                                                        <span className="font-semibold text-green-600">
                                                          {formatCurrency(price.price_amount, price.price_currency)}
                                                        </span>
                                                      </div>
                                                    ))}
                                                    {competitor.competitive_prices.length > 3 && (
                                                      <div className="text-xs text-gray-500 text-center pt-1">
                                                        +{competitor.competitive_prices.length - 3} more prices
                                                      </div>
                                                    )}
                                                  </div>
                                                </div>
                                              )}

                                              {competitor.sales_rankings && competitor.sales_rankings.length > 0 && (
                                                <div>
                                                  <h5 className="text-sm font-medium text-gray-700 mb-2">Sales Ranking</h5>
                                                  <div className="bg-white rounded-lg p-3">
                                                    <div className="flex justify-between items-center">
                                                      <span className="text-sm text-gray-600">Best Rank</span>
                                                      <span className="font-semibold text-purple-600">
                                                        #{formatBigInt(
                                                          competitor.sales_rankings.reduce(
                                                            (min, r) => (r.rank ? (r.rank < (min ?? Infinity) ? r.rank : min) : min),
                                                            competitor.sales_rankings[0].rank
                                                          )
                                                        )}
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              )}

                                              <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-orange-200">
                                                <div className="flex justify-between">
                                                  <span>ASIN: {competitor.Product_Identifiers_MarketplaceASIN_ASIN || 'N/A'}</span>
                                                  <span>Updated: {formatDate(competitor.created_at)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-8 text-gray-500">
                                      <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                      <p className="font-medium">No competitors found</p>
                                      <p className="text-sm">No competitor data available for this ASIN</p>
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                      <BarChart3 className="w-5 h-5 text-purple-600" />
                                      <h4 className="font-semibold text-gray-900">Your Sales Rankings</h4>
                                    </div>
                                    <div className="space-y-3">
                                      {item.sales_rankings && item.sales_rankings.length > 0 ? (
                                        item.sales_rankings.map((ranking, rankIndex) => (
                                          <div key={`ranking-${ranking.id}-${rankIndex}`} className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-lg font-bold text-purple-700">
                                                #{formatBigInt(ranking.rank)}
                                              </span>
                                            </div>
                                            <div className="text-sm text-gray-600 mb-1">
                                              Category: {ranking.product_category_id || 'N/A'}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {formatDate(ranking.created_at)}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-6 text-gray-500">
                                          <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                          <p className="text-sm">No sales rankings available</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                      <Package className="w-5 h-5 text-indigo-600" />
                                      <h4 className="font-semibold text-gray-900">Your Offer Listings</h4>
                                    </div>
                                    <div className="space-y-3">
                                      {item.offer_listings && item.offer_listings.length > 0 ? (
                                        item.offer_listings.map((offer, offerIndex) => (
                                          <div key={`offer-${offer.id}-${offerIndex}`} className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                            <div className="flex items-center justify-between mb-2">
                                              <span className="text-sm font-medium text-indigo-700">
                                                {offer.condition || 'N/A'}
                                              </span>
                                              <span className="text-lg font-bold text-indigo-700">
                                                {formatBigInt(offer.count)}
                                              </span>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {formatDate(offer.created_at)}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-6 text-gray-500">
                                          <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                          <p className="text-sm">No offer listings available</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                      <DollarSign className="w-5 h-5 text-green-600" />
                                      <h4 className="font-semibold text-gray-900">Your Prices</h4>
                                    </div>
                                    <div className="space-y-3">
                                      {item.competitive_prices && item.competitive_prices.length > 0 ? (
                                        item.competitive_prices.map((price, priceIndex) => (
                                          <div key={`main-price-${price.id}-${priceIndex}`} className="bg-green-50 p-4 rounded-lg border border-green-100">
                                            <div className="text-lg font-bold text-green-700 mb-1">
                                              {formatCurrency(price.price_amount, price.price_currency)}
                                            </div>
                                            <div className="text-sm text-gray-600 mb-1">
                                              {price.condition} • {price.fulfillment_channel}
                                            </div>
                                            <div className="flex items-center justify-between">
                                              <span className={`text-xs px-2 py-1 rounded-full ${price.belongs_to_requester
                                                ? 'bg-blue-100 text-blue-700'
                                                : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                {price.belongs_to_requester ? 'Your offer' : 'Competitor'}
                                              </span>
                                              {price.shipping_amount && Number(price.shipping_amount) > 0 && (
                                                <span className="text-xs text-gray-500">
                                                  +{formatCurrency(Number(price.shipping_amount), price.shipping_currency)} shipping
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-2">
                                              {formatDate(price.created_at)}
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-center py-6 text-gray-500">
                                          <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                          <p className="text-sm">No competitive prices available</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {allData.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="text-gray-400 mb-6">
                  <Search className="mx-auto w-16 h-16 mb-4 opacity-30" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No items found</h3>
                  <p className="text-gray-600">Try adjusting your search or filter criteria</p>
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-16">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600 font-medium">Loading data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmazonSellerRankingsDashboard;