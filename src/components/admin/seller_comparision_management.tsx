'use client';
import React, { useState, useTransition, useEffect } from 'react';
import {
  Search,
  Link,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Package,
  Target,
  ExternalLink,
  ArrowRight,
  Star,
  X,
  Award,
  Users,
  Zap,
  Loader,
  Eye,
  Plus,
  Trash2,
  MapPin,
  Filter,
  ChevronDown,
  ChevronUp,
  Upload,
  FileText,
  Download,
  AlertTriangle,
  Info
} from 'lucide-react';
import {
  getAvailableProducts,
  createCompetitorMapping,
  getCompetitorMappingData,
  deleteCompetitorMapping,
  toggleMappingStatus
} from '@/actions/admin/competitive_pricing';
import { extractOrValidateAsin } from '@/lib/asin';

const AdminCompetitorAnalysisPage = () => {
  // State for ASIN extraction
  const [asinInput, setAsinInput] = useState('');
  const [extractedAsin, setExtractedAsin] = useState(null);
  const [extractionError, setExtractionError] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // State for product search and comparison
  const [ourProductSearch, setOurProductSearch] = useState('');
  const [availableProducts, setAvailableProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);

  // State for competitor product details (minimal - just for display)
  const [competitorDetails, setCompetitorDetails] = useState(null);

  // State for mapping creation
  const [mappingData, setMappingData] = useState({
    mapping_reason: '',
    mapping_notes: '',
    mapping_priority: 2
  });

  // State for bulk upload
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploadFile, setBulkUploadFile] = useState(null);
  const [bulkUploadData, setBulkUploadData] = useState([]);
  const [bulkUploadResults, setBulkUploadResults] = useState(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkUploadErrors, setBulkUploadErrors] = useState([]);

  // State for existing relations display
  const [existingMappings, setExistingMappings] = useState([]);
  const [mappingsPagination, setMappingsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });
  const [mappingsLoading, setMappingsLoading] = useState(false);
  const [showExistingMappings, setShowExistingMappings] = useState(true);
  const [mappingsSearchTerm, setMappingsSearchTerm] = useState('');
  const [mappingsPriorityFilter, setMappingsPriorityFilter] = useState('all');
  const [mappingsActiveFilter, setMappingsActiveFilter] = useState('all');

  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState(null);
  const [error, setError] = useState(null);

  // Load existing mappings when component mounts and when filters change
  useEffect(() => {
    if (showExistingMappings) {
      loadExistingMappings();
    }
  }, [showExistingMappings, mappingsSearchTerm, mappingsPriorityFilter, mappingsActiveFilter, mappingsPagination.page]);

  // Handle ASIN extraction
  const handleAsinExtraction = async () => {
    if (!asinInput.trim()) {
      setExtractionError('Please enter an ASIN or Amazon URL');
      return;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedAsin(null);

    try {
      const result = await extractOrValidateAsin(asinInput.trim());

      if (result.success) {
        setExtractedAsin(result.asin);
        // Set minimal competitor details just for display purposes
        setCompetitorDetails({
          asin: result.asin,
          displayTitle: `Product ${result.asin}` // Minimal display info
        });
      } else {
        setExtractionError(result.message);
      }
    } catch (err) {
      setExtractionError('Error processing ASIN input');
      console.error('ASIN extraction error:', err);
    } finally {
      setIsExtracting(false);
    }
  };

  // Load existing mappings
  const loadExistingMappings = async () => {
    try {
      setMappingsLoading(true);

      const filters = {
        searchTerm: mappingsSearchTerm,
        priorityFilter: mappingsPriorityFilter,
        activeFilter: mappingsActiveFilter,
        page: mappingsPagination.page,
        limit: mappingsPagination.limit
      };

      const result = await getCompetitorMappingData(filters);
      setExistingMappings(result.data);
      setMappingsPagination(result.pagination);
    } catch (err) {
      console.error('Error loading existing mappings:', err);
      setError('Failed to load existing mappings');
    } finally {
      setMappingsLoading(false);
    }
  };

  // Load our products for comparison
  const loadOurProducts = async () => {
    if (!ourProductSearch.trim()) {
      setAvailableProducts([]);
      return;
    }

    setIsLoadingProducts(true);
    try {
      const products = await getAvailableProducts(ourProductSearch);
      setAvailableProducts(products);
    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load products');
    } finally {
      setIsLoadingProducts(false);
    }
  };

  // Handle product selection 
  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setOurProductSearch('');
    setAvailableProducts([]);
  };

  const fetchCompetitorData = async (asin, mappingId = null) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/fetch-competitor-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          asin: asin,
          mapping_id: mappingId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching competitor data:', error);
      throw new Error('Failed to fetch competitor data: ' + error.message);
    }
  };

  // Fetch competitor data for multiple ASINs (bulk)
  const fetchMultipleCompetitorData = async (asins) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/fetch-multiple-competitor-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          asins: asins,
          source: 'bulk_update'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching multiple competitor data:', error);
      throw new Error('Failed to fetch competitor data: ' + error.message);
    }
  };

  // Create competitor mapping
  const handleCreateMapping = async () => {
    if (!selectedProduct || !extractedAsin) {
      setError('Please select a product and extract competitor ASIN first');
      return;
    }

    startTransition(async () => {
      try {
        const result = await createCompetitorMapping({
          our_seller_sku: selectedProduct.seller_sku,
          our_asin: selectedProduct.asin,
          our_product_name: selectedProduct.product_name,
          competitor_asin: extractedAsin,
          mapping_reason: mappingData.mapping_reason,
          mapping_notes: mappingData.mapping_notes,
          mapping_priority: mappingData.mapping_priority
        });

        if (result.success) {

          try {
            const fetchResult = await fetchCompetitorData(extractedAsin);

            if (fetchResult.success) {
              if (fetchResult.data_fetched) {
                setSuccessMessage(
                  `Competitor mapping created and data fetched successfully! ` +
                  `Saved ${fetchResult.records_saved.main} main records, ` +
                  `${fetchResult.records_saved.competitive_prices} pricing records.`
                );
              } else {
                setSuccessMessage(
                  'Competitor mapping created successfully! No competitive pricing data was available for this ASIN at this time.'
                );
              }
            } else {
              setSuccessMessage(
                `Competitor mapping created successfully! However, failed to fetch competitor data: ${fetchResult.message}`
              );
            }
          } catch (fetchError) {
            console.error('Error fetching competitor data:', fetchError);
            setSuccessMessage(
              'Competitor mapping created successfully! However, there was an error fetching the competitor data. The data fetch will be retried later.'
            );
          }

          setSuccessMessage('Competitor mapping created successfully!');
          // Reset form
          setAsinInput('');
          setExtractedAsin(null);
          setCompetitorDetails(null);
          setSelectedProduct(null);
          setMappingData({
            mapping_reason: '',
            mapping_notes: '',
            mapping_priority: 2
          });
          setError(null);
          // Refresh existing mappings
          loadExistingMappings();
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Failed to create mapping. Please try again.');
        console.error('Mapping creation error:', err);
      }
    });
  };

  // Handle bulk upload file change
  const handleBulkUploadFile = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        setError('Please upload a CSV file');
        return;
      }
      setBulkUploadFile(file);
      parseBulkUploadFile(file);
    }
  };

  // Parse CSV file for bulk upload
  const parseBulkUploadFile = async (file) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      console.debug('CSV Lines:', lines);

      if (lines.length < 2) {
        setError('CSV file must contain at least a header row and one data row');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const requiredHeaders = ['seller_sku', 'competitor_url_or_asin'];

      console.debug('CSV Headers:', headers);

      const missingHeaders = requiredHeaders.filter(header =>
        !headers.some(h => h.includes(header))
      );

      if (missingHeaders.length > 0) {
        setError(`Missing required columns: ${missingHeaders.join(', ')}`);
        return;
      }

      const data = [];
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < headers.length) continue;

        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });

        // Find the seller_sku and competitor columns
        const sellerSku = row['seller_sku'] || row['selllersku'] || row['sku'];
        const competitorValue = row['competitor_url_or_asin'] || row['competitorurlorasin'] || row['competitor_asin'] || row['competitor_url'];

        if (!sellerSku || !competitorValue) {
          errors.push(`Row ${i + 1}: Missing seller_sku or competitor_url_or_asin`);
          continue;
        }

        data.push({
          seller_sku: sellerSku,
          competitor_url_or_asin: competitorValue,
          mapping_reason: row['mapping_reason'] || row['reason'] || 'Bulk upload',
          mapping_notes: row['mapping_notes'] || row['notes'] || '',
          mapping_priority: parseInt(row['mapping_priority'] || row['priority'] || '2'),
          row_number: i + 1
        });
      }

      setBulkUploadData(data);
      setBulkUploadErrors(errors);

      if (data.length === 0) {
        setError('No valid data rows found in CSV file');
      }
    } catch (err) {
      setError('Error parsing CSV file: ' + err.message);
      console.error('CSV parsing error:', err);
    }
  };

  // Process bulk upload
  const handleBulkUpload = async () => {
    if (bulkUploadData.length === 0) {
      setError('No data to upload');
      return;
    }

    setIsBulkProcessing(true);
    setBulkUploadResults(null);

    const results = {
      successful: [],
      failed: [],
      total: bulkUploadData.length
    };

    try {
      for (const row of bulkUploadData) {
        try {
          // Extract ASIN from competitor URL/ASIN
          const asinResult = await extractOrValidateAsin(row.competitor_url_or_asin);

          if (!asinResult.success) {
            results.failed.push({
              row: row.row_number,
              seller_sku: row.seller_sku,
              error: `Invalid ASIN/URL: ${asinResult.message}`
            });
            continue;
          }

          // Find matching product by seller_sku
          const products = await getAvailableProducts(row.seller_sku);
          const matchingProduct = products.find(p =>
            p.seller_sku.toLowerCase() === row.seller_sku.toLowerCase()
          );

          if (!matchingProduct) {
            results.failed.push({
              row: row.row_number,
              seller_sku: row.seller_sku,
              error: 'Product not found with this seller_sku'
            });
            continue;
          }

          // Create the mapping
          const mappingResult = await createCompetitorMapping({
            our_seller_sku: matchingProduct.seller_sku,
            our_asin: matchingProduct.asin,
            our_product_name: matchingProduct.product_name,
            competitor_asin: asinResult.asin,
            mapping_reason: row.mapping_reason,
            mapping_notes: row.mapping_notes,
            mapping_priority: row.mapping_priority
          });

          if (mappingResult.success) {
            results.successful.push({
              row: row.row_number,
              seller_sku: row.seller_sku,
              competitor_asin: asinResult.asin
            });
          } else {
            results.failed.push({
              row: row.row_number,
              seller_sku: row.seller_sku,
              error: mappingResult.message
            });
          }

        } catch (err) {
          results.failed.push({
            row: row.row_number,
            seller_sku: row.seller_sku,
            error: err.message
          });
        }
      }

      setBulkUploadResults(results);

      if (results.successful.length > 0) {
        setSuccessMessage(`Bulk upload completed: ${results.successful.length} successful, ${results.failed.length} failed`);
        loadExistingMappings(); // Refresh the mappings list

        // Trigger bulk competitor data fetch
        const asinsToFetch = results.successful.map(item => item.competitor_asin);
        if (asinsToFetch.length > 0) {
          try {
            const fetchResult = await fetchMultipleCompetitorData(asinsToFetch);
            if (fetchResult.success) {
              setSuccessMessage(prev =>
                (prev ? prev + ' ' : '') +
                `Fetched competitor data for ${asinsToFetch.length} ASINs.`
              );
            } else {
              setSuccessMessage(prev =>
                (prev ? prev + ' ' : '') +
                `Bulk upload done, but competitor data fetch failed: ${fetchResult.message}`
              );
            }
          } catch (fetchErr) {
            setSuccessMessage(prev =>
              (prev ? prev + ' ' : '') +
              'Bulk upload done, but error fetching competitor data. Will retry later.'
            );
          }
        }
      }

    } catch (err) {
      setError('Bulk upload failed: ' + err.message);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Download CSV template
  const downloadCSVTemplate = () => {
    const csvContent = `seller_sku,competitor_url_or_asin,mapping_reason,mapping_notes,mapping_priority
SKU-001,https://amazon.ae/dp/B08XYZ1234,Direct competitor,Main competitor for this product,1
SKU-002,B08ABC5678,Similar product,Alternative option,2
SKU-003,https://amazon.ae/dp/B08DEF9012,Price comparison,Monitor pricing,3`;

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'competitor_mapping_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Delete existing mapping
  const handleDeleteMapping = async (id) => {
    if (!window.confirm('Are you sure you want to delete this mapping?')) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await deleteCompetitorMapping(id);
        if (result.success) {
          setSuccessMessage('Mapping deleted successfully!');
          loadExistingMappings();
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Failed to delete mapping. Please try again.');
        console.error('Delete error:', err);
      }
    });
  };

  // Toggle mapping status
  const handleToggleStatus = async (id) => {
    startTransition(async () => {
      try {
        const result = await toggleMappingStatus(id);
        if (result.success) {
          loadExistingMappings();
        } else {
          setError(result.message);
        }
      } catch (err) {
        setError('Failed to update status. Please try again.');
        console.error('Toggle error:', err);
      }
    });
  };

  // Trigger product search when input changes
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (ourProductSearch) {
        loadOurProducts();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [ourProductSearch]);

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getPriorityLabel = (priority) => {
    switch (priority) {
      case 1: return { label: 'High', class: 'bg-red-100 text-red-800 border-red-200' };
      case 2: return { label: 'Medium', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 3: return { label: 'Low', class: 'bg-green-100 text-green-800 border-green-200' };
      default: return { label: 'Unknown', class: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Competitor Analysis Tool
              </h1>
              <p className="text-purple-100 text-lg">
                Extract competitor ASINs and map them to your products
              </p>
            </div>
            <div className="p-4 bg-white/10 backdrop-blur-sm rounded-2xl">
              <Target className="w-12 h-12 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-green-800 font-medium">{successMessage}</p>
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="mt-2 text-sm text-green-600 hover:text-green-800 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
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

        {/* Bulk Upload Toggle */}
        <div className="mb-8 flex justify-center">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4">
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={() => setShowBulkUpload(false)}
                className={`px-6 py-3 rounded-xl transition-all ${!showBulkUpload
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Single Mapping
              </button>
              <button
                onClick={() => setShowBulkUpload(true)}
                className={`px-6 py-3 rounded-xl transition-all ${showBulkUpload
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Bulk Upload
              </button>
            </div>
          </div>
        </div>

        {/* Bulk Upload Section */}
        {showBulkUpload && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-100 rounded-xl">
                  <Upload className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Bulk Upload Competitor Mappings</h2>
                  <p className="text-gray-600">Upload a CSV file to create multiple mappings at once</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Upload Section */}
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <strong>CSV Format Requirements:</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          <li>seller_sku (required)</li>
                          <li>competitor_url_or_asin (required)</li>
                          <li>mapping_reason (optional)</li>
                          <li>mapping_notes (optional)</li>
                          <li>mapping_priority (optional, 1-3, default: 2)</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={downloadCSVTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download Template
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload CSV File
                    </label>
                    <div className="border-2 border-dashed border-gray-300 text-gray-800 rounded-xl p-6 text-center hover:border-purple-400 transition-colors">
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleBulkUploadFile}
                        className="hidden"
                        id="bulk-upload-input"
                      />
                      <label htmlFor="bulk-upload-input" className="cursor-pointer">
                        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-600">
                          {bulkUploadFile ? bulkUploadFile.name : 'Click to select CSV file or drag and drop'}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">CSV files only</p>
                      </label>
                    </div>
                  </div>

                  {bulkUploadData.length > 0 && (
                    <button
                      onClick={handleBulkUpload}
                      disabled={isBulkProcessing}
                      className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isBulkProcessing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Processing {bulkUploadData.length} mappings...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload {bulkUploadData.length} Mappings
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Preview Section */}
                <div className="space-y-4">
                  {bulkUploadErrors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-red-800 mb-2">Validation Errors:</h4>
                          <div className="max-h-32 overflow-y-auto">
                            {bulkUploadErrors.map((error, index) => (
                              <div key={index} className="text-sm text-red-700">{error}</div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {bulkUploadData.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Preview ({bulkUploadData.length} rows)
                      </h4>
                      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">SKU</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Competitor</th>
                              <th className="px-3 py-2 text-left font-medium text-gray-700">Priority</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {bulkUploadData.slice(0, 10).map((row, index) => (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-900">{row.seller_sku}</td>
                                <td className="px-3 py-2 text-gray-600 truncate max-w-xs">
                                  {row.competitor_url_or_asin}
                                </td>
                                <td className="px-3 py-2">
                                  {(() => {
                                    const priority = getPriorityLabel(row.mapping_priority);
                                    return (
                                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priority.class}`}>
                                        {priority.label}
                                      </span>
                                    );
                                  })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {bulkUploadData.length > 10 && (
                          <div className="p-2 bg-gray-50 text-center text-sm text-gray-600">
                            ... and {bulkUploadData.length - 10} more rows
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {bulkUploadResults && (
                    <div className="space-y-3">
                      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                        <h4 className="font-medium text-green-800 mb-2">
                          Upload Results
                        </h4>
                        <div className="text-sm text-green-700">
                          <p>✅ Successful: {bulkUploadResults.successful.length}</p>
                          <p>❌ Failed: {bulkUploadResults.failed.length}</p>
                          <p>📊 Total: {bulkUploadResults.total}</p>
                        </div>
                      </div>

                      {bulkUploadResults.failed.length > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                          <h4 className="font-medium text-red-800 mb-2">Failed Mappings:</h4>
                          <div className="max-h-32 overflow-y-auto space-y-1">
                            {bulkUploadResults.failed.map((failure, index) => (
                              <div key={index} className="text-sm text-red-700">
                                Row {failure.row}: {failure.seller_sku} - {failure.error}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Single Mapping Section */}
        {!showBulkUpload && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - ASIN Extraction */}
            <div className="space-y-6">
              {/* ASIN Input Section */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-purple-100 rounded-xl">
                    <Link className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Extract Competitor ASIN</h2>
                    <p className="text-gray-600">Enter Amazon URL or ASIN to identify competitor product</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amazon Product URL or ASIN
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Paste Amazon URL or enter ASIN (e.g., B08XYZ1234)"
                        className="w-full px-4 py-3 pr-12 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-950"
                        value={asinInput}
                        onChange={(e) => setAsinInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAsinExtraction()}
                      />
                      {isExtracting && (
                        <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 animate-spin text-purple-500" />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Examples: https://amazon.ae/dp/B08XYZ1234 or just B08XYZ1234
                    </p>
                  </div>

                  {extractionError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800">{extractionError}</p>
                    </div>
                  )}

                  {extractedAsin && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        ✓ Extracted ASIN: <strong>{extractedAsin}</strong>
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleAsinExtraction}
                    disabled={isExtracting || !asinInput.trim()}
                    className="w-full px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {isExtracting ? (
                      <>
                        <Loader className="w-4 h-4 animate-spin" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        Extract ASIN
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Competitor ASIN Display */}
              {competitorDetails && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-100 rounded-xl">
                      <Target className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Competitor Product</h3>
                      <p className="text-gray-600">Ready for mapping</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* ASIN Display */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-gray-600">Competitor ASIN</div>
                          <div className="text-lg font-bold text-gray-900">{competitorDetails.asin}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => window.open(`https://amazon.ae/dp/${extractedAsin}`, '_blank')}
                            className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-2 text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            View
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2">
                        <Eye className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong>Note:</strong> Only the ASIN is stored for competitor tracking. Product details are fetched dynamically when needed for analysis.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Product Selection & Mapping */}
            <div className="space-y-6">
              {/* Our Product Selection */}
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Select Your Product</h3>
                    <p className="text-gray-600">Choose a product to compare with competitor</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Your Products
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search by SKU or product name..."
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-950"
                        value={ourProductSearch}
                        onChange={(e) => setOurProductSearch(e.target.value)}
                      />
                      {isLoadingProducts && (
                        <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-blue-500" />
                      )}
                    </div>
                  </div>

                  {/* Product Search Results */}
                  {availableProducts.length > 0 && (
                    <div className="border border-gray-200 rounded-xl bg-white shadow-sm max-h-64 overflow-y-auto">
                      {availableProducts.map((product, index) => (
                        <button
                          key={index}
                          onClick={() => handleProductSelect(product)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">{product.seller_sku}</div>
                          <div className="text-sm text-gray-600">{product.product_name}</div>
                          {product.asin && (
                            <div className="text-xs text-blue-600">ASIN: {product.asin}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected Product Display */}
                  {selectedProduct && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-blue-900">{selectedProduct.seller_sku}</h4>
                          <p className="text-sm text-blue-700">{selectedProduct.product_name}</p>
                          {selectedProduct.asin && (
                            <p className="text-xs text-blue-600">ASIN: {selectedProduct.asin}</p>
                          )}
                        </div>
                        <button
                          onClick={() => setSelectedProduct(null)}
                          className="p-1 hover:bg-blue-200 rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4 text-blue-600" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mapping Configuration */}
              {selectedProduct && extractedAsin && (
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-100 rounded-xl">
                      <ArrowRight className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">Create Mapping</h3>
                      <p className="text-gray-600">Configure the competitor comparison</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Mapping Summary */}
                    <div className="p-4 bg-gray-50 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-gray-700">Your Product</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-gray-700">Competitor ASIN</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="font-medium text-gray-900">{selectedProduct.seller_sku}</div>
                          <div className="text-gray-600 truncate">{selectedProduct.product_name}</div>
                          {selectedProduct.asin && (
                            <div className="text-xs text-blue-600">ASIN: {selectedProduct.asin}</div>
                          )}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{extractedAsin}</div>
                          <div className="text-gray-600 text-xs">Competitor Product</div>
                        </div>
                      </div>
                    </div>

                    {/* Priority Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority Level
                      </label>
                      <select
                        value={mappingData.mapping_priority}
                        onChange={(e) => setMappingData(prev => ({ ...prev, mapping_priority: parseInt(e.target.value) }))}
                        className="w-full px-4 py-3 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-950"
                      >
                        <option value={1}>High Priority - Critical competitor</option>
                        <option value={2}>Medium Priority - Important to track</option>
                        <option value={3}>Low Priority - Occasional monitoring</option>
                      </select>
                    </div>

                    {/* Mapping Reason */}
                    <div>
                      <label className="block text-sm font-medium text-gray-950 mb-2">
                        Mapping Reason
                      </label>
                      <input
                        type="text"
                        placeholder="Why compare with this competitor?"
                        className="w-full px-4 py-3 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-950"
                        value={mappingData.mapping_reason}
                        onChange={(e) => setMappingData(prev => ({ ...prev, mapping_reason: e.target.value }))}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Notes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Any additional information about this mapping..."
                        className="w-full px-4 py-3 border border-gray-300 text-gray-800 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-950"
                        value={mappingData.mapping_notes}
                        onChange={(e) => setMappingData(prev => ({ ...prev, mapping_notes: e.target.value }))}
                      />
                    </div>

                    {/* Create Mapping Button */}
                    <button
                      onClick={handleCreateMapping}
                      disabled={isPending}
                      className="w-full px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Creating Mapping...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Create Competitor Mapping
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing Mappings Section */}
        <div className="mt-12">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Existing Competitor Mappings</h3>
                    <p className="text-sm text-gray-600">View and manage your current competitor relationships</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExistingMappings(!showExistingMappings)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-700 border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {showExistingMappings ? 'Hide' : 'Show'} Mappings
                  {showExistingMappings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {showExistingMappings && (
              <>
                {/* Filters */}
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search mappings..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-950"
                        value={mappingsSearchTerm}
                        onChange={(e) => setMappingsSearchTerm(e.target.value)}
                      />
                    </div>
                    <select
                      value={mappingsPriorityFilter}
                      onChange={(e) => setMappingsPriorityFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-950"
                    >
                      <option value="all">All Priorities</option>
                      <option value="1">High Priority</option>
                      <option value="2">Medium Priority</option>
                      <option value="3">Low Priority</option>
                    </select>
                    <select
                      value={mappingsActiveFilter}
                      onChange={(e) => setMappingsActiveFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 text-gray-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-gray-950"
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active Only</option>
                      <option value="inactive">Inactive Only</option>
                    </select>
                    <button
                      onClick={loadExistingMappings}
                      disabled={mappingsLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                      {mappingsLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Refresh
                    </button>
                  </div>
                </div>

                {/* Mappings Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Our Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Competitor
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Priority
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Check
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {existingMappings.map((mapping) => (
                        <tr key={mapping.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Package className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900">{mapping.our_seller_sku}</div>
                                {mapping.our_asin && (
                                  <div className="text-xs text-blue-600">ASIN: {mapping.our_asin}</div>
                                )}
                                {mapping.our_product_name && (
                                  <div className="text-sm text-gray-500 truncate max-w-xs" title={mapping.our_product_name}>
                                    {mapping.our_product_name}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                                <Target className="w-4 h-4 text-red-600" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900">{mapping.competitor_asin}</div>
                                {mapping.competitor_seller_name && (
                                  <div className="text-sm text-gray-600">{mapping.competitor_seller_name}</div>
                                )}
                                {mapping.mapping_reason && (
                                  <div className="text-xs text-gray-500 italic">"{mapping.mapping_reason}"</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const priority = getPriorityLabel(mapping.mapping_priority);
                              return (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${priority.class}`}>
                                  {priority.label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleStatus(mapping.id)}
                              disabled={isPending}
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border transition-colors ${mapping.is_active
                                ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
                                } disabled:opacity-50`}
                            >
                              <div className={`w-2 h-2 rounded-full mr-1 ${mapping.is_active ? 'bg-green-500' : 'bg-gray-500'
                                }`}></div>
                              {mapping.is_active ? 'Active' : 'Inactive'}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDate(mapping.last_price_check)}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => window.open(`https://amazon.ae/dp/${mapping.competitor_asin}`, '_blank')}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View on Amazon"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteMapping(mapping.id)}
                                disabled={isPending}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                                title="Delete Mapping"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Loading State for Mappings */}
                  {mappingsLoading && (
                    <div className="text-center py-8">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                      <p className="text-sm text-gray-600">Loading mappings...</p>
                    </div>
                  )}

                  {/* Empty State for Mappings */}
                  {!mappingsLoading && existingMappings.length === 0 && (
                    <div className="text-center py-12">
                      <div className="text-gray-400 mb-4">
                        <MapPin className="mx-auto w-12 h-12 mb-3 opacity-30" />
                        <h4 className="text-lg font-medium text-gray-900 mb-2">No mappings found</h4>
                        <p className="text-gray-600">
                          {mappingsSearchTerm || mappingsPriorityFilter !== 'all' || mappingsActiveFilter !== 'all'
                            ? 'No mappings match your current filters'
                            : 'Create your first competitor mapping above to get started'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pagination for Mappings */}
                {mappingsPagination.totalPages > 1 && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Showing {existingMappings.length} of {mappingsPagination.total} mappings
                      (Page {mappingsPagination.page} of {mappingsPagination.totalPages})
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setMappingsPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                        disabled={mappingsPagination.page <= 1}
                        className="px-3 py-1.5 text-sm border border-gray-300 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setMappingsPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                        disabled={mappingsPagination.page >= mappingsPagination.totalPages}
                        className="px-3 py-1.5 text-sm border border-gray-300 text-gray-800 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Instructions Card */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Award className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">How to Use This Tool</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <div>
                    <strong>Extract ASIN:</strong> Paste any Amazon product URL or enter an ASIN to identify competitor products
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <div>
                    <strong>Select Product:</strong> Search and choose your product to compare against the competitor ASIN
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <div>
                    <strong>Create Mapping:</strong> Set priority and create the mapping to start tracking competitor data
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-6 h-6 bg-indigo-500 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <div>
                    <strong>Manage Relations:</strong> View, filter, and delete existing competitor mappings in the table below
                  </div>
                </div>
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This tool only stores ASINs for competitor tracking. Product details are fetched dynamically when needed, keeping your database lean and up-to-date.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminCompetitorAnalysisPage;