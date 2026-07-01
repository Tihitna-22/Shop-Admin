import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { ItemForm } from './ItemForm';
import { BulkImport } from './BulkImport';
import { Plus, Edit2, Trash2, CheckCircle2, Image as ImageIcon, X, Upload, Download, Search, Filter, MoreHorizontal, Box, TrendingUp, AlertTriangle, Share2, Loader2, Calendar } from 'lucide-react';
import { toPng } from 'html-to-image';

export function Inventory() {
  const { inventory, sales, deleteItem, deleteSale, markAsSold, updateItemStatus, userProfile, customers, discountCodes } = useInventory();
  const isAdmin = userProfile?.role === 'admin';
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [sellingItem, setSellingItem] = useState<any>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedDiscountCodeId, setSelectedDiscountCodeId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [activeTab, setActiveTab] = useState<'In Stock' | 'Sold'>('In Stock');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [posterItem, setPosterItem] = useState<any>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'monthly' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Date filtering helper
  const checkDateFilter = (dateStr: string) => {
    if (!dateStr) return false;
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return false;

    const now = new Date();
    
    if (dateFilterType === 'today') {
      return dateObj.toDateString() === now.toDateString();
    } else if (dateFilterType === 'monthly') {
      return dateObj.getMonth() === now.getMonth() && dateObj.getFullYear() === now.getFullYear();
    } else if (dateFilterType === 'custom') {
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return dateObj >= start && dateObj <= end;
      } else if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        return dateObj >= start;
      } else if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return dateObj <= end;
      }
    }
    return true;
  };

  // Calculate metrics
  const activeInventory = inventory.filter(item => 
    item.status !== 'ordered' && !item.customerName && !(Number(item.prePaymentETB) > 0)
  );
  const totalItems = activeInventory.length;
  const totalStock = activeInventory.reduce((sum, item) => sum + item.quantityStocked, 0);
  const lowStockCount = activeInventory.filter(item => item.quantityStocked > 0 && item.quantityStocked < 5).length;
  const outOfStockCount = activeInventory.filter(item => item.quantityStocked === 0).length;
  const inventoryValue = activeInventory.reduce((sum, item) => sum + (item.sellingPriceETB * item.quantityStocked), 0);
  const totalCostValue = activeInventory.reduce((sum, item) => sum + ((item.totalCostPriceETB || 0) * item.quantityStocked), 0);

  const filteredInventory = inventory.filter(item => {
    if (item.status === 'ordered' || !!item.customerName || (Number(item.prePaymentETB) > 0)) return false;
    
    const matchesSearch = (item.itemName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (item.sheinSku?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'All Status') {
      matchesStatus = item.quantityStocked > 0;
    } else if (statusFilter === 'In Stock') {
      matchesStatus = item.quantityStocked >= 5;
    } else if (statusFilter === 'Low Stock') {
      matchesStatus = item.quantityStocked > 0 && item.quantityStocked < 5;
    } else if (statusFilter === 'Sold Out') {
      matchesStatus = item.quantityStocked === 0;
    }

    const matchesDate = checkDateFilter(item.dateAdded);

    return matchesSearch && matchesStatus && matchesDate;
  });

  const filteredSales = sales.filter(sale => {
    // Only walk-in customer bought items should be listed (exclude custom pre-orders/delivered orders)
    const isCustomOrder = sale.status === 'delivered' || !!sale.customerName || (Number(sale.prePaymentETB) > 0);
    if (isCustomOrder) return false;

    const matchesSearch = (sale.itemName?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || 
                          (sale.sheinSku?.toLowerCase() || '').includes(searchQuery.toLowerCase());

    const matchesDate = checkDateFilter(sale.dateSold);

    return matchesSearch && matchesDate;
  });

  // Filtered lists total calculations
  const filteredStockQtySum = filteredInventory.reduce((sum, item) => sum + item.quantityStocked, 0);
  const filteredStockCostSum = filteredInventory.reduce((sum, item) => sum + ((item.totalCostPriceETB || 0) * item.quantityStocked), 0);
  const filteredStockPriceSum = filteredInventory.reduce((sum, item) => sum + (item.sellingPriceETB * item.quantityStocked), 0);

  const filteredSalesQtySum = filteredSales.reduce((sum, s) => sum + s.quantitySold, 0);
  const filteredSalesCostSum = filteredSales.reduce((sum, s) => sum + ((s.totalCostPriceETB || 0) * s.quantitySold), 0);
  const filteredSalesPriceSum = filteredSales.reduce((sum, s) => sum + (s.sellingPriceETB * s.quantitySold - (s.discountAmountETB || 0)), 0);

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteItem(itemToDelete);
      setItemToDelete(null);
    }
  };

  const handleDeleteSale = (id: string) => {
    setSaleToDelete(id);
  };

  const confirmDeleteSale = () => {
    if (saleToDelete) {
      deleteSale(saleToDelete);
      setSaleToDelete(null);
    }
  };

  const handleDownloadPoster = async () => {
    const posterElement = document.getElementById('product-poster');
    if (!posterElement || !posterItem) return;

    setIsGeneratingPoster(true);
    try {
      const dataUrl = await toPng(posterElement, { quality: 0.95, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${posterItem.itemName.replace(/\s+/g, '-').toLowerCase()}-poster.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Error generating poster:', err);
    } finally {
      setIsGeneratingPoster(false);
    }
  };

  const handleSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (sellingItem) {
      let discountAmount = 0;
      if (selectedDiscountCodeId) {
        const code = discountCodes.find(c => c.id === selectedDiscountCodeId);
        if (code) {
          discountAmount = code.discountType === 'percentage'
            ? sellingItem.sellingPriceETB * (code.discountValue / 100)
            : code.discountValue;
        }
      }

      markAsSold(
        sellingItem.id, 
        sellQuantity, 
        selectedSize as any || undefined, 
        selectedCustomerId || undefined, 
        selectedDiscountCodeId || undefined, 
        discountAmount
      );
      setSellingItem(null);
      setSellQuantity(1);
      setSelectedSize('');
      setSelectedCustomerId('');
      setSelectedDiscountCodeId('');
    }
  };

  const handleMarkDelivered = async (item: any) => {
    if (item.quantityStocked > 0) {
      await markAsSold(item.id, item.quantityStocked);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Inventory Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your product stock and inventory
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <button
            onClick={() => setIsBulkImportOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto"
          >
            <Upload className="-ml-1 mr-2 h-4 w-4" />
            Import
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto"
          >
            <Download className="-ml-1 mr-2 h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-[#a94442] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Add Item
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-50 text-[#a94442]">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Items</p>
            <p className="text-xl font-bold tracking-tight text-gray-900">{totalItems}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Total Stock</p>
            <p className="text-xl font-bold tracking-tight text-gray-900">{totalStock}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Low Stock</p>
            <p className="text-xl font-bold tracking-tight text-gray-900">{lowStockCount}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <Box className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Sold Out</p>
            <p className="text-xl font-bold tracking-tight text-gray-900">{outOfStockCount}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Stock Value (Retail)</p>
            <p className="text-xl font-bold tracking-tight text-gray-900">{formatETB(inventoryValue)}</p>
            {isAdmin && (
              <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                Cost: <span className="font-mono text-[#a94442] font-semibold">{formatETB(totalCostValue)}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('In Stock')}
            className={`${
              activeTab === 'In Stock'
                ? 'border-[#a94442] text-[#a94442]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            In Stock
          </button>
          <button
            onClick={() => setActiveTab('Sold')}
            className={`${
              activeTab === 'Sold'
                ? 'border-[#a94442] text-[#a94442]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Sold Items
          </button>
        </nav>
      </div>

      {/* Filters and Table */}
      <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#a94442] sm:text-sm sm:leading-6"
            />
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'In Stock' && (
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[#a94442] sm:text-sm sm:leading-6"
              >
                <option value="All Status">All Status</option>
                <option value="In Stock">In Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Sold Out">Sold Out</option>
              </select>
            )}
          </div>
        </div>

        {/* Date Filter sub-bar */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-4 text-sm text-gray-600">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-[#a94442]" />
              Filter by Date {activeTab === 'In Stock' ? 'Added' : 'Sold'}:
            </span>
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                onClick={() => setDateFilterType('all')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-l-md border ${
                  dateFilterType === 'all'
                    ? 'bg-[#a94442] text-white border-[#a94442]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                All Time
              </button>
              <button
                type="button"
                onClick={() => setDateFilterType('today')}
                className={`px-3 py-1.5 text-xs font-semibold border-t border-b border-gray-300 ${
                  dateFilterType === 'today'
                    ? 'bg-[#a94442] text-white border-[#a94442]'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setDateFilterType('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold border-t border-b border-gray-300 ${
                  dateFilterType === 'monthly'
                    ? 'bg-[#a94442] text-white border-[#a94442]'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => setDateFilterType('custom')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-r-md border ${
                  dateFilterType === 'custom'
                    ? 'bg-[#a94442] text-white border-[#a94442]'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pick Date
              </button>
            </div>
          </div>

          {dateFilterType === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-md border-0 py-1 px-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[#a94442] text-xs"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-md border-0 py-1 px-2 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[#a94442] text-xs"
              />
              {(customStartDate || customEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="text-xs text-red-600 hover:text-red-900 font-medium ml-1"
                >
                  Clear Range
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {activeTab === 'In Stock' ? (
                  <>
                    <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sizes</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                    {isAdmin && <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>}
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Sold</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty Sold</th>
                    {isAdmin && <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>}
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {activeTab === 'In Stock' ? (
                filteredInventory.map((item) => {
                  const sizes = item.size ? item.size.split(',').map(s => s.trim()) : [];
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                        {item.image ? (
                          <img src={item.image} alt={item.itemName} className="h-10 w-10 rounded-md object-cover cursor-pointer" onClick={() => setLightboxImage(item.image || null)} />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                        {item.itemName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {item.sheinSku}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {item.category || 'Uncategorized'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        <div className="flex flex-wrap gap-1 max-w-[150px]">
                          {item.variants && item.variants.length > 0 ? (
                            item.variants.map((v, idx) => (
                              <span key={idx} className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
                                {v.size}: {v.quantity}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                              {item.size}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {item.quantityStocked}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatETB(item.totalCostPriceETB)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                        {formatETB(item.sellingPriceETB)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          item.quantityStocked === 0 ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                          item.quantityStocked < 5 ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' :
                          'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                        }`}>
                          {item.quantityStocked === 0 ? 'Sold Out' : item.quantityStocked < 5 ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => setPosterItem(item)}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                            title="Generate Poster"
                          >
                            <Share2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Share</span>
                          </button>
                          <button 
                            onClick={() => setSellingItem(item)}
                            className="text-emerald-600 hover:text-emerald-900 flex items-center gap-1"
                            title="Mark as Sold"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs font-medium">Sell</span>
                          </button>
                          <button 
                            onClick={() => handleEdit(item)}
                            className="text-indigo-600 hover:text-indigo-900"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(item.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                filteredSales.map((sale) => {
                  const saleImage = sale.image || inventory.find(i => i.id === sale.itemId)?.image;
                  return (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                        {saleImage ? (
                          <img src={saleImage} alt={sale.itemName} className="h-10 w-10 rounded-md object-cover cursor-pointer" onClick={() => setLightboxImage(saleImage)} />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100 flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(sale.dateSold).toLocaleDateString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">
                        {sale.itemName}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {sale.sheinSku}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {sale.category || 'Uncategorized'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {sale.quantitySold} {sale.selectedSize && <span className="text-xs text-gray-500 ml-1">({sale.selectedSize})</span>}
                      </td>
                      {isAdmin && (
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatETB(sale.totalCostPriceETB)}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                        {formatETB(sale.sellingPriceETB)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {sale.customerName || 'Walk-in'}
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => handleDeleteSale(sale.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete Sold Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
              {activeTab === 'In Stock' && filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-gray-500">
                    No items found.
                  </td>
                </tr>
              )}
              {activeTab === 'Sold' && filteredSales.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-sm text-gray-500">
                    No sold items found.
                  </td>
                </tr>
              )}
            </tbody>
            {((activeTab === 'In Stock' && filteredInventory.length > 0) || (activeTab === 'Sold' && filteredSales.length > 0)) && (
              <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t-2 border-gray-200">
                {activeTab === 'In Stock' ? (
                  <tr>
                    <td colSpan={5} className="py-4 pl-6 pr-3 text-sm text-gray-700 font-bold uppercase tracking-wider">
                      Filtered Totals:
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900">
                      {filteredStockQtySum} units
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-[#a94442] font-mono">
                        {formatETB(filteredStockCostSum)}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-emerald-700 font-mono">
                      {formatETB(filteredStockPriceSum)}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 pl-6 pr-3 text-sm text-gray-700 font-bold uppercase tracking-wider">
                      Filtered Totals:
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900">
                      {filteredSalesQtySum} sold
                    </td>
                    {isAdmin && (
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-[#a94442] font-mono">
                        {formatETB(filteredSalesCostSum)}
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-emerald-700 font-mono">
                      {formatETB(filteredSalesPriceSum)}
                    </td>
                    <td colSpan={3}></td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Item</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this item? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Sold Item Record</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this sold item record? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSaleToDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSale}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {isFormOpen && (
        <ItemForm
          item={editingItem}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {isBulkImportOpen && (
        <BulkImport onClose={() => setIsBulkImportOpen(false)} />
      )}

      {sellingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mark as Sold</h3>
            <form onSubmit={handleSell}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Item</label>
                <p className="mt-1 text-sm text-gray-900 font-medium">{sellingItem.itemName}</p>
              </div>

              {sellingItem.variants && sellingItem.variants.length > 0 && (
                <div className="mb-4">
                  <label htmlFor="size" className="block text-sm font-medium text-gray-700">Select Size</label>
                  <select
                    id="size"
                    required
                    value={selectedSize}
                    onChange={(e) => {
                      const size = e.target.value;
                      setSelectedSize(size);
                      const variant = sellingItem.variants.find((v: any) => v.size === size);
                      if (variant && sellQuantity > variant.quantity) {
                        setSellQuantity(variant.quantity);
                      }
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                  >
                    <option value="">Select a size...</option>
                    {sellingItem.variants.map((v: any) => (
                      <option key={v.size} value={v.size} disabled={v.quantity === 0}>
                        {v.size} ({v.quantity} available)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Quantity to Sell</label>
                <input
                  type="number"
                  id="quantity"
                  min="1"
                  max={selectedSize && sellingItem.variants ? sellingItem.variants.find((v: any) => v.size === selectedSize)?.quantity : sellingItem.quantityStocked}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Available: {selectedSize && sellingItem.variants ? sellingItem.variants.find((v: any) => v.size === selectedSize)?.quantity : sellingItem.quantityStocked}
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="customer" className="block text-sm font-medium text-gray-700">Link to Customer (Optional)</label>
                <select
                  id="customer"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                >
                  <option value="">Guest / Walk-in</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone || c.email || 'No contact'})</option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label htmlFor="discount" className="block text-sm font-medium text-gray-700">Apply Discount Code (Optional)</label>
                <select
                  id="discount"
                  value={selectedDiscountCodeId}
                  onChange={(e) => setSelectedDiscountCodeId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                >
                  <option value="">No Discount</option>
                  {discountCodes.filter(d => d.isActive).map(d => (
                    <option key={d.id} value={d.id}>
                      {d.code} (-{d.discountType === 'percentage' ? `${d.discountValue}%` : formatETB(d.discountValue)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSellingItem(null);
                    setSellQuantity(1);
                    setSelectedSize('');
                    setSelectedCustomerId('');
                    setSelectedDiscountCodeId('');
                  }}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {posterItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-medium text-gray-900">Product Poster</h3>
              <button onClick={() => setPosterItem(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-gray-100">
              {/* Poster Container (9:16 Aspect Ratio for Stories) */}
              <div 
                id="product-poster"
                className="w-[320px] h-[568px] bg-white relative overflow-hidden shadow-lg flex flex-col"
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#a94442]/10 rounded-bl-full -mr-8 -mt-8" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gray-50 rounded-tr-full -ml-12 -mb-12" />
                
                {/* Image Section */}
                <div className="h-3/5 w-full p-6 relative z-10">
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-md bg-gray-50">
                    {posterItem.image ? (
                      <img 
                        src={posterItem.image} 
                        alt={posterItem.itemName} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-20 w-20 text-gray-200" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Section */}
                <div className="flex-1 p-8 flex flex-col justify-between relative z-10">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#a94442] mb-2">
                      {posterItem.category || 'New Arrival'}
                    </p>
                    <h2 className="text-2xl font-serif font-bold text-gray-900 leading-tight mb-2">
                      {posterItem.itemName}
                    </h2>
                    <div className="h-0.5 w-12 bg-gray-200 mb-4" />
                    <p className="text-sm text-gray-500 font-light leading-relaxed line-clamp-3">
                      Premium quality {posterItem.category?.toLowerCase() || 'item'} available now. 
                      Limited stock available. Grab yours before it's gone!
                    </p>
                  </div>

                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Price</p>
                      <p className="text-2xl font-bold text-gray-900">{formatETB(posterItem.sellingPriceETB)}</p>
                    </div>
                    <div className="bg-black text-white px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest">
                      Shop Now
                    </div>
                  </div>
                </div>

                {/* Footer Branding */}
                <div className="p-4 bg-gray-50 flex justify-center border-t border-gray-100">
                  <p className="text-[8px] uppercase tracking-[0.2em] text-gray-400 font-bold">
                    Mira Fashion • Premium Collection
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setPosterItem(null)}
                className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDownloadPoster}
                disabled={isGeneratingPoster}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-black text-white rounded-xl hover:bg-gray-800 font-medium transition-all"
              >
                {isGeneratingPoster ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download for Story
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
