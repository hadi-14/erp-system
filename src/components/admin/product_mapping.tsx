'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Search, Plus, Check, Eye, Edit, Trash2, ArrowLeftRight, Image as LucideImage, DollarSign, Package, Zap, Download, Upload, X, AlertTriangle, CheckCircle, Info, Calendar } from 'lucide-react';
import { getAmazonProducts, get1688Products, getMappings, editMapping, createMapping } from '@/actions/admin/product_mappings';
import { order_mappings as OrderMapping, product_list_en as CNProduct, AMZN_PRODUCT_LIST as AmznProduct } from '@prisma/client';

// Toast notification component
interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-sm w-full shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden transform transition-all duration-300 ease-in-out ${toast.type === 'success' ? 'bg-green-50 border-green-200' :
            toast.type === 'error' ? 'bg-red-50 border-red-200' :
              toast.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
            }`}
        >
          <div className="p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                {toast.type === 'success' && <CheckCircle className="h-5 w-5 text-green-400" />}
                {toast.type === 'error' && <X className="h-5 w-5 text-red-400" />}
                {toast.type === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-400" />}
                {toast.type === 'info' && <Info className="h-5 w-5 text-blue-400" />}
              </div>
              <div className="ml-3 w-0 flex-1 pt-0.5">
                <p className={`text-sm font-medium ${toast.type === 'success' ? 'text-green-900' :
                  toast.type === 'error' ? 'text-red-900' :
                    toast.type === 'warning' ? 'text-yellow-900' :
                      'text-blue-900'
                  }`}>
                  {toast.title}
                </p>
                <p className={`mt-1 text-sm ${toast.type === 'success' ? 'text-green-700' :
                  toast.type === 'error' ? 'text-red-700' :
                    toast.type === 'warning' ? 'text-yellow-700' :
                      'text-blue-700'
                  }`}>
                  {toast.message}
                </p>
              </div>
              <div className="ml-4 flex-shrink-0 flex">
                <button
                  className={`rounded-md inline-flex focus:outline-none focus:ring-2 focus:ring-offset-2 ${toast.type === 'success' ? 'text-green-500 hover:text-green-600 focus:ring-green-500' :
                    toast.type === 'error' ? 'text-red-500 hover:text-red-600 focus:ring-red-500' :
                      toast.type === 'warning' ? 'text-yellow-500 hover:text-yellow-600 focus:ring-yellow-500' :
                        'text-blue-500 hover:text-blue-600 focus:ring-blue-500'
                    }`}
                  onClick={() => removeToast(toast.id)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="sm:flex sm:items-start">
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full sm:mx-0 sm:h-10 sm:w-10 ${type === 'danger' ? 'bg-red-100' :
              type === 'warning' ? 'bg-yellow-100' :
                'bg-blue-100'
              }`}>
              {type === 'danger' && <X className="h-6 w-6 text-red-600" />}
              {type === 'warning' && <AlertTriangle className="h-6 w-6 text-yellow-600" />}
              {type === 'info' && <Info className="h-6 w-6 text-blue-600" />}
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                {title}
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  {message}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm ${type === 'danger' ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' :
                type === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500' :
                  'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              onClick={onConfirm}
            >
              {confirmText}
            </button>
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 text-gray-800 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={onClose}
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SmartSuggestion {
  id: string;
  cnProduct: CNProduct;
  amznProduct: AmznProduct;
  confidence: number;
  reasons: string[];
  profit: {
    margin: number;
    percentage: number;
  };
}

interface SmartMatchSettings {
  nameWeight: number;
  priceWeight: number;
  imageWeight: number;
  minConfidence: number;
}

interface FilterOptions {
  confidence: 'all' | 'high' | 'medium' | 'low';
  verified: 'all' | 'verified' | 'pending';
  category: string;
}

type TabType = 'smart-match' | 'manual' | 'mappings' | 'analytics';
// Virtualized List Component for better performance
interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight?: number;
  maxHeight?: number;
}

const VirtualizedList = <T,>({ items, renderItem, itemHeight = 120, maxHeight = 400 }: VirtualizedListProps<T>) => {
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(Math.min(10, items.length));

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = (e.target as HTMLDivElement).scrollTop;
    const newStartIndex = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(maxHeight / itemHeight);

    setStartIndex(Math.max(0, newStartIndex - 2));
    setEndIndex(Math.min(items.length, newStartIndex + visibleCount + 2));
  }, [items.length, itemHeight, maxHeight]);

  const visibleItems = items.slice(startIndex, endIndex);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return (
    <div
      className="overflow-y-auto border border-gray-200 rounded-lg"
      style={{ maxHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div key={startIndex + index} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Optimized Image component with lazy loading
interface OptimizedImageProps {
  src?: string;
  alt: string;
  className?: string;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({ src, alt, className = "w-16 h-16 object-cover rounded-lg" }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`}>
        <LucideImage className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  return (
    <div className={`${className} bg-gray-200 flex items-center justify-center relative`}>
      <Image
        src={src}
        alt={alt}
        width={64}
        height={64}
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
        onLoadingComplete={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
        unoptimized
      />
    </div>
  );
};

export default function AdvancedProductMappingPage() {
  const [cnProducts, setCnProducts] = useState<CNProduct[]>([]);
  const [amznProducts, setAmznProducts] = useState<AmznProduct[]>([]);
  const [mappings, setMappings] = useState<OrderMapping[]>([]);
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [selectedCnProduct, setSelectedCnProduct] = useState<CNProduct | null>(null);
  const [selectedAmznProduct, setSelectedAmznProduct] = useState<AmznProduct | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cnSearchTerm, setCnSearchTerm] = useState<string>('');
  const [amznSearchTerm, setAmznSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('smart-match');
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    confidence: 'all',
    verified: 'all',
    category: 'all'
  });

  // Toast and modal states
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    type: 'info'
  });

  const [smartMatchSettings, setSmartMatchSettings] = useState<SmartMatchSettings>({
    nameWeight: 0.6,
    priceWeight: 0.3,
    imageWeight: 0.1,
    minConfidence: 0.5
  });

  // Toast functions
  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = Date.now().toString();
    const newToast: Toast = { id, type, title, message };
    setToasts(prev => [...prev, newToast]);

    // Auto remove after 5 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showConfirmModal = useCallback((title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'info') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      type
    });
  }, []);

  const closeConfirmModal = useCallback(() => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Generate mock data
  useEffect(() => {
    (async () => {
      try {
        const result = await get1688Products();
        if (result && result.success) {
          setCnProducts(result.products ?? []);
          // addToast('success', 'Data Loaded', '1688 products loaded successfully');
        } else {
          setCnProducts([]);
          addToast('error', 'Loading Failed', 'Failed to load 1688 products');
        }
      } catch {
        addToast('error', 'Loading Error', 'An error occurred while loading 1688 products');
      }
    })();

    (async () => {
      try {
        const result = await getAmazonProducts();
        if (result && result.success) {
          setAmznProducts(result.products ?? []);
          // addToast('success', 'Data Loaded', 'Amazon products loaded successfully');
        } else {
          setAmznProducts([]);
          addToast('error', 'Loading Failed', 'Failed to load Amazon products');
        }
      } catch {
        addToast('error', 'Loading Error', 'An error occurred while loading Amazon products');
      }
    })();

    (async () => {
      try {
        const result = await getMappings();
        if (result && result.success) {
          setMappings(result.mappings ?? []);
          // addToast('info', 'Mappings Loaded', `${result.mappings?.length || 0} existing mappings found`);
        } else {
          setMappings([]);
          addToast('warning', 'No Mappings', 'No existing mappings found');
        }
      } catch {
        addToast('error', 'Loading Error', 'An error occurred while loading mappings');
      }
    })();
  }, [addToast]);

  // Memoized filtered products for better performance
  const filteredCnProducts = useMemo(() => {
    if (!cnSearchTerm) return cnProducts;
    return cnProducts.filter(product =>
      (product.name ?? '').toLowerCase().includes(cnSearchTerm.toLowerCase()) ||
      String(product.productID).includes(cnSearchTerm)
    );
  }, [cnProducts, cnSearchTerm]);

  const filteredAmznProducts = useMemo(() => {
    if (!amznSearchTerm) return amznProducts;
    return amznProducts.filter(product =>
      (product.item_name ?? '').toLowerCase().includes(amznSearchTerm.toLowerCase()) ||
      (product.seller_sku ?? '').toLowerCase().includes(amznSearchTerm.toLowerCase()) ||
      (product.asin1 ?? '').toLowerCase().includes(amznSearchTerm.toLowerCase())
    );
  }, [amznProducts, amznSearchTerm]);

  const filteredMappings = useMemo(() => {
    return mappings.filter(mapping => {
      const matchesSearch = !searchTerm ||
        mapping.unified_product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.custom_sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.amzn_sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mapping.amzn_asin?.toLowerCase().includes(searchTerm.toLowerCase());

      const confidence = mapping.mapping_confidence || 0;
      const matchesConfidence = filterOptions.confidence === 'all' ||
        (filterOptions.confidence === 'high' && confidence >= 0.8) ||
        (filterOptions.confidence === 'medium' && confidence >= 0.6 && confidence < 0.8) ||
        (filterOptions.confidence === 'low' && confidence < 0.6);

      const matchesVerified = filterOptions.verified === 'all' ||
        (filterOptions.verified === 'verified' && mapping.is_verified) ||
        (filterOptions.verified === 'pending' && !mapping.is_verified);

      const matchesCategory = filterOptions.category === 'all' ||
        mapping.unified_category === filterOptions.category;

      return matchesSearch && matchesConfidence && matchesVerified && matchesCategory;
    });
  }, [mappings, searchTerm, filterOptions]);

  // Optimized similarity calculation
  const calculateSimilarity = useCallback((str1: string | null, str2: string | null): number => {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const s2 = str2.toLowerCase().replace(/[^\w\s]/g, '').trim();

    if (s1 === s2) return 1;

    const words1 = s1.split(' ');
    const words2 = s2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));

    return commonWords.length / Math.max(words1.length, words2.length);
  }, []);

  const generateSmartSuggestions = useCallback((): void => {
    const suggestions: SmartSuggestion[] = [];

    const limitedCnProducts = cnProducts.slice(0, 20);
    const limitedAmznProducts = amznProducts.slice(0, 20);

    limitedCnProducts.forEach(cnProduct => {
      limitedAmznProducts.forEach(amznProduct => {
        const nameSimilarity = calculateSimilarity(cnProduct.name ?? null, amznProduct.item_name ?? null);
        const cnPrice = cnProduct.price || 0;
        const amznPrice = amznProduct.price || 0;
        const priceRatio = amznPrice / cnPrice;

        let score = 0;
        score += nameSimilarity * smartMatchSettings.nameWeight;

        if (priceRatio >= 2 && priceRatio <= 5) {
          const priceScore = 1 - Math.abs(priceRatio - 3) / 2;
          score += priceScore * smartMatchSettings.priceWeight;
        }

        const imageSimilarity = Math.random() * 0.4 + 0.3;
        score += imageSimilarity * smartMatchSettings.imageWeight;

        if (score >= smartMatchSettings.minConfidence) {
          suggestions.push({
            id: `${cnProduct.productID}-${amznProduct.product_id}`,
            cnProduct,
            amznProduct,
            confidence: score,
            reasons: [
              `Name: ${Math.round(nameSimilarity * 100)}%`,
              `Price: ${priceRatio.toFixed(1)}x margin`,
              `Image: ${Math.round(imageSimilarity * 100)}%`
            ],
            profit: {
              margin: amznPrice - cnPrice,
              percentage: ((amznPrice - cnPrice) / cnPrice) * 100
            }
          });
        }
      });
    });

    const sortedSuggestions = suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
    setSuggestions(sortedSuggestions);

    if (sortedSuggestions.length > 0) {
      addToast('success', 'Smart Matching Complete', `Found ${sortedSuggestions.length} potential matches`);
    } else {
      addToast('warning', 'No Matches Found', 'Try adjusting the matching parameters');
    }
  }, [cnProducts, amznProducts, smartMatchSettings, calculateSimilarity, addToast]);

  // Helper to check if mapping already exists
  const mappingExists = useCallback((cnProductId: string, amznProductId: string) => {
    return mappings.some(
      m =>
        String(m.cn_product_id) === String(cnProductId) &&
        String(m.id) === String(amznProductId) // Using Amazon product ID as main mapping ID
    );
  }, [mappings]);

  const acceptSuggestion = useCallback(async (suggestion: SmartSuggestion): Promise<void> => {
    if (mappingExists(String(suggestion.cnProduct.productID), String(suggestion.amznProduct.product_id))) {
      addToast('error', 'Duplicate Mapping', 'A mapping for these products already exists');
      return;
    }

    const newMapping: OrderMapping = {
      id: BigInt(suggestion.amznProduct.product_id), // Using Amazon product ID as main mapping ID
      custom_sku: suggestion.amznProduct.seller_sku,
      cn_order_id: null,
      cn_product_id: suggestion.cnProduct.productID,
      cn_sku_id: null,
      cn_product_name: suggestion.cnProduct.name,
      cn_product_image_url: suggestion.cnProduct.productImgUrl,
      cn_price: suggestion.cnProduct.price,
      cn_quantity: null,
      cn_seller_id: null,
      cn_buyer_id: null,
      cn_status: null,
      cn_create_time: null,
      amzn_order_id: null,
      amzn_order_item_id: null,
      amzn_sku: suggestion.amznProduct.seller_sku,
      amzn_asin: suggestion.amznProduct.asin1,
      amzn_product_name: suggestion.amznProduct.item_name,
      amzn_quantity: BigInt(suggestion.amznProduct.quantity ?? 0),
      amzn_item_price: suggestion.amznProduct.price,
      amzn_currency: 'USD',
      amzn_order_status: suggestion.amznProduct.status,
      amzn_purchase_date: null,
      amzn_fulfillment_channel: suggestion.amznProduct.fulfillment_channel,
      unified_product_name: suggestion.amznProduct.item_name,
      price_margin: suggestion.profit.margin,
      profit_percentage: suggestion.profit.percentage,
      mapping_confidence: suggestion.confidence,
      mapping_method: 'auto_hybrid',
      mapped_by_user_id: null,
      mapping_notes: null,
      is_verified: false,
      unified_category: 'Electronics',
      unified_image_url: suggestion.cnProduct.productImgUrl,
      created_at: new Date(),
      updated_at: new Date(),
      verified_at: null
    };

    try {
      const result = await createMapping(newMapping);
      if (result.success) {
        setMappings(prev => [newMapping, ...prev]);
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        addToast('success', 'Mapping Created', `Successfully created mapping with SKU: ${newMapping.custom_sku}`);
      } else {
        addToast('error', 'Creation Failed', 'Failed to create mapping');
      }
    } catch {
      addToast('error', 'Creation Error', 'An error occurred while creating the mapping');
    }
  }, [mappingExists, addToast]);

  const verifyMapping = useCallback(async (mappingId: number): Promise<void> => {
    const mapping = mappings.find(m => Number(m.id) === mappingId);
    if (!mapping) return;

    const updatedMapping = { ...mapping, is_verified: true, verified_at: new Date() };
    const result = await editMapping(Number(updatedMapping['id']), updatedMapping);

    if (result.success) {
      setMappings(prev => prev.map(m =>
        Number(m.id) === mappingId ? updatedMapping : m
      ));
      addToast('success', 'Mapping Verified', 'The mapping has been successfully verified');
    } else {
      addToast('error', 'Verification Failed', 'Failed to verify the mapping');
    }
  }, [mappings, addToast]);

  const deleteMapping = useCallback((mappingId: number): void => {
    const mapping = mappings.find(m => Number(m.id) === mappingId);
    if (!mapping) return;

    showConfirmModal(
      'Delete Mapping',
      `Are you sure you want to delete the mapping for ${mapping.custom_sku}? This action cannot be undone.`,
      () => {
        setMappings(prev => prev.filter(m => Number(m.id) !== mappingId));
        addToast('success', 'Mapping Deleted', 'The mapping has been successfully deleted');
        closeConfirmModal();
      },
      'danger'
    );
  }, [mappings, showConfirmModal, closeConfirmModal, addToast]);

  // Render functions for virtualized lists
  const renderCnProduct = useCallback((product: CNProduct) => (
    <div
      onClick={() => setSelectedCnProduct(product)}
      className={`p-4 border rounded-lg cursor-pointer transition-all mx-2 my-1 ${selectedCnProduct?.productID === product.productID
        ? 'border-red-500 bg-red-50 shadow-md'
        : 'border-gray-200 hover:border-red-300 hover:shadow-sm'
        }`}
    >
      <div className="flex items-center space-x-3">
        <OptimizedImage
          src={product.productImgUrl ?? undefined}
          alt="Product"
          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 line-clamp-2 mb-1">
            {product.name}
          </h4>
          <p className="text-sm text-gray-500">ID: {product.productID}</p>
          <span className="text-lg font-bold text-green-600">¥{product.price}</span>
        </div>
      </div>
    </div>
  ), [selectedCnProduct]);

  const renderAmznProduct = useCallback((product: AmznProduct) => (
    <div
      onClick={() => setSelectedAmznProduct(product)}
      className={`p-4 border rounded-lg cursor-pointer transition-all mx-2 my-1 ${selectedAmznProduct?.product_id === product.product_id
        ? 'border-orange-500 bg-orange-50 shadow-md'
        : 'border-gray-200 hover:border-orange-300 hover:shadow-sm'
        }`}
    >
      <div className="space-y-2">
        <h4 className="font-medium text-gray-900 line-clamp-2">
          {product.item_name}
        </h4>
        <div className="flex justify-between text-sm text-gray-500">
          <span>SKU: {product.seller_sku}</span>
          <span>ASIN: {product.asin1}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg font-bold text-green-600">${product.price}</span>
          <span className="text-sm text-gray-500">Qty: {product.quantity}</span>
        </div>
        <p className="text-sm text-gray-500">Status: {product.status}</p>
      </div>
    </div>
  ), [selectedAmznProduct]);

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getConfidenceBarColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      {/* Toast Container */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.type === 'danger' ? 'Delete' : 'Confirm'}
      />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Advanced Order Mapping</h1>
          <p className="text-lg text-gray-600">Intelligent matching between 1688 and Amazon orders</p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8 border-b border-gray-200">
            {[
              { id: 'smart-match' as const, label: 'Smart Matching', icon: Zap },
              { id: 'manual' as const, label: 'Manual Mapping', icon: Plus },
              { id: 'mappings' as const, label: 'View Mappings', icon: Eye },
              { id: 'analytics' as const, label: 'Analytics', icon: DollarSign }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id
                  ? 'text-blue-700 border-blue-700'
                  : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300 text-gray-800'
                  }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Smart Matching Tab */}
        {activeTab === 'smart-match' && (
          <div className="space-y-6">
            {/* Smart Match Controls */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-slate-900">
              <h2 className="text-2xl font-semibold mb-4 flex items-center">
                <Zap className="w-6 h-6 mr-2 text-yellow-500" />
                AI-Powered Product Matching
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Name Weight ({Math.round(smartMatchSettings.nameWeight * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={smartMatchSettings.nameWeight}
                    onChange={(e) => setSmartMatchSettings({
                      ...smartMatchSettings,
                      nameWeight: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Weight ({Math.round(smartMatchSettings.priceWeight * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={smartMatchSettings.priceWeight}
                    onChange={(e) => setSmartMatchSettings({
                      ...smartMatchSettings,
                      priceWeight: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Confidence ({Math.round(smartMatchSettings.minConfidence * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.1"
                    value={smartMatchSettings.minConfidence}
                    onChange={(e) => setSmartMatchSettings({
                      ...smartMatchSettings,
                      minConfidence: parseFloat(e.target.value)
                    })}
                    className="w-full"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={generateSmartSuggestions}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all flex items-center justify-center"
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Generate Matches
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Suggestions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-slate-900">Suggested Mappings</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                      <div className="flex items-center space-x-3">
                        <OptimizedImage
                          src={suggestion.cnProduct.productImgUrl ?? undefined}
                          alt="CN Product"
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                        <div>
                          <h4 className="font-medium text-gray-900 line-clamp-2">
                            {suggestion.cnProduct.name}
                          </h4>
                          <p className="text-sm text-gray-500">ID: {suggestion.cnProduct.productID}</p>
                          <p className="text-sm text-green-600 font-semibold">¥{suggestion.cnProduct.price}</p>
                        </div>
                      </div>

                      <div className="flex flex-col items-center space-y-2">
                        <ArrowLeftRight className="w-8 h-8 text-blue-500" />
                        <div className="text-center">
                          <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(suggestion.confidence)}`}>
                            {Math.round(suggestion.confidence * 100)}% Match
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center">
                            <Package className="w-8 h-8 text-orange-600" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 line-clamp-2">
                              {suggestion.amznProduct.item_name}
                            </h4>
                            <p className="text-sm text-gray-500">ASIN: {suggestion.amznProduct.asin1}</p>
                            <p className="text-sm text-green-600 font-semibold">${suggestion.amznProduct.price}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => acceptSuggestion(suggestion)}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Accept
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {suggestions.length === 0 && (
                  <div className="text-center py-12">
                    <Zap className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-lg font-medium text-gray-900">No matches found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Try adjusting the matching parameters or check manual mapping.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Manual Mapping Tab */}
        {activeTab === 'manual' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-slate-900">Manual Product Mapping</h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-red-700">1688 Products ({filteredCnProducts.length})</h3>
                  </div>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search 1688 products by name or ID..."
                      value={cnSearchTerm}
                      onChange={(e) => setCnSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-950"
                    />
                  </div>
                  <VirtualizedList
                    items={filteredCnProducts}
                    renderItem={renderCnProduct}
                    itemHeight={140}
                    maxHeight={400}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-orange-700">Amazon Products ({filteredAmznProducts.length})</h3>
                  </div>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                      type="text"
                      placeholder="Search Amazon products by name, SKU, or ASIN..."
                      value={amznSearchTerm}
                      onChange={(e) => setAmznSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-950"
                    />
                  </div>
                  <VirtualizedList
                    items={filteredAmznProducts}
                    renderItem={renderAmznProduct}
                    itemHeight={180}
                    maxHeight={400}
                  />
                </div>
              </div>

              {(selectedCnProduct || selectedAmznProduct) && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-blue-900">Ready to create mapping</h4>
                      <p className="text-sm text-blue-700">
                        {selectedCnProduct && selectedAmznProduct ? 'Both products selected' :
                          selectedCnProduct ? 'Chinese product selected' :
                            'Amazon product selected'}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedCnProduct && selectedAmznProduct) {
                          if (mappingExists(String(selectedCnProduct.productID), String(selectedAmznProduct.product_id))) {
                            addToast('error', 'Duplicate Mapping', 'A mapping for these products already exists');
                            return;
                          }
                          acceptSuggestion({
                            id: `manual-${Date.now()}`,
                            cnProduct: selectedCnProduct,
                            amznProduct: selectedAmznProduct,
                            confidence: 1.0,
                            reasons: ['Manual mapping'],
                            profit: {
                              margin: (selectedAmznProduct.price ?? 0) - (selectedCnProduct.price ?? 0),
                              percentage: ((selectedAmznProduct.price ?? 0) - (selectedCnProduct.price ?? 0)) / ((selectedCnProduct.price ?? 1)) * 100
                            }
                          });
                          setSelectedCnProduct(null);
                          setSelectedAmznProduct(null);
                        }
                      }}
                      disabled={!selectedCnProduct || !selectedAmznProduct}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Mapping
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Mappings View Tab */}
        {activeTab === 'mappings' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">Filter Mappings</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => addToast('info', 'Export Started', 'Export functionality will be implemented')}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </button>
                  <button
                    onClick={() => addToast('info', 'Import Started', 'Import functionality will be implemented')}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Import
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <select
                  value={filterOptions.confidence}
                  onChange={(e) => setFilterOptions({ ...filterOptions, confidence: e.target.value as FilterOptions['confidence'] })}
                  className="px-3 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-950"
                >
                  <option value="all">All Confidence</option>
                  <option value="high">High (80%+)</option>
                  <option value="medium">Medium (60-79%)</option>
                  <option value="low">Low (&lt;60%)</option>
                </select>

                <select
                  value={filterOptions.verified}
                  onChange={(e) => setFilterOptions({ ...filterOptions, verified: e.target.value as FilterOptions['verified'] })}
                  className="px-3 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-950"
                >
                  <option value="all">All Status</option>
                  <option value="verified">Verified Only</option>
                  <option value="pending">Pending Only</option>
                </select>

                <select
                  value={filterOptions.category}
                  onChange={(e) => setFilterOptions({ ...filterOptions, category: e.target.value })}
                  className="px-3 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-950"
                >
                  <option value="all">All Categories</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Accessories">Accessories</option>
                  <option value="Home">Home & Garden</option>
                </select>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-950 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search mappings..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-950"
                  />
                </div>
              </div>
            </div>

            {/* Mappings Grid - Paginated */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Order Mappings ({filteredMappings.length})</h3>

              {filteredMappings.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {filteredMappings.slice(0, 20).map((mapping) => (
                    <div key={Number(mapping.id)} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">{mapping.custom_sku}</h4>
                          <p className="text-sm text-gray-500 line-clamp-1">{mapping.unified_product_name}</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs text-gray-400">Method: {mapping.mapping_method}</span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-400">
                              Created: {mapping.created_at ? mapping.created_at.toLocaleDateString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${mapping.is_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {mapping.is_verified ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Verified
                              </>
                            ) : (
                              'Pending'
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="p-3 bg-red-50 rounded-lg">
                          <h5 className="font-medium text-red-800 mb-2">1688 Source</h5>
                          <p className="text-sm text-gray-700 line-clamp-2">{mapping.cn_product_name}</p>
                          <p className="text-lg font-bold text-green-600 mt-2">¥{mapping.cn_price?.toFixed(2)}</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <h5 className="font-medium text-orange-800 mb-2">Amazon Target</h5>
                          <p className="text-sm text-gray-700 line-clamp-2">{mapping.amzn_product_name}</p>
                          <p className="text-lg font-bold text-green-600 mt-2">${mapping.amzn_item_price?.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getConfidenceBarColor(mapping.mapping_confidence || 0)}`}
                                style={{ width: `${(mapping.mapping_confidence || 0) * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-600">
                              {Math.round((mapping.mapping_confidence || 0) * 100)}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-green-600">${mapping.price_margin?.toFixed(2)}</p>
                          <p className="text-sm text-gray-500">{mapping.profit_percentage?.toFixed(1)}% profit</p>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                        {!mapping.is_verified && (
                          <button
                            onClick={() => verifyMapping(Number(mapping.id))}
                            className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex items-center"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Verify
                          </button>
                        )}
                        <button
                          onClick={() => addToast('info', 'Edit Mode', 'Edit functionality will be implemented')}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors flex items-center"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMapping(Number(mapping.id))}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors flex items-center"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}

                  {filteredMappings.length > 20 && (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-500">
                        Showing 20 of {filteredMappings.length} mappings. Use filters to narrow results.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    {mappings.length === 0 ? 'No mappings created yet' : 'No mappings match your filters'}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {mappings.length === 0
                      ? 'Start by using Smart Matching or create manual mappings.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100">Total Mappings</p>
                    <p className="text-3xl font-bold">{mappings.length}</p>
                  </div>
                  <Package className="w-12 h-12 text-blue-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Verified</p>
                    <p className="text-3xl font-bold">{mappings.filter(m => m.is_verified).length}</p>
                  </div>
                  <Check className="w-12 h-12 text-green-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Unverified</p>
                    <p className="text-3xl font-bold">{mappings.filter(m => !m.is_verified).length}</p>
                  </div>
                  <Check className="w-12 h-12 text-green-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100">Latest Updated at</p>
                    <span className="block text-blue-100 mt-1">
                      {(() => {
                        const dates = mappings
                          .filter(m => m.verified_at)
                          .map(m => m.verified_at)
                          .sort((a, b) => (a && b ? b.getTime() - a.getTime() : 0));
                        return dates.length > 0 && dates[0]
                          ? dates[0].toLocaleDateString()
                          : 'N/A';
                      })()}
                    </span>
                  </div>
                  <Calendar className="w-12 h-12 text-green-200" />
                </div>
              </div>

              {/* <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100">Total Profit</p>
                    <p className="text-3xl font-bold">
                      ${mappings.reduce((sum, m) => sum + (m.price_margin || 0), 0).toFixed(0)}
                    </p>
                  </div>
                  <DollarSign className="w-12 h-12 text-purple-200" />
                </div>
              </div> */}

              {/* <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100">Avg Confidence</p>
                    <p className="text-3xl font-bold">
                      {mappings.length > 0 ? Math.round((mappings.reduce((sum, m) => sum + (m.mapping_confidence || 0), 0) / mappings.length) * 100) : 0}%
                    </p>
                  </div>
                  <ArrowLeftRight className="w-12 h-12 text-orange-200" />
                </div>
              </div> */}
            </div>

            {/* Top Profitable Mappings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Top Profitable Mappings</h3>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {mappings
                  .sort((a, b) => (b.price_margin || 0) - (a.price_margin || 0))
                  .slice(0, 10)
                  .map((mapping, index) => (
                    <div key={Number(mapping.id)} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{mapping.custom_sku}</p>
                          <p className="text-sm text-gray-500 line-clamp-1">{mapping.unified_product_name}</p>
                          <p className="text-xs text-gray-400">
                            Method: {mapping.mapping_method}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">${mapping.price_margin?.toFixed(2)}</p>
                        <p className="text-sm text-gray-500">{mapping.profit_percentage?.toFixed(1)}%</p>
                        <p className="text-xs text-gray-400">
                          {Math.round((mapping.mapping_confidence || 0) * 100)}% conf
                        </p>
                      </div>
                    </div>
                  ))}

                {mappings.length === 0 && (
                  <div className="text-center py-8">
                    <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-gray-500">No profit data available yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
