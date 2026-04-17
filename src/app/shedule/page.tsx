'use client';
import React, { useState, useEffect } from 'react';
import { Play, Calendar, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

interface Script {
  id: string | number;
  name: string;
  status: string;
  lastExecution?: string;
  nextRun?: string;
  progress?: number;
  alerts?: string[];
}

export default function ScriptMonitor() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedScript, setSelectedScript] = useState<string | number | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [executing, setExecuting] = useState<string | number | null>(null);

  const API_BASE = 'https://api.eazeway.com/api';

  // Fetch scripts on mount and set up polling
  useEffect(() => {
    fetchScripts();
    const interval = setInterval(fetchScripts, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchScripts = async () => {
    try {
      const res = await fetch(`${API_BASE}/scripts`);
      if (!res.ok) throw new Error('Failed to fetch scripts');
      const data = await res.json();
      setScripts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (scriptId: string | number, scriptName: string) => {
    setExecuting(scriptId);
    try {
      const res = await fetch(`${API_BASE}/scripts/${scriptName}/execute`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to execute script');
      await fetchScripts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setExecuting(null);
    }
  };

  const handleSchedule = (scriptId: string | number) => {
    setSelectedScript(scriptId);
    setShowScheduleModal(true);
  };

  const confirmSchedule = async () => {
    const script = scripts.find(s => s.id === selectedScript);
    if (!script) return;

    try {
      const res = await fetch(`${API_BASE}/scripts/${script.name}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: scheduleTime }),
      });
      if (!res.ok) throw new Error('Failed to schedule script');
      await fetchScripts();
      setShowScheduleModal(false);
      setSelectedScript(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'running': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'failed': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'running': return <Clock className="w-4 h-4 animate-spin" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return null;
    }
  };

  const alertCount = scripts.reduce((sum, s) => sum + (s.alerts?.length || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">Loading scripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Script Monitor</h1>
          <p className="text-slate-400">Manage and monitor Python script execution</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-100 font-semibold">Error</p>
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Alert Banner */}
        {alertCount > 0 && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-100 font-semibold">{alertCount} Alert{alertCount > 1 ? 's' : ''}</p>
              <p className="text-red-200 text-sm">Review scripts below for details</p>
            </div>
          </div>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Running', count: scripts.filter(s => s.status === 'running').length, color: 'bg-blue-600' },
            { label: 'Completed', count: scripts.filter(s => s.status === 'completed').length, color: 'bg-green-600' },
            { label: 'Failed', count: scripts.filter(s => s.status === 'failed').length, color: 'bg-red-600' },
            { label: 'Pending', count: scripts.filter(s => s.status === 'pending').length, color: 'bg-yellow-600' }
          ].map((stat, i) => (
            <div key={i} className={`${stat.color} rounded-lg p-4 text-white`}>
              <p className="text-sm opacity-90">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.count}</p>
            </div>
          ))}
        </div>

        {/* Scripts List */}
        {scripts.length === 0 ? (
          <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-8 text-center">
            <p className="text-slate-400">No scripts found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {scripts.map(script => (
              <div key={script.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-5 hover:bg-slate-700/80 transition">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-white">{script.name}.py</h3>
                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(script.status)}`}>
                          {getStatusIcon(script.status)}
                          {script.status.charAt(0).toUpperCase() + script.status.slice(1)}
                        </span>
                      </div>
                      {script.lastExecution && (
                        <p className="text-slate-400 text-sm">Last run: {new Date(script.lastExecution).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleExecute(script.id, script.name)}
                      disabled={executing === script.id}
                      className="p-2 hover:bg-slate-600 rounded-lg transition text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Execute now"
                    >
                      <Play className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleSchedule(script.id)}
                      className="p-2 hover:bg-slate-600 rounded-lg transition text-purple-400 hover:text-purple-300"
                      title="Schedule execution"
                    >
                      <Calendar className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                {script.status === 'running' && typeof script.progress === 'number' && (
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-slate-400">Progress</span>
                      <span className="text-xs text-slate-400">{script.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full transition-all"
                        style={{ width: `${script.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Alerts */}
                {script.alerts && script.alerts.length > 0 && (
                  <div className="mb-4 space-y-2">
                    {script.alerts.map((alert: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 p-2 bg-red-900/30 border border-red-800 rounded text-red-200 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Next Run */}
                {script.nextRun && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Zap className="w-4 h-4" />
                    <span>Next scheduled: {new Date(script.nextRun).toLocaleString()}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Schedule Modal */}
        {showScheduleModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 w-full max-w-sm">
              <h2 className="text-xl font-bold text-white mb-4">Schedule Execution</h2>
              <div className="mb-6">
                <label className="block text-slate-300 text-sm font-medium mb-2">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmSchedule}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium"
                >
                  Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}