"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    RefreshCw,
    Maximize2,
    Minimize2,
    Globe,
    Search,
    Menu,
    X,
    ChevronRight,
    AlertCircle,
    User,
    LogOut,
    Settings,
    ExternalLink,
    Monitor
} from "lucide-react";
import UsersPage from "@/components/admin/users";
import ReportsPage from "@/components/admin/reports";
import AdvancedProductMappingPage from "@/components/admin/product_mapping";
import ProductManagement from "@/components/admin/products";
import OrdersPage from "@/components/admin/orders";
import AdminCompetitorAnalysisPage from "@/components/admin/seller_comparision_management";

type Page = {
    id: number;
    name: string;
    component: React.ComponentType;
    category?: string;
    description?: string;
};

type User = {
    id: number;
    email: string;
    role: string;
};

function camelize(str: string) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
        return index === 0 ? word.toUpperCase() : word.toLowerCase();
    }).replace(/\s+/g, '');
}

export default function AdminPagesPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [pages, setPages] = useState<Page[]>([]);
    const [selectedPage, setSelectedPage] = useState<Page | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [userData, setUserData] = useState<User | null>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>("all");

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await fetch("/api/auth/me", { credentials: "include" });
                if (!res.ok) {
                    router.replace("/login");
                    return;
                }
                const data = await res.json();
                if (!data.user) router.replace("/login");
                if (data.user && data.user.role === "ADMIN") {
                    setUserData(data.user);
                } else {
                    router.replace("/");
                }
            } catch {
                router.replace("/login");
            }
        };
        checkAuth();

        // Load pages - you can replace this with your actual API endpoint
        const fetchPages = async () => {
            try {
                // Mock data - replace with your actual API call
                const mockPages: Page[] = [
                    {
                        id: 1,
                        name: "User Management",
                        component: UsersPage,
                        category: "Management",
                        description: "Manage user accounts and permissions"
                    },
                    {
                        id: 2,
                        name: "Reports Management",
                        component: ReportsPage,
                        category: "Management",
                        description: "Manage website content and pages"
                    },
                    {
                        id: 3,
                        name: "Products Creation",
                        component: ProductManagement,
                        category: "Management",
                        description: "Manage product creation and listings"
                    },
                    {
                        id: 4,
                        name: "Products Mapping",
                        component: AdvancedProductMappingPage,
                        category: "Management",
                        description: "Manage product mappings"
                    },
                    {
                        id: 5,
                        name: "1688 Orders",
                        component: OrdersPage,
                        category: "Management",
                        description: "Manage 1688 orders"
                    },
                    {
                        id: 6,
                        name: "Seller Comparisons",
                        component: AdminCompetitorAnalysisPage,
                        category: "Management",
                        description: "Manage seller comparisons"
                    },
                ];

                // const res = await fetch("/api/admin/pages");
                // const data = await res.json();
                setPages(mockPages);
                if (mockPages.length > 0) {
                    setSelectedPage(mockPages[0]);
                }
            } catch {
                setError(true);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPages();
    }, [router]);

    const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

    const refreshPage = () => {
        setIsLoading(true);
        setError(false);
        const iframe = document.getElementById("pageContainer") as HTMLIFrameElement;
        if (iframe) iframe.src = iframe.src;
    };

    const openInNewTab = () => {
        // No-op or show a message, since components can't be opened in a new tab
        alert("Open in new tab is not supported for embedded components.");
    };

    const filteredPages = pages.filter(page => {
        const matchesSearch = page.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            page.description?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === "all" || page.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const categories = ["all", ...Array.from(new Set(pages.map(page => page.category).filter(Boolean)))];

    const handleLogout = async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/login");
        } catch {
            router.replace("/login");
        }
    };

    return (
        <div className={`max-h-screen flex bg-gray-50 transition-all ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
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
                <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-indigo-50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <Image
                                src="/logo.png"
                                alt="Logo"
                                width={80}
                                height={80}
                            />
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">Admin Panel</h2>
                                <p className="text-sm text-gray-500">Management Console</p>
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
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search pages..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none text-sm"
                        />
                    </div>

                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2">
                        {categories.map((category) => (
                            category && (
                                <button
                                    key={category}
                                    onClick={() => setSelectedCategory(category)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${selectedCategory === category
                                        ? "bg-purple-500 text-white shadow-lg"
                                        : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                                        }`}
                                >
                                    {category === "all" ? "All" : category}
                                </button>
                            )
                        ))}
                    </div>
                </div>

                {/* Pages List */}
                <div className="flex-1 p-4 overflow-y-auto">
                    <div className="mb-4">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                            Admin Pages ({filteredPages.length})
                        </h3>
                    </div>

                    <div className="space-y-2">
                        {filteredPages.map((page) => (
                            <button
                                key={page.id}
                                onClick={() => {
                                    setSelectedPage(page);
                                    setSidebarOpen(false);
                                }}
                                className={`
                  w-full text-left px-4 py-3 rounded-xl text-sm transition-all group
                  ${selectedPage?.id === page.id
                                        ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg"
                                        : "hover:bg-gray-100 text-gray-700 hover:text-gray-900"
                                    }
                `}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                                        <Globe className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selectedPage?.id === page.id ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'
                                            }`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium truncate">{page.name}</div>
                                            {page.description && (
                                                <div className={`text-xs mt-1 line-clamp-2 ${selectedPage?.id === page.id ? 'text-white/80' : 'text-gray-500'
                                                    }`}>
                                                    {page.description}
                                                </div>
                                            )}
                                            {page.category && (
                                                <div className={`inline-block text-xs px-2 py-0.5 rounded-full mt-2 ${selectedPage?.id === page.id
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-gray-200 text-gray-600'
                                                    }`}>
                                                    {page.category}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 transition-transform flex-shrink-0 ${selectedPage?.id === page.id ? 'text-white rotate-90' : 'text-gray-300 group-hover:text-gray-500'
                                        }`} />
                                </div>
                            </button>
                        ))}
                    </div>

                    {filteredPages.length === 0 && searchTerm && (
                        <div className="text-center py-8 text-gray-500">
                            <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-sm">No pages found for &quot;{searchTerm}&quot;</p>
                        </div>
                    )}
                </div>

                {/* User Menu */}
                <div className="p-4 border-t border-gray-100">
                    <div className="relative">
                        <button
                            onClick={() => router.replace('/')}
                            className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 text-white font-semibold text-sm hover:from-red-600 hover:to-orange-600 transition-all shadow-lg flex items-center justify-center"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Switch to Main User Panel
                        </button>
                        <button
                            onClick={() => router.replace('/admin/dashboard/stock')}
                            className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold text-sm hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center"
                        >
                            <Monitor className="w-4 h-4 mr-2" />
                            Main Stock Management
                        </button>
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
                                    {selectedPage ? selectedPage.name : "Select a Page"}
                                </h1>
                                {selectedPage && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        {selectedPage.description || "Admin page"} • {selectedPage.category || "General"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center space-x-3">
                            {selectedPage && (
                                <>
                                    <button
                                        onClick={openInNewTab}
                                        className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all"
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Open in New Tab
                                    </button>

                                    <button
                                        onClick={refreshPage}
                                        disabled={isLoading}
                                        className="inline-flex items-center px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium bg-white hover:bg-gray-50 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                    >
                                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                        Refresh
                                    </button>

                                    <button
                                        onClick={toggleFullscreen}
                                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl text-sm font-medium hover:from-purple-600 hover:to-indigo-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-all shadow-lg"
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

                {/* Page Viewer */}
                <div className="flex-1 relative bg-white">
                    {selectedPage ? (
                        <>
                            {/* Loading State */}
                            {isLoading && (
                                <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-10">
                                    <div className="text-center">
                                        <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin mx-auto mb-4"></div>
                                        <p className="text-gray-600 font-medium">Loading page...</p>
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
                                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load page</h3>
                                        <p className="text-gray-600 mb-6">
                                            There was an error loading the admin page. Please try refreshing or contact support if the problem persists.
                                        </p>
                                        <div className="flex gap-3 justify-center">
                                            <button
                                                onClick={refreshPage}
                                                className="inline-flex items-center px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition-colors"
                                            >
                                                <RefreshCw className="w-4 h-4 mr-2" />
                                                Try Again
                                            </button>
                                            <button
                                                onClick={openInNewTab}
                                                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-800 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4 mr-2" />
                                                Open Direct
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Page Content */}
                            <div className="w-full h-full">
                                <selectedPage.component />
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center max-w-md mx-auto p-6">
                                <div className="w-24 h-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                                    <Monitor className="w-12 h-12 text-gray-400" />
                                </div>
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">Welcome to Admin Panel</h3>
                                <p className="text-gray-600 mb-6">
                                    Select an admin page from the sidebar to manage your system settings, users, and configurations.
                                </p>
                                <button
                                    onClick={() => setSidebarOpen(true)}
                                    className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg lg:hidden"
                                >
                                    Browse Admin Pages
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}