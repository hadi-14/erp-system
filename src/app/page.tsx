"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  RefreshCw,
  Maximize2,
  Minimize2,
  FileText,
  Search,
  Menu,
  X,
  ChevronRight,
  AlertCircle,
  User,
  LogOut,
  Settings
} from "lucide-react";

type Report = {
  id: number;
  name: string;
  url: string;
};

type User = {
  id: number;
  email: string;
  role: string;
};

function camelize(str: string) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
    return index === 0 ? word.toUpperCase() : word.toLowerCase();
  }).replace(/\s+/g, '');
}

export default function DashboardPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const data = await res.json();
        setUserData(data.user);
        if (!data.user) router.replace("/login");
      } catch {
        router.replace("/login");
      }
    };
    checkAuth();

    // Load reports
    const fetchReports = async () => {
      try {
        const res = await fetch("/api/reports");
        const data = await res.json();
        setReports(data.reports || []);
        if (data.reports.length > 0) {
          setSelectedReport(data.reports[0]);
        }
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReports();
  }, [router]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError(true);
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const refreshReport = () => {
    setIsLoading(true);
    setError(false);
    const iframe = document.getElementById("reportContainer") as HTMLIFrameElement;
    if (iframe) iframe.src = iframe.src;
  };

  const filteredReports = reports.filter(report =>
    report.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  return (
    <div className={`min-h-screen flex bg-gray-50 transition-all ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        fixed lg:relative lg:translate-x-0 z-30
        w-80 bg-white border-r border-gray-200 shadow-xl lg:shadow-sm
        transition-transform duration-300 ease-in-out
        flex flex-col
      `}>
        {/* Sidebar Header */}
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">


          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {/* <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div> */}
              <Image
                src="/logo.png"
                alt="Logo"
                width={80}
                height={80}
              />
              <div>
                <h2 className="text-xl font-bold text-gray-800">Analytics</h2>
                <p className="text-sm text-gray-500">Dashboard</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/50 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm"
            />
          </div>
        </div>

        {/* Reports List */}
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Reports ({filteredReports.length})
            </h3>
          </div>

          <div className="space-y-2">
            {filteredReports.map((report) => (
              <button
                key={report.id}
                onClick={() => {
                  setSelectedReport(report);
                  setSidebarOpen(false);
                }}
                className={`
                  w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all group
                  ${selectedReport?.id === report.id
                    ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                  }
                `}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FileText className={`w-4 h-4 ${selectedReport?.id === report.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                      }`} />
                    <span className="truncate">{report.name}</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 transition-transform ${selectedReport?.id === report.id ? 'text-white rotate-90' : 'text-gray-300 group-hover:text-gray-500'
                    }`} />
                </div>
              </button>
            ))}
          </div>

          {filteredReports.length === 0 && searchTerm && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm">No reports found for &quot;{searchTerm}&quot;</p>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="p-4 border-t border-gray-100">
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-800">{camelize(userData?.role || '')} User</p>
                <p className="text-xs text-gray-500">{userData?.email}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${userMenuOpen ? 'rotate-90' : ''}`} />
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg py-2">
                <button className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {selectedReport ? selectedReport.name : "Select a Report"}
                </h1>
                {selectedReport && (
                  <p className="text-sm text-gray-500 mt-1">
                    Interactive report • Last updated just now
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {selectedReport && (
                <>
                  <button
                    onClick={refreshReport}
                    disabled={isLoading}
                    className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>

                  <button
                    onClick={toggleFullscreen}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-lg"
                  >
                    {isFullscreen ? (
                      <>
                        <Minimize2 className="w-4 h-4 mr-2" />
                        Exit Fullscreen
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-4 h-4 mr-2" />
                        Fullscreen
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Report Viewer */}
        <div className="flex-1 relative bg-white">
          {selectedReport ? (
            <>
              {/* Loading State */}
              {isLoading && (
                <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading report...</p>
                    <p className="text-sm text-gray-500 mt-1">This may take a few moments</p>
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="absolute inset-0 bg-white flex items-center justify-center">
                  <div className="text-center max-w-md mx-auto p-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load report</h3>
                    <p className="text-gray-600 mb-6">
                      There was an error loading the report. Please try refreshing or contact support if the problem persists.
                    </p>
                    <button
                      onClick={refreshReport}
                      className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Report Content */}
              <iframe
                id="reportContainer"
                src={selectedReport.url}
                className="w-full h-full border-0"
                allowFullScreen
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title={selectedReport.name}
              />
            </>
          ) : (
            /* Empty State */
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md mx-auto p-6">
                <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <BarChart3 className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Analytics Dashboard</h3>
                <p className="text-gray-600 mb-6">
                  Select a report from the sidebar to get started with your data visualization and insights.
                </p>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg lg:hidden"
                >
                  Browse Reports
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}