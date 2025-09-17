'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { Trash2, Search, Filter, ChevronDown, ChevronUp, RefreshCw, TrendingUp, Package, DollarSign, BarChart3, Eye, EyeOff, Users, ArrowRightLeft } from 'lucide-react';
import {
  getCompetitivePricingData,
  getCompetitionCompetitivePricingData,
  deleteCompetitivePricingRecord,
  getCompetitivePricingStats,
  getRelatedCompetitivePricingData,
  CompetitivePricingData,
  PaginatedResult,
  CompetitivePricingFilters
} from '@/actions/admin/seller_rankings';

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalPricePoints: number;
  totalSalesRankings: number;
}

interface RelatedData {
  ourData: CompetitivePricingData | null;
  competitorData: CompetitivePricingData[];
}

const AmazonSellerRankingsDashboard: React.FC = () => {
  // State management
  const [data, setData] = useState<CompetitivePricingData[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    activeProducts: 0,
    totalPricePoints: 0,
    totalSalesRankings: 0
  });
  // const [competitionData, setCompetitionData] = useState<CompetitivePricingData[]>([]);
  const [relatedData, setRelatedData] = useState<{ [key: number]: RelatedData }>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  // UI state
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [loadingRelated, setLoadingRelated] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transitions for server actions
  const [isPending, startTransition] = useTransition();

  // Load data on component mount and when filters change
  useEffect(() => {
    loadData();
    loadStats();
  }, [searchTerm, statusFilter, pagination.page]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: CompetitivePricingFilters = {
        searchTerm,
        statusFilter,
        page: pagination.page,
        limit: pagination.limit
      };

      const result: PaginatedResult<CompetitivePricingData> = await getCompetitivePricingData(filters);

      console.log('Fetched main data:', result);
      setData(result.data);
      setPagination(result.pagination);

      // // Also load competition data for comparison
      // const competitiveResult: PaginatedResult<CompetitivePricingData> = await getCompetitionCompetitivePricingData(filters);
      // console.log('Fetched competition data:', competitiveResult);
      // setCompetitionData(competitiveResult.data);
    } catch (err) {
      setError('Failed to load data. Please try again.');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await getCompetitivePricingStats();
      setStats(statsData);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  // Load related data for a specific item
  const loadRelatedData = async (item: CompetitivePricingData) => {
    if (relatedData[item.id] || loadingRelated.has(item.id)) {
      return; // Already loaded or loading
    }

    setLoadingRelated(prev => new Set([...prev, item.id]));

    try {
      const related = await getRelatedCompetitivePricingData(
        item.Product_Identifiers_MarketplaceASIN_ASIN || undefined,
        item.SellerSKU || undefined
      );

      console.log(`Related data for item ${item.id}:`, related);

      setRelatedData(prev => ({
        ...prev,
        [item.id]: related
      }));
    } catch (err) {
      console.error('Error loading related data:', err);
    } finally {
      setLoadingRelated(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  // Handle delete with server action
  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteCompetitivePricingRecord(id);

        if (result.success) {
          // Refresh data after successful deletion
          await loadData();
          await loadStats();
          // Clear related data cache for this item
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

  const handleRefresh = () => {
    loadData();
    loadStats();
    setRelatedData({}); // Clear related data cache
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
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
        // Load related data when expanding
        loadRelatedData(item);
      }
      return newSet;
    });
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
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

  // Helper function to get competitor count for display
  const getCompetitorCount = (itemId: number) => {
    const related = relatedData[itemId];
    if (!related) return 'Click to view';
    return related.competitorData ? `${related.competitorData.length} found` : '0 found';
  };

  if (loading && data.length === 0) {
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
      {/* Header Section with Gradient */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Amazon Competitive Pricing
              </h1>
              <p className="text-blue-100 text-lg">
                Monitor competitive pricing, sales rankings, and market insights
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-3 px-6 py-3 bg-white/10 backdrop-blur-sm text-white rounded-xl hover:bg-white/20 disabled:opacity-50 transition-all duration-200 shadow-lg"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <p className="text-sm font-medium text-gray-600 mb-1">Active Products</p>
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
                <p className="text-sm font-medium text-gray-600 mb-1">Price Points</p>
                <p className="text-3xl font-bold text-orange-600">{stats.totalPricePoints}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <DollarSign className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Sales Rankings</p>
                <p className="text-3xl font-bold text-purple-600">{stats.totalSalesRankings}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-xl">
                <BarChart3 className="w-8 h-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
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

        {/* Enhanced Controls */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by SKU or ASIN..."
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-3 px-6 py-3 text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
            >
              <Filter className="w-5 h-5" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Expanded Filters */}
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
                    className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                  >
                    <option value="all">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results Summary and Pagination */}
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

        {/* Enhanced Main Table */}
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
                    Sales Ranking
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Price Range
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Competitors
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((item) => {
                  const related = relatedData[item.id];
                  const isLoadingRelated = loadingRelated.has(item.id);

                  return (
                    <React.Fragment key={item.id}>
                      {/* Main Row */}
                      <tr className="hover:bg-gray-50/50 transition-colors duration-200">
                        {/* Product Info */}
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
                        {/* Status */}
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
                        {/* Sales Ranking */}
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
                        {/* Price Range */}
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
                        {/* Competitors */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {isLoadingRelated ? (
                              <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
                            ) : (
                              <Users className="w-4 h-4 text-orange-500" />
                            )}
                            <span className="font-medium text-gray-900">
                              {getCompetitorCount(item.id)}
                            </span>
                          </div>
                        </td>
                        {/* Created */}
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatDate(item.created_at)}
                        </td>
                        {/* Actions */}
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

                      {/* Expanded Details */}
                      {expandedRows.has(item.id) && (
                        <tr>
                          <td colSpan={7} className="px-6 py-6 bg-gradient-to-r from-blue-50/30 to-purple-50/30">
                            {isLoadingRelated ? (
                              <div className="text-center py-8">
                                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                                <p className="text-gray-600 font-medium">Loading competitive analysis...</p>
                              </div>
                            ) : (
                              <div className="space-y-6">
                                {/* Competition Overview */}
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
                                                <p className="text-sm text-gray-600">{competitor.SellerSKU || `ID: ${competitor.id}`}</p>
                                              </div>
                                            </div>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${competitor.status === 'Active'
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-gray-100 text-gray-800'
                                              }`}>
                                              {competitor.status || 'N/A'}
                                            </span>
                                          </div>

                                          <div className="space-y-3">
                                            {/* Competitor Prices */}
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

                                            {/* Competitor Rankings */}
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

                                            {/* Additional Info */}
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

                                {/* Your Product Details */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                  {/* Sales Rankings */}
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

                                  {/* Offer Listings */}
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

                                  {/* Competitive Prices */}
                                  <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-4">
                                      <DollarSign className="w-5 h-5 text-green-600" />
                                      <h4 className="font-semibold text-gray-900">Your Competitive Prices</h4>
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

            {/* Empty State */}
            {data.length === 0 && !loading && (
              <div className="text-center py-16">
                <div className="text-gray-400 mb-6">
                  <Search className="mx-auto w-16 h-16 mb-4 opacity-30" />
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No items found</h3>
                  <p className="text-gray-600">Try adjusting your search or filter criteria</p>
                </div>
              </div>
            )}

            {/* Loading State */}
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