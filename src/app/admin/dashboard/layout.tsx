// app/dashboard/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Warehouse, Layers, Truck, Menu, X, LogOut, Settings, Monitor } from 'lucide-react';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();

  const navItems = [
    {
      href: '/admin/dashboard/stock',
      label: 'Stock Management',
      icon: BarChart3,
      description: 'Manage inventory items'
    },
    {
      href: '/admin/dashboard/warehouses',
      label: 'Warehouses',
      icon: Warehouse,
      description: 'Manage warehouses'
    },
    {
      href: '/admin/dashboard/racks',
      label: 'Racks',
      icon: Layers,
      description: 'Manage racks'
    },
    {
      href: '/admin/dashboard/transit',
      label: 'Transit',
      icon: Truck,
      description: 'Manage transfers'
    }
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? 'w-64' : 'w-20'
          } bg-gray-800 text-white transition-all duration-300 flex flex-col border-r border-gray-700`}
      >
        {/* Logo Section */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-lg text-white">StockHub</span>
                <p className="text-xs text-gray-400">Inventory System</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative ${active
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className={`text-xs truncate ${active ? 'text-blue-100' : 'text-gray-400'}`}>
                      {item.description}
                    </p>
                  </div>
                )}
                {!sidebarOpen && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-700 rounded whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          {sidebarOpen && (
            <>
              <Link
                href="/admin"
                className="w-full mt-4 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-semibold text-sm hover:from-purple-600 hover:to-indigo-700 transition-all shadow-lg flex items-center justify-center"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Go back to Admin Panel
              </Link>

              <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors text-sm">
                <Settings className="h-4 w-4" />
                Settings
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors text-sm">
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          )}
          {!sidebarOpen && (
            <button className="w-full p-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors text-sm group relative">
              <LogOut className="h-5 w-5 mx-auto" />
              <div className="absolute left-full ml-2 px-3 py-2 bg-gray-700 rounded whitespace-nowrap text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                Logout
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h1 className="text-sm font-semibold text-gray-700">Dashboard</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your inventory efficiently</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="hidden md:flex items-center bg-gray-100 rounded-lg px-3 py-2">
              <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search..."
                className="bg-transparent ml-2 text-sm focus:outline-none w-32"
              />
            </div>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-700">Admin User</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer hover:shadow-lg transition-shadow">
                A
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto bg-gray-50">
          {children}
        </div>
      </div>
    </div>
  );
}