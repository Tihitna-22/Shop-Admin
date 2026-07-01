/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Orders } from './components/Orders';
import { Expenses } from './components/Expenses';
import { Storefront } from './components/Storefront';
import { Settings } from './components/Settings';
import { Auth } from './components/Auth';
import { SetPassword } from './components/SetPassword';
import { Reports } from './components/Reports';
import { Customers } from './components/Customers';
import { DiscountCodes } from './components/DiscountCodes';
import { Marketing } from './components/Marketing';
import { SuperadminDashboard } from './components/SuperadminDashboard';
import { AdminStaffManagement } from './components/AdminStaffManagement';
import { LayoutDashboard, PackageSearch, LogOut, Receipt, Settings as SettingsIcon, ShoppingCart, BarChart3, Store, Users, Tag, Megaphone, ShieldAlert, Users2 } from 'lucide-react';
import { auth } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

function AdminLayout() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'inventory' | 'orders' | 'expenditure' | 'reports' | 'customers' | 'discountCodes' | 'marketing' | 'settings' | 'superadmin' | 'staff'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { settings, userProfile, switchRole, loading: inventoryLoading, userId } = useInventory();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRequiredUid, setPasswordRequiredUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setPasswordRequiredUid(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    if (settings?.shopName) {
      document.title = `${settings.shopName} - Admin Portal`;
    } else {
      document.title = 'Fashion Platform Admin';
    }
  }, [settings?.shopName]);

  if (loading || inventoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          <p className="text-sm text-gray-500 font-serif italic">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (passwordRequiredUid) {
      return <SetPassword uid={passwordRequiredUid} onComplete={() => setPasswordRequiredUid(null)} />;
    }
    return <Auth onSetPasswordRequired={setPasswordRequiredUid} />;
  }

  const NavContent = () => (
    <>
      <div className="p-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[#a94442] flex items-center justify-center text-white font-serif text-xl">
          {settings?.shopName ? settings.shopName.charAt(0).toUpperCase() : 'M'}
        </div>
        <div>
          <h1 className="font-serif font-semibold text-gray-900 text-lg leading-tight">{settings?.shopName || 'Mira Fashion'}</h1>
          <p className="text-xs text-gray-500">Admin Portal</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 mt-4">
        {userProfile?.role === 'superadmin' && (
          <button
            onClick={() => { setActiveTab('superadmin'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'superadmin'
                ? 'bg-indigo-600 text-white'
                : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
            }`}
          >
            <ShieldAlert className="h-5 w-5" />
            Superadmin Panel
          </button>
        )}
        
        {userProfile?.role === 'admin' && (
          <button
            onClick={() => { setActiveTab('staff'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'staff'
                ? 'bg-[#a94442] text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Users2 className="h-5 w-5" />
            Staff Management
          </button>
        )}

        <button
          onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'dashboard'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </button>
        <button
          onClick={() => { setActiveTab('inventory'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'inventory'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <PackageSearch className="h-5 w-5" />
          Inventory
        </button>
        <button
          onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'orders'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <ShoppingCart className="h-5 w-5" />
          Orders
        </button>
        {(userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && (
          <button
            onClick={() => { setActiveTab('expenditure'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'expenditure'
                ? 'bg-[#a94442] text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <Receipt className="h-5 w-5" />
            Expenditure
          </button>
        )}
        {(userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && (
          <button
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'reports'
                ? 'bg-[#a94442] text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="h-5 w-5" />
            Reports
          </button>
        )}
        <button
          onClick={() => { setActiveTab('customers'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'customers'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Users className="h-5 w-5" />
          Customers
        </button>
        <button
          onClick={() => { setActiveTab('discountCodes'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'discountCodes'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Tag className="h-5 w-5" />
          Discount Codes
        </button>
        <button
          onClick={() => { setActiveTab('marketing'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'marketing'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <Megaphone className="h-5 w-5" />
          Marketing
        </button>
        <button
          onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'settings'
              ? 'bg-[#a94442] text-white'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }`}
        >
          <SettingsIcon className="h-5 w-5" />
          Settings
        </button>
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-4">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>

        <Link
          to={`/shop/${userId}`}
          target="_blank"
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
        >
          <Store className="h-4 w-4" />
          View Storefront
        </Link>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl">
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden sm:flex">
        <NavContent />
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="sm:hidden p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-[#a94442] flex items-center justify-center text-white font-serif text-lg">
              {settings?.shopName ? settings.shopName.charAt(0).toUpperCase() : 'M'}
            </div>
            <h1 className="font-serif font-semibold text-gray-900">{settings?.shopName || 'Mira Fashion'}</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-md">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        <div className="p-4 sm:p-8">
          {activeTab === 'superadmin' && userProfile?.role === 'superadmin' && <SuperadminDashboard />}
          {activeTab === 'staff' && userProfile?.role === 'admin' && <AdminStaffManagement />}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'inventory' && <Inventory />}
          {activeTab === 'orders' && <Orders />}
          {activeTab === 'expenditure' && (userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && <Expenses />}
          {activeTab === 'expenditure' && userProfile?.role !== 'admin' && userProfile?.role !== 'superadmin' && <div className="p-8 text-center text-gray-500">You do not have permission to view this page.</div>}
          {activeTab === 'reports' && (userProfile?.role === 'admin' || userProfile?.role === 'superadmin') && <Reports />}
          {activeTab === 'reports' && userProfile?.role !== 'admin' && userProfile?.role !== 'superadmin' && <div className="p-8 text-center text-gray-500">You do not have permission to view this report.</div>}
          {activeTab === 'customers' && <Customers />}
          {activeTab === 'discountCodes' && <DiscountCodes />}
          {activeTab === 'marketing' && <Marketing />}
          {activeTab === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <InventoryProvider>
        <Routes>
          <Route path="/" element={<Storefront />} />
          <Route path="/shop/:shopId" element={<Storefront />} />
          <Route path="/admin" element={<AdminLayout />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </InventoryProvider>
    </BrowserRouter>
  );
}
