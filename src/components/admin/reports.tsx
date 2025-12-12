"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { Edit2, Trash2, Save, X, FileText, Calendar, Link2, BarChart3, Plus, Search, ExternalLink, TrendingUp, Clock, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { createReport, deleteReport, editReport } from "@/actions/admin/reports";
import { reports } from "@prisma/client";

// Error/Success notification component
const Notification = ({ 
  type, 
  message, 
  onClose 
}: { 
  type: 'error' | 'success' | 'info'; 
  message: string; 
  onClose: () => void 
}) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const icons = {
    error: <XCircle className="w-5 h-5 text-red-500" />,
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    info: <AlertCircle className="w-5 h-5 text-blue-500" />
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border shadow-lg ${styles[type]} animate-in slide-in-from-top duration-300`}>
      <div className="flex items-start gap-3">
        {icons[type]}
        <div className="flex-1">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Error display component for inline errors
const ErrorDisplay = ({ error }: { error: string }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-5 h-5 text-red-500" />
      <p className="text-sm font-medium text-red-800">Error</p>
    </div>
    <p className="text-sm text-red-700 mt-1">{error}</p>
  </div>
);

export default function ReportsPage() {
    const [reports, setReports] = useState<reports[]>([]);
    const [filteredReports, setFilteredReports] = useState<reports[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [name, setName] = useState("");
    const [url, setUrl] = useState("");
    const [showAddForm, setShowAddForm] = useState(false);
    const [isPending, startTransition] = useTransition();

    // Edit/Delete state
    const [editingReportId, setEditingReportId] = useState<number | null>(null);
    const [editName, setEditName] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [deleteLoadingId, setDeleteLoadingId] = useState<number | null>(null);

    // Error and notification states
    const [notification, setNotification] = useState<{
        type: 'error' | 'success' | 'info';
        message: string;
    } | null>(null);
    const [fetchError, setFetchError] = useState<string>("");
    const [formErrors, setFormErrors] = useState<{
        name?: string;
        url?: string;
        general?: string;
    }>({});

    // Clear form errors function
    const clearFormErrors = () => {
        setFormErrors({});
    };

    // Show notification
    const showNotification = (type: 'error' | 'success' | 'info', message: string) => {
        setNotification({ type, message });
    };

    // Clear notification
    const clearNotification = () => {
        setNotification(null);
    };

    // Validate form data
    const validateReportForm = (name: string, url: string) => {
        const errors: { name?: string; url?: string } = {};

        if (!name.trim()) {
            errors.name = "Report name is required";
        } else if (name.trim().length < 3) {
            errors.name = "Report name must be at least 3 characters long";
        }

        if (!url.trim()) {
            errors.url = "Report URL is required";
        } else {
            try {
                new URL(url);
            } catch {
                errors.url = "Please enter a valid URL";
            }
        }

        return errors;
    };

    // Fetch reports from API with error handling
    const fetchReports = useCallback(async () => {
        try {
            setFetchError("");
            const res = await fetch("/api/reports");
            
            if (!res.ok) {
                throw new Error(`Failed to fetch reports: ${res.status} ${res.statusText}`);
            }
            
            const data = await res.json();
            setReports(data.reports || []);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to fetch reports";
            setFetchError(errorMessage);
            showNotification('error', errorMessage);
            console.error("Failed to fetch reports:", error);
            setReports([]);
        }
    }, []);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Filter reports based on search query
    useEffect(() => {
        const filtered = reports.filter(report => 
            report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            report.url.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredReports(filtered);
    }, [reports, searchQuery]);

    // Create new report with enhanced error handling
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        startTransition(async () => {
            try {
                clearFormErrors();

                // Client-side validation
                const validationErrors = validateReportForm(name, url);
                if (Object.keys(validationErrors).length > 0) {
                    setFormErrors(validationErrors);
                    return;
                }

                const res = await createReport(name, url);
                
                if (res.message) {
                    const errorMessage = "Failed to create report: " + res.message;
                    setFormErrors({ general: errorMessage });
                    showNotification('error', errorMessage);
                } else if (res.report) {
                    setReports((prev) => [res.report, ...prev]);
                    setName("");
                    setUrl("");
                    setShowAddForm(false);
                    showNotification('success', `Report "${res.report.name}" created successfully`);
                    // Refresh to ensure consistency
                    await fetchReports();
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to create report";
                setFormErrors({ general: errorMessage });
                showNotification('error', errorMessage);
                console.error("Error creating report:", error);
            }
        });
    };

    // Edit report with enhanced error handling
    const handleEdit = (report: reports) => {
        setEditingReportId(report.id);
        setEditName(report.name);
        setEditUrl(report.url);
        clearFormErrors();
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingReportId) return;
        
        startTransition(async () => {
            try {
                clearFormErrors();

                // Client-side validation
                const validationErrors = validateReportForm(editName, editUrl);
                if (Object.keys(validationErrors).length > 0) {
                    setFormErrors(validationErrors);
                    return;
                }

                const res = await editReport(editingReportId, editName, editUrl);
                
                if (!res.message) {
                    setReports((prev) =>
                        prev.map((r) =>
                            r.id === editingReportId ? { ...r, name: editName, url: editUrl } : r
                        )
                    );
                    setEditingReportId(null);
                    showNotification('success', `Report "${editName}" updated successfully`);
                    // Refresh to ensure consistency
                    await fetchReports();
                } else {
                    const errorMessage = "Failed to edit report: " + res.message;
                    setFormErrors({ general: errorMessage });
                    showNotification('error', errorMessage);
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "Failed to edit report";
                setFormErrors({ general: errorMessage });
                showNotification('error', errorMessage);
                console.error("Error editing report:", error);
            }
        });
    };

    // Delete report with enhanced error handling
    const handleDelete = async (id: number, reportName: string) => {
        if (!window.confirm(`Are you sure you want to delete report "${reportName}"? This action cannot be undone.`)) return;
        
        setDeleteLoadingId(id);
        try {
            const res = await deleteReport(id);
            if (!res.message) {
                setReports((prev) => prev.filter((r) => r.id !== id));
                showNotification('success', `Report "${reportName}" deleted successfully`);
                // Refresh to ensure consistency
                await fetchReports();
            } else {
                const errorMessage = "Failed to delete report: " + res.message;
                showNotification('error', errorMessage);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Failed to delete report";
            showNotification('error', errorMessage);
            console.error("Error deleting report:", error);
        } finally {
            setDeleteLoadingId(null);
        }
    };

    // Get recent reports count (last 7 days)
    const getRecentReportsCount = () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return reports.filter(report => new Date(report.createdAt) > sevenDaysAgo).length;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
            {/* Notification */}
            {notification && (
                <Notification
                    type={notification.type}
                    message={notification.message}
                    onClose={clearNotification}
                />
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg">
                            <BarChart3 className="w-6 h-6 text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Reports Dashboard</h1>
                    </div>
                    <p className="text-gray-700">Create, manage, and track your analytical reports and documents</p>
                </div>

                {/* Global Error Display */}
                {fetchError && <ErrorDisplay error={fetchError} />}

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-700">Total Reports</p>
                                <p className="text-2xl font-bold text-gray-900">{reports.length}</p>
                            </div>
                            <div className="p-3 bg-emerald-100 rounded-full">
                                <FileText className="w-6 h-6 text-emerald-600" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-700">This Week</p>
                                <p className="text-2xl font-bold text-gray-900">{getRecentReportsCount()}</p>
                            </div>
                            <div className="p-3 bg-teal-100 rounded-full">
                                <TrendingUp className="w-6 h-6 text-teal-600" />
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-700">Last Updated</p>
                                <p className="text-sm font-bold text-gray-900">
                                    {reports.length > 0 
                                        ? new Date(Math.max(...reports.map(r => new Date(r.createdAt).getTime()))).toLocaleDateString()
                                        : 'No reports yet'
                                    }
                                </p>
                            </div>
                            <div className="p-3 bg-cyan-100 rounded-full">
                                <Clock className="w-6 h-6 text-cyan-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
                    <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                        {/* Search */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search reports..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-950"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        
                        {/* Add Report Button */}
                        <button
                            onClick={() => {
                                setShowAddForm(!showAddForm);
                                clearFormErrors();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all transform hover:scale-105"
                        >
                            <Plus className="w-4 h-4" />
                            New Report
                        </button>
                    </div>
                </div>

                {/* Add Report Form */}
                {showAddForm && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Plus className="w-5 h-5 text-white" />
                                    <h2 className="text-lg font-semibold text-white">Create New Report</h2>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAddForm(false);
                                        clearFormErrors();
                                    }}
                                    className="text-white hover:text-gray-200 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6">
                            {/* Form Errors */}
                            {formErrors.general && <ErrorDisplay error={formErrors.general} />}
                            
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label htmlFor="name" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                            <FileText className="w-4 h-4" />
                                            Report Name
                                        </label>
                                        <input
                                            id="name"
                                            type="text"
                                            placeholder="e.g., Monthly Sales Analysis"
                                            className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-950 ${
                                                formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                            }`}
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                        />
                                        {formErrors.name && (
                                            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {formErrors.name}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label htmlFor="url" className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                            <Link2 className="w-4 h-4" />
                                            Report URL
                                        </label>
                                        <input
                                            id="url"
                                            type="url"
                                            placeholder="e.g., https://example.com/report.pdf"
                                            className={`w-full px-4 py-3 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-gray-950 ${
                                                formErrors.url ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                            }`}
                                            value={url}
                                            onChange={(e) => setUrl(e.target.value)}
                                            required
                                        />
                                        {formErrors.url && (
                                            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                <AlertCircle className="w-4 h-4" />
                                                {formErrors.url}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        type="submit"
                                        disabled={isPending || !name || !url}
                                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium rounded-lg hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        {isPending ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Plus className="w-4 h-4" />
                                        )}
                                        {isPending ? "Creating..." : "Create Report"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowAddForm(false);
                                            clearFormErrors();
                                        }}
                                        className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Reports Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">All Reports</h2>
                        <p className="text-sm text-gray-700">
                            Showing {filteredReports.length} of {reports.length} reports
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Report Details
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        URL
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-16 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                                                    <BarChart3 className="w-8 h-8 text-emerald-500" />
                                                </div>
                                                <p className="text-lg font-medium text-gray-900 mb-1">
                                                    {searchQuery ? 'No reports found' : 'No reports yet'}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {searchQuery 
                                                        ? `No reports match "${searchQuery}"`
                                                        : 'Start by creating your first report'
                                                    }
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map((report, index) => (
                                        <tr 
                                            key={report.id} 
                                            className={`hover:bg-emerald-50 transition-all duration-200 ${
                                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                                            }`}
                                        >
                                            <td className="px-6 py-4">
                                                {editingReportId === report.id ? (
                                                    <div>
                                                        <input
                                                            type="text"
                                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-950 ${
                                                                formErrors.name ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                                            }`}
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                        />
                                                        {formErrors.name && (
                                                            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" />
                                                                {formErrors.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                                                            <FileText className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium text-gray-900">{report.name}</div>
                                                            <div className="text-xs text-gray-600">ID: {report.id}</div>
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingReportId === report.id ? (
                                                    <div>
                                                        <input
                                                            type="url"
                                                            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-gray-950 ${
                                                                formErrors.url ? 'border-red-300 bg-red-50' : 'border-gray-200'
                                                            }`}
                                                            value={editUrl}
                                                            onChange={(e) => setEditUrl(e.target.value)}
                                                        />
                                                        {formErrors.url && (
                                                            <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" />
                                                                {formErrors.url}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <a 
                                                        href={report.url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-800 hover:underline transition-colors max-w-xs truncate"
                                                    >
                                                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                                                        <span className="truncate">{report.url}</span>
                                                    </a>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-gray-700">
                                                    <Calendar className="w-4 h-4" />
                                                    <div>
                                                        <div>{new Date(report.createdAt).toLocaleDateString('en-US', {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {new Date(report.createdAt).toLocaleTimeString('en-US', {
                                                                hour: '2-digit',
                                                                minute: '2-digit'
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {editingReportId === report.id ? (
                                                    <div>
                                                        {formErrors.general && (
                                                            <p className="text-xs text-red-600 mb-2 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" />
                                                                {formErrors.general}
                                                            </p>
                                                        )}
                                                        <form onSubmit={handleEditSubmit} className="flex gap-2">
                                                            <button
                                                                type="submit"
                                                                disabled={isPending}
                                                                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
                                                            >
                                                                <Save className="w-3 h-3" />
                                                                {isPending ? "Saving..." : "Save"}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingReportId(null);
                                                                    clearFormErrors();
                                                                }}
                                                                className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-all"
                                                            >
                                                                <X className="w-3 h-3" />
                                                                Cancel
                                                            </button>
                                                        </form>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleEdit(report)}
                                                            className="flex items-center gap-1 px-3 py-2 bg-blue-100 text-blue-800 text-sm font-medium rounded-lg hover:bg-blue-200 transition-all transform hover:scale-105"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(report.id, report.name)}
                                                            disabled={deleteLoadingId === report.id}
                                                            className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-800 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-all transform hover:scale-105"
                                                        >
                                                            {deleteLoadingId === report.id ? (
                                                                <div className="w-3 h-3 border border-red-800 border-t-transparent rounded-full animate-spin" />
                                                            ) : (
                                                                <Trash2 className="w-3 h-3" />
                                                            )}
                                                            {deleteLoadingId === report.id ? "Deleting..." : "Delete"}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}