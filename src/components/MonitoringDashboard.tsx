'use client';

import React, { useState, useEffect } from 'react';
import { Play, BarChart3, Clock, AlertCircle } from 'lucide-react';

interface MonitoringStats {
    totalHistoricalRecords: number;
    totalAlerts: number;
    recentAlerts: number;
    monitoredProductsCount: number;
    lastMonitoringRun?: string;
}

export default function MonitoringDashboard() {
    const [stats, setStats] = useState<MonitoringStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [runningManual, setRunningManual] = useState(false);

    useEffect(() => {
        loadStatistics();
    }, []);

    const loadStatistics = async () => {
        try {
            const response = await fetch('/api/monitoring/statistics');
            const data = await response.json();
            if (data.success) {
                setStats(data.statistics);
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        } finally {
            setLoading(false);
        }
    };

    const runManualMonitoring = async () => {
        setRunningManual(true);
        try {
            const response = await fetch('/api/monitoring/manual-run', {
                method: 'POST'
            });
            const data = await response.json();

            if (data.success) {
                alert(`Manual monitoring completed!\nProcessed: ${data.processed}\nAlerts created: ${data.alertsCreated}`);
                loadStatistics(); // Refresh stats
            } else {
                alert(`Manual monitoring failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Manual monitoring failed:', error);
            alert('Manual monitoring failed');
        } finally {
            setRunningManual(false);
        }
    };

    const initializeMonitoring = async () => {
        const asinInput = prompt('Enter ASINs to monitor (comma-separated):');
        if (!asinInput) return;

        const asins = asinInput.split(',').map(asin => asin.trim()).filter(Boolean);

        try {
            const response = await fetch('/api/monitoring/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ asins })
            });

            const data = await response.json();

            if (data.success) {
                alert(`Monitoring initialized!\nInitialized: ${data.initialized}\nFailed: ${data.failed}`);
                loadStatistics();
            } else {
                alert(`Initialization failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            alert('Initialization failed');
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="bg-gray-100 h-24 rounded-lg"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Price Monitoring Dashboard</h1>

                <div className="flex space-x-3">
                    <button
                        onClick={initializeMonitoring}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Initialize Products
                    </button>

                    <button
                        onClick={runManualMonitoring}
                        disabled={runningManual}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                    >
                        <Play className="w-4 h-4" />
                        <span>{runningManual ? 'Running...' : 'Run Manual Check'}</span>
                    </button>
                </div>
            </div>

            {stats && (
                <>
                    {/* Statistics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-6 rounded-lg shadow border">
                            <div className="flex items-center">
                                <BarChart3 className="w-8 h-8 text-blue-500" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Historical Records</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalHistoricalRecords.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border">
                            <div className="flex items-center">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Total Alerts</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.totalAlerts.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border">
                            <div className="flex items-center">
                                <Clock className="w-8 h-8 text-orange-500" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Recent Alerts (24h)</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.recentAlerts}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border">
                            <div className="flex items-center">
                                <BarChart3 className="w-8 h-8 text-green-500" />
                                <div className="ml-4">
                                    <p className="text-sm font-medium text-gray-600">Monitored Products</p>
                                    <p className="text-2xl font-bold text-gray-900">{stats.monitoredProductsCount}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Last Run Info */}
                    {stats.lastMonitoringRun && (
                        <div className="bg-white p-4 rounded-lg shadow border mb-6">
                            <p className="text-sm text-gray-600">
                                Last monitoring run: {' '}
                                <span className="font-medium">
                                    {new Date(stats.lastMonitoringRun).toLocaleString()}
                                </span>
                            </p>
                        </div>
                    )}

                    {/* Setup Instructions */}
                    <div className="bg-blue-50 border border-blue-200 p-6 rounded-lg">
                        <h2 className="text-lg font-semibold text-blue-900 mb-3">Setup Instructions</h2>
                        <div className="space-y-2 text-sm text-blue-800">
                            <p>1. <strong>Environment Variables:</strong> Add <code>CRON_SECRET=your-secret-key</code> to your .env</p>
                            <p>2. <strong>Vercel Cron:</strong> Add this to vercel.json:</p>
                            <pre className="bg-blue-100 p-2 rounded mt-2 text-xs overflow-x-auto">
                                {`{
  "crons": [
    {
      "path": "/api/cron/monitor-prices",
      "schedule": "0 * * * *"
    }
  ]
}`}
                            </pre>
                            <p>3. <strong>Initialize Products:</strong> Use the "Initialize Products" button above to set baseline prices</p>
                            <p>4. <strong>Manual Testing:</strong> Use "Run Manual Check" to test the monitoring system</p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

