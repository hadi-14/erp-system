"use client";
import { useState, useEffect, Suspense, lazy } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
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
  Settings,
  Code,
  Layout,
  Layers
} from "lucide-react";

type Report = {
  id: number;
  name: string;
  url: string;
  type: 'report';
  slug: string; // Add slug for URL routing
};

type CustomPage = {
  id: number;
  name: string;
  component: string;
  type: 'page';
  description?: string;
  icon?: string;
  slug: string; // Add slug for URL routing
};

type ContentItem = Report | CustomPage;

type User = {
  id: number;
  email: string;
  role: string;
};

// Custom page components registry
const customPageComponents: Record<string, any> = {
  'AmazonSelerRaningsDashboard': lazy(() => import('@/components/reports/seller_rankings')),
  'CompetitorMappingDashboard': lazy(() => import('@/components/reports/seller_comparisions')),
};

function camelize(str: string) {
  return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
    return index === 0 ? word.toUpperCase() : word.toLowerCase();
  }).replace(/\s+/g, '');
}

// Generate slug from name
function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
}

// Custom page loading component
function CustomPageRenderer({ page }: { page: CustomPage }) {
  const Component = customPageComponents[page.component];

  if (!Component) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Component not found</h3>
          <p className="text-gray-600">
            The component "{page.component}" could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading page...</p>
        </div>
      </div>
    }>
      <Component />
    </Suspense>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [customPages, setCustomPages] = useState<CustomPage[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userData, setUserData] = useState<User | null>(null);
  const [contentLoaded, setContentLoaded] = useState(false);

  // Update URL when content is selected
  const updateURL = (item: ContentItem | null) => {
    if (item) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', item.slug);
      router.replace(`?tab=${item.slug}`, { scroll: false });
    } else {
      router.replace('/', { scroll: false });
    }
  };

  // Select content and update URL
  const selectContent = (item: ContentItem) => {
    setSelectedContent(item);
    updateURL(item);
    setSidebarOpen(false);
    if (item.type === 'page') {
      setIsLoading(false);
      setError(false);
    }
  };

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
        const reportsData = (data.reports || []).map((r: any) => ({ 
          ...r, 
          type: 'report' as const,
          slug: r.slug || slugify(r.name) // Use existing slug or generate one
        }));
        setReports(reportsData);
        return reportsData;
      } catch {
        setError(true);
        return [];
      }
    };

    // Load custom pages
    const fetchCustomPages = async () => {
      const defaultPages: CustomPage[] = [
        {
          id: 1,
          name: "Seller Rank",
          component: "AmazonSelerRaningsDashboard",
          type: 'page',
          description: "Check Seller Rankings",
          icon: "BarChart3",
          slug: "seller-rankings"
        },
        {
          id: 2,
          name: "Competitive Pricing",
          component: "CompetitorMappingDashboard",
          type: 'page',
          description: "Compare prices with competitors",
          icon: "BarChart3",
          slug: "competitive-pricing"
        },
      ];
      setCustomPages(defaultPages);
      return defaultPages;
    };

    const loadContent = async () => {
      const [loadedReports, loadedPages] = await Promise.all([
        fetchReports(), 
        fetchCustomPages()
      ]);
      setContentLoaded(true);
      setIsLoading(false);

      // Check for tab parameter in URL
      const tabParam = searchParams.get('tab');
      if (tabParam) {
        // Find matching content by slug
        const allContent = [...loadedReports, ...loadedPages];
        const matchedContent = allContent.find(item => item.slug === tabParam);
        
        if (matchedContent) {
          setSelectedContent(matchedContent);
          if (matchedContent.type === 'page') {
            setIsLoading(false);
            setError(false);
          }
        }
      }
    };

    loadContent();
  }, [router, searchParams]);

  const handleIframeLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError(true);
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const refreshContent = () => {
    if (selectedContent?.type === 'report') {
      setIsLoading(true);
      setError(false);
      const iframe = document.getElementById("reportContainer") as HTMLIFrameElement;
      if (iframe) iframe.src = iframe.src;
    } else {
      // For custom pages, we can trigger a re-render or refresh data
      window.location.reload();
    }
  };

  const allContent = [...reports, ...customPages];
  const filteredContent = allContent.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredReports = filteredContent.filter(item => item.type === 'report') as Report[];
  const filteredPages = filteredContent.filter(item => item.type === 'page') as CustomPage[];

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      router.replace("/login");
    }
  };

  const getIconComponent = (iconName?: string) => {
    const icons: Record<string, any> = {
      BarChart3,
      User,
      Layout,
      Code,
      Layers,
      Settings
    };
    return icons[iconName || 'Layout'];
  };

  const renderContentItem = (item: ContentItem) => {
    const isSelected = selectedContent?.id === item.id && selectedContent?.type === item.type;
    const IconComponent = item.type === 'page' ? getIconComponent((item as CustomPage).icon) : FileText;

    return (
      <button
        key={`${item.type}-${item.id}`}
        onClick={() => selectContent(item)}
        className={`
          w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all group
          ${isSelected
            ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg"
            : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <IconComponent className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
              }`} />
            <div className="text-left">
              <div className="truncate">{item.name}</div>
              {item.type === 'page' && (item as CustomPage).description && (
                <div className={`text-xs truncate ${isSelected ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                  {(item as CustomPage).description}
                </div>
              )}
            </div>
          </div>
          <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-white rotate-90' : 'text-gray-300 group-hover:text-gray-500'
            }`} />
        </div>
      </button>
    );
  };

  return (
    <div className={`min-h-screen flex bg-gray-50 transition-all ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
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
              placeholder="Search reports & pages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-sm"
            />
          </div>
        </div>

        {/* Content List */}
        <div className="flex-1 p-4 overflow-y-auto">
          {/* Custom Pages Section */}
          {filteredPages.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <Code className="w-4 h-4 mr-2" />
                Custom Pages ({filteredPages.length})
              </h3>
              <div className="space-y-2">
                {filteredPages.map(renderContentItem)}
              </div>
            </div>
          )}

          {/* Reports Section */}
          {filteredReports.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Reports ({filteredReports.length})
              </h3>
              <div className="space-y-2">
                {filteredReports.map(renderContentItem)}
              </div>
            </div>
          )}

          {filteredContent.length === 0 && searchTerm && (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm">No content found for &quot;{searchTerm}&quot;</p>
            </div>
          )}

          {allContent.length === 0 && !searchTerm && (
            <div className="text-center py-8 text-gray-500">
              <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-sm">No content available</p>
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
          {/* Add admin switch button if user is admin */}
          {userData?.role === 'ADMIN' && (
            <button
              onClick={() => router.replace('/admin')}
              className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold text-sm hover:from-red-600 hover:to-orange-600 transition-all shadow-lg flex items-center justify-center"
            >
              <Settings className="w-4 h-4 mr-2" />
              Switch to Admin
            </button>
          )}
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
                  {selectedContent ? selectedContent.name : "Select Content"}
                </h1>
                {selectedContent && (
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedContent.type === 'page' ? (
                      <>Interactive page • {(selectedContent as CustomPage).description}</>
                    ) : (
                      <>Interactive report • Last updated just now</>
                    )}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {selectedContent && (
                <>
                  <button
                    onClick={refreshContent}
                    disabled={isLoading}
                    className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    {selectedContent.type === 'page' ? 'Reload' : 'Refresh'}
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

        {/* Content Viewer */}
        <div className="flex-1 relative bg-white">
          {selectedContent ? (
            <>
              {selectedContent.type === 'report' ? (
                <>
                  {/* Loading State for Reports */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                      <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">Loading report...</p>
                        <p className="text-sm text-gray-500 mt-1">This may take a few moments</p>
                      </div>
                    </div>
                  )}

                  {/* Error State for Reports */}
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
                          onClick={refreshContent}
                          className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Try Again
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Report Iframe */}
                  <iframe
                    id="reportContainer"
                    src={(selectedContent as Report).url + `&filterPaneEnabled=false&navContentPaneEnabled=false&actionBarEnabled=false`}
                    className="w-full h-full border-0"
                    allowFullScreen
                    onLoad={handleIframeLoad}
                    onError={handleIframeError}
                    title={selectedContent.name}
                  />
                </>
              ) : (
                /* Custom Page Content */
                <div className="w-full h-full">
                  <CustomPageRenderer page={selectedContent as CustomPage} />
                </div>
              )}
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
                  Select a report or custom page from the sidebar to get started with your data visualization and insights.
                </p>
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-indigo-700 transition-all shadow-lg lg:hidden"
                >
                  Browse Content
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}