'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, X, TrendingUp, TrendingDown, AlertTriangle, Eye, Trash2, RefreshCw, ExternalLink } from 'lucide-react';

// Import your server actions
import {
  getPriceAlerts,
  markAlertAsRead,
  dismissAlert,
  markAllAlertsAsRead,
  dismissMultipleAlerts
} from '@/actions/price-alerts';

interface PriceAlert {
  id: number;
  asin: string;
  seller_sku?: string;
  product_name?: string;
  old_price: number;
  new_price: number;
  price_change: number;
  price_change_percent: number;
  currency: string;
  alert_type: 'price_increase' | 'price_decrease' | 'significant_change';
  competitor_name?: string;
  is_read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  threshold_triggered?: number;
}

interface AlertCounts {
  total: number;
  unread: number;
  highPriority: number;
}

const PriceAlertsNotification: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [counts, setCounts] = useState<AlertCounts>({ total: 0, unread: 0, highPriority: 0 });
  const [filter, setFilter] = useState<'all' | 'unread' | 'high_priority'>('unread');
  const [loading, setLoading] = useState(false);
  const [selectedAlerts, setSelectedAlerts] = useState<Set<number>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const loadAlerts = useCallback(async (currentFilter?: 'all' | 'unread' | 'high_priority') => {
    setLoading(true);
    try {
      const result = await getPriceAlerts(currentFilter || filter);
      if (result.success) {
        setAlerts(result.alerts);
        setCounts(result.counts);
      }
    } catch (error) {
      console.error('Failed to load alerts:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(() => {
      if (isOpen) {
        loadAlerts();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [loadAlerts, isOpen]);

  useEffect(() => {
    loadAlerts(filter);
  }, [filter, loadAlerts]);

  const handleMarkAsRead = async (alertId: number) => {
    try {
      const result = await markAlertAsRead(alertId);
      if (result.success) {
        setAlerts(prev => prev.map(alert =>
          alert.id === alertId ? { ...alert, is_read: true } : alert
        ));
        setCounts(prev => ({
          ...prev,
          unread: Math.max(0, prev.unread - 1),
          highPriority: alerts.find(a => a.id === alertId && ['high', 'critical'].includes(a.priority))
            ? Math.max(0, prev.highPriority - 1)
            : prev.highPriority
        }));
      }
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const handleDismissAlert = async (alertId: number) => {
    try {
      const result = await dismissAlert(alertId);
      if (result.success) {
        const alertToRemove = alerts.find(a => a.id === alertId);
        setAlerts(prev => prev.filter(alert => alert.id !== alertId));
        setCounts(prev => ({
          total: Math.max(0, prev.total - 1),
          unread: alertToRemove && !alertToRemove.is_read ? Math.max(0, prev.unread - 1) : prev.unread,
          highPriority: alertToRemove && !alertToRemove.is_read && ['high', 'critical'].includes(alertToRemove.priority)
            ? Math.max(0, prev.highPriority - 1)
            : prev.highPriority
        }));
        setSelectedAlerts(prev => {
          const newSet = new Set(prev);
          newSet.delete(alertId);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const result = await markAllAlertsAsRead();
      if (result.success) {
        setAlerts(prev => prev.map(alert => ({ ...alert, is_read: true })));
        setCounts(prev => ({ ...prev, unread: 0, highPriority: 0 }));
      }
    } catch (error) {
      console.error('Failed to mark all alerts as read:', error);
    }
  };

  const handleBulkDismiss = async () => {
    if (selectedAlerts.size === 0) return;
    setBulkActionLoading(true);
    try {
      const result = await dismissMultipleAlerts(Array.from(selectedAlerts));
      if (result.success) {
        const alertsToRemove = alerts.filter(a => selectedAlerts.has(a.id));
        const unreadToRemove = alertsToRemove.filter(a => !a.is_read).length;
        const highPriorityToRemove = alertsToRemove.filter(a =>
          !a.is_read && ['high', 'critical'].includes(a.priority)
        ).length;
        setAlerts(prev => prev.filter(alert => !selectedAlerts.has(alert.id)));
        setCounts(prev => ({
          total: Math.max(0, prev.total - selectedAlerts.size),
          unread: Math.max(0, prev.unread - unreadToRemove),
          highPriority: Math.max(0, prev.highPriority - highPriorityToRemove)
        }));
        setSelectedAlerts(new Set());
      }
    } catch (error) {
      console.error('Failed to bulk dismiss alerts:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const toggleSelectAlert = (alertId: number) => {
    setSelectedAlerts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(alertId)) {
        newSet.delete(alertId);
      } else {
        newSet.add(alertId);
      }
      return newSet;
    });
  };

  const selectAllVisible = () => {
    setSelectedAlerts(new Set(alerts.map(a => a.id)));
  };

  const clearSelection = () => {
    setSelectedAlerts(new Set());
  };

  const navigateToProduct = (alert: PriceAlert) => {
    const params = new URLSearchParams();
    params.set('tab', 'competitive-pricing');
    
    if (alert.seller_sku) {
      params.set('sku', alert.seller_sku);
    } else if (alert.asin) {
      params.set('asin', alert.asin);
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.location.href = newUrl;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'price_increase':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'price_decrease':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      case 'significant_change':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-800 bg-gray-100 rounded-full transition-colors duration-200"
        aria-label={`Price alerts - ${counts.unread} unread`}
      >
        <Bell className="w-6 h-6" />
        {counts.unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {counts.unread > 99 ? '99+' : counts.unread}
          </span>
        )}
        {/* {counts.highPriority > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-orange-400 rounded-full animate-pulse"></span>
        )} */}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/20"
            onClick={() => setIsOpen(false)}
          />

          <div className="fixed right-4 top-16 w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">Price Alerts</h3>
                  <p className="text-sm text-gray-500">
                    {counts.unread} unread, {counts.highPriority} high priority
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => loadAlerts()}
                    disabled={loading}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                    title="Refresh alerts"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex space-x-2 text-xs">
                  {counts.unread > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
                    >
                      Mark all read
                    </button>
                  )}
                  {selectedAlerts.size > 0 && (
                    <button
                      onClick={handleBulkDismiss}
                      disabled={bulkActionLoading}
                      className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                    >
                      {bulkActionLoading ? 'Dismissing...' : `Dismiss ${selectedAlerts.size}`}
                    </button>
                  )}
                </div>

                {alerts.length > 0 && (
                  <div className="flex space-x-2 text-xs">
                    <button
                      onClick={selectedAlerts.size === alerts.length ? clearSelection : selectAllVisible}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      {selectedAlerts.size === alerts.length ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-b border-gray-100">
              <div className="flex space-x-1">
                {[
                  { key: 'unread', label: `Unread (${counts.unread})` },
                  { key: 'high_priority', label: `High Priority (${counts.highPriority})` },
                  { key: 'all', label: `All (${counts.total})` }
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setFilter(key as any)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === key
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                      }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">
                  <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-gray-300" />
                  <p className="text-sm">Loading alerts...</p>
                </div>
              ) : alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No alerts to show</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {filter === 'unread' && 'All caught up!'}
                    {filter === 'high_priority' && 'No high priority alerts'}
                    {filter === 'all' && 'No alerts found'}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {alerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${!alert.is_read ? 'bg-blue-50/30' : ''
                        } ${selectedAlerts.has(alert.id) ? 'bg-blue-100/50' : ''}`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={selectedAlerts.has(alert.id)}
                          onChange={() => toggleSelectAlert(alert.id)}
                          className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            {getAlertIcon(alert.alert_type)}
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getPriorityColor(alert.priority)}`}>
                              {alert.priority}
                            </span>
                            {!alert.is_read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>

                          <button
                            onClick={() => navigateToProduct(alert)}
                            className="mb-2 text-left w-full hover:bg-blue-50 rounded p-1 -ml-1 transition-colors group"
                          >
                            <h4 className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-600 flex items-center">
                              {alert.product_name || alert.asin}
                              <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </h4>
                            <p className="text-xs text-gray-500">
                              SKU: {alert.seller_sku} | ASIN: {alert.asin}
                            </p>
                          </button>

                          <div className="mb-2">
                            <div className="flex items-center justify-between text-sm mb-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-gray-500">
                                  ${alert.old_price.toFixed(2)}
                                </span>
                                <span className="text-gray-400">→</span>
                                <span className="font-medium">
                                  ${alert.new_price.toFixed(2)}
                                </span>
                              </div>
                              <div className={`text-sm font-medium ${alert.price_change > 0 ? 'text-red-600' : 'text-green-600'
                                }`}>
                                {alert.price_change > 0 ? '+' : ''}${Math.abs(alert.price_change).toFixed(2)}
                                ({alert.price_change > 0 ? '+' : ''}{alert.price_change_percent.toFixed(1)}%)
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="truncate">
                              {alert.competitor_name || 'Unknown competitor'}
                            </span>
                            <span>{formatTimeAgo(alert.created_at)}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          {!alert.is_read && (
                            <button
                              onClick={() => handleMarkAsRead(alert.id)}
                              className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Mark as read"
                            >
                              <Eye className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDismissAlert(alert.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Dismiss alert"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {counts.total > 0 && (
              <div className="p-3 border-t border-gray-200 text-center">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={() => {
                    window.location.href = `${window.location.pathname}?tab=competitive-pricing`;
                  }}
                >
                  View All Alerts ({counts.total})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PriceAlertsNotification;