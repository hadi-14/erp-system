'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Trash2, RefreshCw, DollarSign, TrendingUp, AlertCircle, Eye, EyeOff, BarChart3, Package } from 'lucide-react';
import { getCompetitivePricingData, type PaginatedResult } from '@/actions/admin/seller_rankings';

interface Product {
  id: number;
  sku: string;
  asin: string;
  productTitle: string;
  costPrice?: number;
  salePrice?: number;
}

interface FeeDetail {
  FeeType: string;
  FeeAmount: { Amount: number; CurrencyCode: string };
  FinalFee: { Amount: number; CurrencyCode: string };
}

interface EstimationResult {
  id: string;
  sku: string;
  asin: string;
  productTitle: string;
  costPrice: number;
  sellingPrice: number;
  currency: string;
  referralFee?: number;
  variableClosingFee?: number;
  perItemFee?: number;
  totalFees?: number;
  profit?: number;
  profitMargin?: number;
  loading?: boolean;
  error?: string;
  timestamp?: Date;
}

interface CompetitivePricingData {
  id: number;
  SellerSKU: string | null;
  status: string | null;
  Product_Identifiers_MarketplaceASIN_ASIN: string | null;
  costPrice?: number;
  salePrice?: number;
  productTitle?: string;
}

export default function PriceEstimationPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellingPrice, setSellingPrice] = useState('');
  const [currency, setCurrency] = useState('AED');
  const [estimations, setEstimations] = useState<EstimationResult[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEstimation, setExpandedEstimation] = useState<string | null>(null);

  // Fetch products from competitive pricing data
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);
      const result: PaginatedResult<CompetitivePricingData> = await getCompetitivePricingData({
        limit: 1000,
        page: 1,
      });

      // Transform competitive pricing data to product format
      const transformedProducts: Product[] = result.data
        .filter(item => item.Product_Identifiers_MarketplaceASIN_ASIN)
        .map((item, index) => ({
          id: item.id,
          sku: item.SellerSKU || `SKU-${index}`,
          asin: item.Product_Identifiers_MarketplaceASIN_ASIN || '',
          productTitle: item.SellerSKU || item.Product_Identifiers_MarketplaceASIN_ASIN || 'Product',
          costPrice: item.costPrice || undefined,
          salePrice: item.salePrice || undefined,
        }));

      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const filteredProducts = products.filter(p =>
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.asin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.productTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectProduct = async (product: Product) => {
    setSelectedProduct(product);
    setSearchTerm('');
    
    // Fetch latest listing price from competitive pricing data
    if (product.asin) {
      try {
        const result = await getCompetitivePricingData({
          searchTerm: product.asin,
          limit: 1,
          page: 1,
        });
        
        if (result.data.length > 0 && result.data[0].competitive_prices?.length > 0) {
          const latestPrice = result.data[0].competitive_prices[0];
          const price = latestPrice.price_amount || product.salePrice || '';
          setSellingPrice(price?.toString() || '');
        } else {
          setSellingPrice(product.salePrice?.toString() || '');
        }
      } catch (error) {
        console.error('Error fetching latest price:', error);
        setSellingPrice(product.salePrice?.toString() || '');
      }
    } else {
      setSellingPrice(product.salePrice?.toString() || '');
    }
  };

  const estimateFees = async () => {
    if (!selectedProduct || !sellingPrice) {
      return;
    }

    const estimationId = `${selectedProduct.asin}-${Date.now()}`;
    const newEstimation: EstimationResult = {
      id: estimationId,
      sku: selectedProduct.sku,
      asin: selectedProduct.asin,
      productTitle: selectedProduct.productTitle,
      costPrice: selectedProduct.costPrice || 0,
      sellingPrice: parseFloat(sellingPrice),
      currency,
      loading: true,
      timestamp: new Date(),
    };

    setEstimations([newEstimation, ...estimations]);

    try {
      const params = new URLSearchParams({
        asin: selectedProduct.asin,
        price: sellingPrice,
        currency: currency,
      });

      const res = await fetch(`http://localhost:5000/api/get-price-estimation?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.data?.FeesEstimateResult?.FeesEstimate) {
        const feesEstimate = data.data.FeesEstimateResult.FeesEstimate;
        const feeDetailList: FeeDetail[] = feesEstimate.FeeDetailList || [];

        let referralFee = 0;
        let variableClosingFee = 0;
        let perItemFee = 0;

        feeDetailList.forEach((fee: FeeDetail) => {
          if (fee.FeeType === 'ReferralFee') referralFee = fee.FinalFee.Amount;
          if (fee.FeeType === 'VariableClosingFee') variableClosingFee = fee.FinalFee.Amount;
          if (fee.FeeType === 'PerItemFee') perItemFee = fee.FinalFee.Amount;
        });

        const totalFees = referralFee + variableClosingFee + perItemFee;
        const profit = parseFloat(sellingPrice) - (selectedProduct.costPrice || 0) - totalFees;
        const profitMargin = ((profit / parseFloat(sellingPrice)) * 100) || 0;

        setEstimations(prev =>
          prev.map(e =>
            e.id === estimationId
              ? {
                  ...e,
                  referralFee,
                  variableClosingFee,
                  perItemFee,
                  totalFees,
                  profit,
                  profitMargin,
                  loading: false,
                }
              : e
          )
        );
        setExpandedEstimation(estimationId);
      } else {
        setEstimations(prev =>
          prev.map(e =>
            e.id === estimationId
              ? { ...e, error: 'Failed to fetch fee estimate', loading: false }
              : e
          )
        );
      }
    } catch (error) {
      setEstimations(prev =>
        prev.map(e =>
          e.id === estimationId
            ? { ...e, error: 'Error fetching fees', loading: false }
            : e
        )
      );
    }
  };

  const removeEstimation = (id: string) => {
    setEstimations(estimations.filter(e => e.id !== id));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return new Date(date).toLocaleTimeString('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      estimateFees();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Price Estimation Calculator</h1>
              <p className="text-blue-100 text-lg">Calculate Amazon fees and analyze profit margins for your products</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <DollarSign className="w-8 h-8" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Product Selection Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-3">
                  <Package className="w-6 h-6 text-blue-600" />
                  Select Product
                </h2>
              </div>

              <div className="p-6">
                {/* Search */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">Search Products</label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="text"
                      placeholder="Search by SKU, ASIN, or product name..."
                      className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                {/* Products List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loadingProducts ? (
                    <div className="text-center py-12">
                      <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
                      <p className="text-gray-600 font-medium">Loading products...</p>
                    </div>
                  ) : filteredProducts.length > 0 ? (
                    filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => selectProduct(product)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          selectedProduct?.id === product.id
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 line-clamp-1">{product.productTitle}</p>
                            <div className="flex gap-4 mt-2 text-sm">
                              <span className="text-gray-600">SKU: <span className="font-medium text-gray-900">{product.sku}</span></span>
                              <span className="text-gray-600">ASIN: <span className="font-medium text-gray-900">{product.asin}</span></span>
                            </div>
                          </div>
                          {product.costPrice && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs text-gray-600 mb-1">Cost</p>
                              <p className="font-semibold text-gray-900">{formatCurrency(product.costPrice)}</p>
                            </div>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>No products found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Price Input Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden h-fit sticky top-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-700 text-white px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Estimate Price
              </h3>
            </div>

            <div className="p-6">
              {selectedProduct ? (
                <div className="space-y-5">
                  {/* Product Info */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Selected Product</label>
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-3 rounded-lg border border-blue-100">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-2">{selectedProduct.productTitle}</p>
                      <p className="text-xs text-gray-600 mt-1">{selectedProduct.asin}</p>
                    </div>
                  </div>

                  {/* Cost Price Display */}
                  {selectedProduct.costPrice && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Cost Price</label>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                        <p className="text-lg font-bold text-gray-900">{formatCurrency(selectedProduct.costPrice)}</p>
                      </div>
                    </div>
                  )}

                  {/* Selling Price Input */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-2">Selling Price</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Enter price..."
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200 font-semibold text-gray-900"
                        value={sellingPrice}
                        onChange={(e) => setSellingPrice(e.target.value)}
                        onKeyPress={handleKeyPress}
                      />
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 focus:bg-white transition-all duration-200 font-semibold text-gray-900"
                      >
                        <option value="AED">AED</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={estimateFees}
                    disabled={!sellingPrice}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <BarChart3 className="w-5 h-5" />
                    Calculate Fees
                  </button>

                  {/* Quick Stats */}
                  {sellingPrice && (
                    <div className="bg-gradient-to-br from-green-50 to-blue-50 p-4 rounded-lg border border-green-100 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Selling Price:</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(parseFloat(sellingPrice))}</span>
                      </div>
                      {selectedProduct.costPrice && (
                        <div className="flex justify-between text-green-700 font-semibold">
                          <span>Potential Gross Profit:</span>
                          <span>{formatCurrency(parseFloat(sellingPrice) - (selectedProduct.costPrice || 0))}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 text-blue-400 opacity-60" />
                  <p className="text-gray-600 font-medium">Select a product to estimate fees</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Estimations List */}
        {estimations.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <BarChart3 className="w-7 h-7 text-blue-600" />
              Estimation Results
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                {estimations.length}
              </span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {estimations.map(est => (
                <div key={est.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200 flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 line-clamp-1">{est.productTitle}</h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {est.asin} • {formatDate(est.timestamp)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeEstimation(est.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                      title="Remove"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    {est.loading ? (
                      <div className="text-center py-8">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                        <p className="text-sm text-gray-600">Calculating fees...</p>
                      </div>
                    ) : est.error ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{est.error}</span>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Price Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p className="text-xs text-gray-600 mb-1">Cost Price</p>
                            <p className="text-lg font-bold text-gray-900">{formatCurrency(est.costPrice)}</p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                            <p className="text-xs text-gray-600 mb-1">Selling Price</p>
                            <p className="text-lg font-bold text-green-700">{formatCurrency(est.sellingPrice)}</p>
                          </div>
                        </div>

                        {/* Fee Breakdown */}
                        <div>
                          <button
                            onClick={() => setExpandedEstimation(expandedEstimation === est.id ? null : est.id)}
                            className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
                          >
                            <span className="font-semibold text-gray-900">Fee Breakdown</span>
                            {expandedEstimation === est.id ? (
                              <EyeOff className="w-4 h-4 text-gray-600" />
                            ) : (
                              <Eye className="w-4 h-4 text-gray-600" />
                            )}
                          </button>

                          {expandedEstimation === est.id && (
                            <div className="mt-3 p-4 bg-gray-50 rounded-lg space-y-2 border border-gray-200">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Referral Fee:</span>
                                <span className="font-medium text-gray-900">{formatCurrency(est.referralFee || 0)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Variable Closing Fee:</span>
                                <span className="font-medium text-gray-900">{formatCurrency(est.variableClosingFee || 0)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Per Item Fee:</span>
                                <span className="font-medium text-gray-900">{formatCurrency(est.perItemFee || 0)}</span>
                              </div>
                              <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-semibold">
                                <span className="text-gray-900">Total Fees:</span>
                                <span className="text-red-600">{formatCurrency(est.totalFees || 0)}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Profit Summary */}
                        {est.profit !== undefined && (
                          <div className={`rounded-lg p-4 border-2 ${est.profit > 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className={`text-xs font-semibold uppercase mb-1 ${est.profit > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  Net Profit
                                </p>
                                <p className={`text-xl font-bold ${est.profit > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {formatCurrency(est.profit)}
                                </p>
                              </div>
                              <div>
                                <p className={`text-xs font-semibold uppercase mb-1 ${est.profitMargin! > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  Margin
                                </p>
                                <p className={`text-xl font-bold ${est.profitMargin! > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  {est.profitMargin?.toFixed(2)}%
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {estimations.length === 0 && !loadingProducts && (
          <div className="text-center py-16">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Estimations Yet</h3>
            <p className="text-gray-600">Select a product and enter a selling price to calculate fees</p>
          </div>
        )}
      </div>
    </div>
  );
}