'use client';

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import { Trash2, Search, Filter, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Package, DollarSign, BarChart3, Eye, EyeOff, Users, ArrowRightLeft, ExternalLink, AlertTriangle, Bell, BellRing, ArrowUpDown } from 'lucide-react';
import {
  getCompetitivePricingData,
  getCompetitionCompetitivePricingData,
  getCompetiveProductsMap,
  deleteCompetitivePricingRecord,
  getCompetitivePricingStats,
  getRelatedCompetitivePricingData,
  CompetitivePricingData,
  PaginatedResult,
  CompetitivePricingFilters
} from '@/actions/admin/seller_rankings';
import {
  getPriceAlerts,
  markAlertAsRead,
  dismissAlert,
  markAllAlertsAsRead,
  dismissMultipleAlerts
} from '@/actions/price-alerts';
import PriceAlertsNotification from '@/components/notifications';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalPricePoints: number;
  totalSalesRankings: number;
  productsWithAlerts: number;
}

interface RelatedData {
  ourData: CompetitivePricingData | null;
  competitorData: CompetitivePricingData[];
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
  threshold_triggered: number | null;
  is_dismissed: boolean;
}

interface LoadingState {
  [key: number]: {
    basicInfoLoaded: boolean;
    competitivePricingLoaded: boolean;
  };
}

const useDebounce = (value: string, delay: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
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

const AmazonSellerRankingsDashboard: React.FC = () => {
  const [allData, setAllData] = useState<CompetitivePricingData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalPricePoints: 0,
    totalSalesRankings: 0,
    productsWithAlerts: 0
  });
  const [relatedData, setRelatedData] = useState<{ [key: number]: RelatedData }>({});
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
    column: 'ranking' | 'price' | 'date' | null;
    order: 'asc' | 'desc';
  }>({ column: null, order: 'asc' });

  const [isLoadingAllData, setIsLoadingAllData] = useState(false);

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

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const [productCompetitorMap, setProductCompetitorMap] = useState<{ [key: string]: string }>({});

  const effectiveLimit = manualLimit !== null ? manualLimit : responsiveLimit;

  const fetchAllDataForSorting = useCallback(async () => {
    try {
      setIsLoadingAllData(true);
      const filters: CompetitivePricingFilters = {
        searchTerm: debouncedSearchTerm,
        statusFilter,
        page: 1,
        limit: 10000,
        alertFilter,
        sortBy: null,
        sortOrder: 'asc'
      };

      const result: PaginatedResult<CompetitivePricingData> = await getCompetitivePricingData(filters);
      setAllData(result.data);

      return result.data;
    } catch (err) {
      setError('Failed to load all data for sorting.');
      console.error('Error fetching all data:', err);
      return [];
    } finally {
      setIsLoadingAllData(false);
    }
  }, [debouncedSearchTerm, statusFilter, alertFilter]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadingState({});
      setRelatedData({});

      const filters: CompetitivePricingFilters = {
        searchTerm: debouncedSearchTerm,
        statusFilter,
        page: pagination.page,
        limit: effectiveLimit,
        alertFilter,
        sortBy: null,
        sortOrder: 'asc'
      };

      const result: PaginatedResult<CompetitivePricingData> = await getCompetitivePricingData(filters);
      console.log(`Fetched ${result.data.length} records out of total ${result.pagination.total}`);

      setAllData(result.data);

      // Initialize loading states for all items
      const initialLoadingState: LoadingState = {};
      result.data.forEach(item => {
        initialLoadingState[item.id] = {
          basicInfoLoaded: true,
          competitivePricingLoaded: false
        };
      });
      setLoadingState(initialLoadingState);

      setPagination({
        ...result.pagination,
        limit: effectiveLimit
      });

      // Start sequential loading of competitive data
      result.data.forEach((item, index) => {
        setTimeout(() => {
          loadRelatedData(item);
        }, index * 100); // Stagger requests by 100ms
      });
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearchTerm, statusFilter, alertFilter, pagination.page, effectiveLimit]);

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

  const fetchProductCompetitorMap = useCallback(async () => {
    try {
      const data = await getCompetiveProductsMap();
      const map: { [key: string]: string } = {};
      data.forEach((entry: { our_asin: string, competitor_asin: string }) => {
        if (entry.our_asin && entry.competitor_asin) {
          map[entry.our_asin] = entry.competitor_asin;
        }
      });
      setProductCompetitorMap(map);
      console.log('Product-Competitor Map:', JSON.stringify(map));
    } catch (err) {
      console.error('Error fetching product-competitor map:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadPriceAlerts();
    fetchProductCompetitorMap();
  }, [loadStats, loadPriceAlerts, fetchProductCompetitorMap]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getProductAlerts = (asin: string, sellerSku: string | null) => {
    return priceAlerts.filter(alert =>
      alert.asin === asin || alert.seller_sku === sellerSku
    );
  };

  const loadRelatedData = async (item: CompetitivePricingData) => {
    if (relatedData[item.id]) {
      return;
    }

    try {
      const related = await getRelatedCompetitivePricingData(
        item.Product_Identifiers_MarketplaceASIN_ASIN || undefined,
        item.SellerSKU || undefined
      );

      console.log(`Related data for item ${item.id}:`, related);

      setRelatedData(prev => ({
        ...prev,
        [item.id]: {
          ourData: related.ourData ?? null,
          competitorData: related.competitorData ?? []
        }
      }));

      // Mark competitive pricing as loaded
      setLoadingState(prev => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          competitivePricingLoaded: true
        }
      }));
    } catch (err) {
      console.error('Error loading related data:', err);
      setLoadingState(prev => ({
        ...prev,
        [item.id]: {
          ...prev[item.id],
          competitivePricingLoaded: true
        }
      }));
    }
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
    Promise.all([
      loadData(),
      loadStats(),
      loadPriceAlerts()
    ]);
  }, [loadData, loadStats, loadPriceAlerts]);

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

  const toggleRowExpansion = async (id: number, item: CompetitivePricingData) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
        if (!relatedData[item.id]) {
          loadRelatedData(item);
        }
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

  const getCompetitorCount = (itemId: number) => {
    const related = relatedData[itemId];
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
        return 'text-gray-600 bg-gray-100 border-gray-200';
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

  const sortData = (dataToSort: CompetitivePricingData[]) => {
    if (!sortConfig.column) return dataToSort;

    return [...dataToSort].sort((a, b) => {
      let compareA: any = 0;
      let compareB: any = 0;

      if (sortConfig.column === 'ranking') {
        const rankA = a.sales_rankings && a.sales_rankings.length > 0
          ? Number(a.sales_rankings.reduce((min, r) => (r.rank && (!min || r.rank < min) ? r.rank : min), a.sales_rankings[0]?.rank))
          : Infinity;
        const rankB = b.sales_rankings && b.sales_rankings.length > 0
          ? Number(b.sales_rankings.reduce((min, r) => (r.rank && (!min || r.rank < min) ? r.rank : min), b.sales_rankings[0]?.rank))
          : Infinity;
        compareA = rankA;
        compareB = rankB;
      } else if (sortConfig.column === 'price') {
        compareA = a.competitive_prices && a.competitive_prices.length > 0 ? Number(a.competitive_prices[0].price_amount) : 0;
        compareB = b.competitive_prices && b.competitive_prices.length > 0 ? Number(b.competitive_prices[0].price_amount) : 0;
      } else if (sortConfig.column === 'date') {
        compareA = new Date(a.created_at).getTime();
        compareB = new Date(b.created_at).getTime();
      }

      if (sortConfig.order === 'asc') {
        return compareA > compareB ? 1 : compareA < compareB ? -1 : 0;
      } else {
        return compareA < compareB ? 1 : compareA > compareB ? -1 : 0;
      }
    });
  };

  const handleSortClick = async (column: 'ranking' | 'price' | 'date') => {
    let newOrder: 'asc' | 'desc' = 'asc';

    if (sortConfig.column === column) {
      newOrder = sortConfig.order === 'asc' ? 'desc' : 'asc';
    }

    setSortConfig({ column, order: newOrder });

    const allDataForSort = await fetchAllDataForSorting();
    const sorted = sortData(allDataForSort);

    const total = sorted.length;
    const totalPages = Math.ceil(total / effectiveLimit);

    setAllData(sorted);
    setPagination(prev => ({
      ...prev,
      page: 1,
      total,
      totalPages
    }));

    // Initialize loading states and start sequential loading
    const initialLoadingState: LoadingState = {};
    sorted.slice(0, effectiveLimit).forEach(item => {
      initialLoadingState[item.id] = {
        basicInfoLoaded: true,
        competitivePricingLoaded: false
      };
    });
    setLoadingState(initialLoadingState);

    sorted.slice(0, effectiveLimit).forEach((item, index) => {
      setTimeout(() => {
        loadRelatedData(item);
      }, index * 100);
    });
  };

  const sortedAllData = sortData(allData);

  const startIndex = (pagination.page - 1) * effectiveLimit;
  const endIndex = startIndex + effectiveLimit;
  const data = sortedAllData.slice(startIndex, endIndex);

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
              <h1 className="text-4xl font-bold mb-2">
                Amazon Competitive Pricing
              </h1>
              <p className="text-blue-100 text-lg">
                Monitor competitive pricing, sales rankings, and market insights
              </p>
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
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200 text-gray-950"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-3 px-6 py-3 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 text-gray-800 transition-all duration-200"
            >
              <Filter className="w-5 h-5" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status Filter
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => handleStatusFilter(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200 text-gray-950"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Alerts
                  </label>
                  <select
                    value={alertFilter}
                    onChange={(e) => handleAlertFilter(e.target.value)}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200 text-gray-950"
                  >
                    <option value="all">All Products</option>
                    <option value="with_alerts">Products with Alerts</option>
                    <option value="without_alerts">Products without Alerts</option>
                    <option value="critical_alerts">Critical Alerts Only</option>
                    <option value="high_alerts">High Priority Alerts</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Items Per Page
                  </label>
                  <select
                    value={manualLimit ?? effectiveLimit}
                    onChange={(e) => {
                      const val = e.target.value;
                      setManualLimit(val === 'auto' ? null : parseInt(val));
                      setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200 text-gray-950"
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
        </div>

        <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm text-gray-600">
              <span className="font-medium">
                {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-medium">{pagination.total}</span> items
              {alertFilter !== 'all' && (
                <span className="ml-2 text-blue-600 font-medium">
                  ({alertFilter.replace('_', ' ')})
                </span>
              )}
            </p>
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
                        : 'hover:bg-gray-50 border border-gray-200'
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
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Product Information
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Alerts
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSortClick('ranking')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      Sales Ranking
                      <ArrowUpDown className={`w-4 h-4 ${sortConfig.column === 'ranking' ? 'text-blue-600' : 'text-gray-400'}`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSortClick('price')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      Price Range
                      <ArrowUpDown className={`w-4 h-4 ${sortConfig.column === 'price' ? 'text-blue-600' : 'text-gray-400'}`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <button
                      onClick={() => handleSortClick('date')}
                      className="flex items-center gap-2 hover:text-gray-900 transition-colors"
                    >
                      Created Date
                      <ArrowUpDown className={`w-4 h-4 ${sortConfig.column === 'date' ? 'text-blue-600' : 'text-gray-400'}`} />
                    </button>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Competitors
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoadingAllData && sortConfig.column && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                      <p className="text-gray-600 font-medium">Sorting all data across pages...</p>
                    </td>
                  </tr>
                )}

                {!isLoadingAllData && data.map((item, idx) => {
                  const related = relatedData[item.id];
                  const state = loadingState[item.id];
                  const productAlerts = getProductAlerts(item.Product_Identifiers_MarketplaceASIN_ASIN || '', item.SellerSKU);
                  const hasProductAlerts = productAlerts.length > 0;
                  const highestPriority = productAlerts.reduce((highest, alert) => {
                    const priorities = { critical: 4, high: 3, medium: 2, low: 1 };
                    return (priorities[alert.priority as keyof typeof priorities] || 0) > (priorities[highest as keyof typeof priorities] || 0) ? alert.priority : highest;
                  }, 'low');

                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        className="hover:bg-gray-50/50 transition-colors duration-200"
                        data-row-id={item.id}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                              <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{item.SellerSKU || 'N/A'}</div>
                              <div className="text-sm text-gray-500">ASIN: {item.Product_Identifiers_MarketplaceASIN_ASIN || 'N/A'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${item.status === 'Active'
                            ? 'bg-green-100 text-green-800 border border-green-200'
                            : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${item.status === 'Active' ? 'bg-green-500' : 'bg-gray-500'
                              }`}></div>
                            {item.status || 'N/A'}
                          </span>
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
                                <span className="text-sm text-blue-600 font-medium">
                                  Loading...
                                </span>
                              </>
                            ) : (
                              <>
                                <Users className="w-4 h-4 text-orange-500" />
                                <span className="font-medium text-gray-900">
                                  {getCompetitorCount(item.id)}
                                </span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => toggleRowExpansion(item.id, item)}
                              className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all duration-200"
                              title={expandedRows.has(item.id) ? 'Hide Details' : 'Show Details'}
                            >
                              {expandedRows.has(item.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => window.open(`https://amazon.ae/dp/${item.Product_Identifiers_MarketplaceASIN_ASIN}`, '_blank')}
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
                          <td colSpan={8} className="px-6 py-6 bg-gradient-to-r from-blue-50/30 to-purple-50/30">
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
                                              <span className="text-sm text-gray-600">{alert.alert_type === 'rank_comparision' ? 'Old Price:' : 'Our Best Rank:'}</span>
                                              <span className="font-medium">{formatCurrency(alert.old_price, alert.currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">{alert.alert_type === 'rank_comparision' ? 'New Price:' : 'Competitor Best Rank:'}</span>
                                              <span className="font-medium">{formatCurrency(alert.new_price, alert.currency)}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                              <span className="text-sm text-gray-600">Change:</span>
                                              <span className={`font-bold ${alert.price_change > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                {alert.price_change > 0 ? '+' : ''}{formatCurrency(alert.price_change, alert.currency)}
                                                ({alert.price_change_percent > 0 ? '+' : ''}{alert.price_change_percent.toFixed(1)}%)
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
                                      {related.competitorData.map((competitor, index) => (
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
                                                  {competitor.sales_rankings[0]?.product_category_id && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                      Category:{' '}
                                                      {
                                                        competitor.sales_rankings
                                                          .sort((a, b) => {
                                                            if (!a.rank || !b.rank) return 0;
                                                            return Number(a.rank) - Number(b.rank);
                                                          })[0]?.product_category_id || 'N/A'
                                                      }
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            )}

                                            <div className="text-xs text-gray-500 mt-3 pt-3 border-t border-orange-200">
                                              <div className="flex justify-between">
                                                <span>ASIN: {competitor.Product_Identifiers_MarketplaceASIN_ASIN || 'N/A'}</span>
                                                <span>Updated: {formatDate(competitor.updated_at)}</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
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

            {data.length === 0 && !loading && (
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