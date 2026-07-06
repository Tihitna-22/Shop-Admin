import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { Download, Search, MoreHorizontal, Box, Clock, Truck, CheckCircle2, Plus, Trash2, Pencil, Calendar, Upload, Send, MessageSquare, Eye, TrendingUp, Info, X } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ItemForm } from './ItemForm';
import { BulkImportOrders } from './BulkImportOrders';

function getTelegramLink(tg: string) {
  const clean = tg.replace('@', '').trim();
  return `https://t.me/${clean}`;
}

function getWhatsAppLink(phone: string) {
  let clean = phone.replace(/[^\d]/g, '');
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '251' + clean.substring(1);
  }
  return `https://wa.me/${clean}`;
}

export function Orders() {
  const { 
    inventory, 
    sales, 
    markAsSold, 
    deleteItem, 
    deleteSale,
    updateSale,
    updateItem,
    wholeOrders,
    addWholeOrder,
    updateWholeOrder,
    deleteWholeOrder
  } = useInventory();
  
  const [activeTab, setActiveTab] = useState<'customer_orders' | 'whole_orders'>('customer_orders');
  const [woSearchQuery, setWoSearchQuery] = useState('');
  const [woStatusFilter, setWoStatusFilter] = useState<'All' | 'ordered' | 'received' | 'completed'>('All');
  const [isWholeOrderFormOpen, setIsWholeOrderFormOpen] = useState(false);
  const [editingWholeOrder, setEditingWholeOrder] = useState<any>(null);
  const [wholeOrderToDelete, setWholeOrderToDelete] = useState<any>(null);
  const [viewingWholeOrderDetails, setViewingWholeOrderDetails] = useState<any>(null);

  // Whole order form field states
  const [woFormId, setWoFormId] = useState('');
  const [woFormName, setWoFormName] = useState('');
  const [woFormDate, setWoFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [woFormShipping, setWoFormShipping] = useState('');
  const [woFormCustoms, setWoFormCustoms] = useState('');
  const [woFormOther, setWoFormOther] = useState('');
  const [woFormStatus, setWoFormStatus] = useState<'ordered' | 'received' | 'completed'>('ordered');

  const openWholeOrderForm = (order: any = null) => {
    if (order) {
      setEditingWholeOrder(order);
      setWoFormId(order.id);
      setWoFormName(order.orderName || '');
      setWoFormDate(order.dateOrdered || '');
      setWoFormShipping(order.orderShippingCostETB?.toString() || '');
      setWoFormCustoms(order.orderCustomsTaxETB?.toString() || '');
      setWoFormOther(order.orderOtherExpensesETB?.toString() || '');
      setWoFormStatus(order.status || 'ordered');
    } else {
      setEditingWholeOrder(null);
      setWoFormId('');
      setWoFormName('');
      setWoFormDate(format(new Date(), 'yyyy-MM-dd'));
      setWoFormShipping('');
      setWoFormCustoms('');
      setWoFormOther('');
      setWoFormStatus('ordered');
    }
    setIsWholeOrderFormOpen(true);
  };

  const handleWholeOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!woFormId.trim()) return;
    
    const newOrder = {
      id: woFormId.trim().toUpperCase(),
      userId: editingWholeOrder ? (editingWholeOrder.userId || '') : '',
      orderName: woFormName.trim(),
      dateOrdered: woFormDate,
      orderShippingCostETB: Number(woFormShipping) || 0,
      orderCustomsTaxETB: Number(woFormCustoms) || 0,
      orderOtherExpensesETB: Number(woFormOther) || 0,
      status: woFormStatus,
    };
    
    try {
      if (editingWholeOrder) {
        await updateWholeOrder(editingWholeOrder.id, newOrder);
      } else {
        await addWholeOrder(newOrder);
      }
      setIsWholeOrderFormOpen(false);
      setEditingWholeOrder(null);
    } catch (err) {
      console.error('Error saving whole order:', err);
    }
  };

  const handleWholeOrderDelete = async () => {
    if (!wholeOrderToDelete) return;
    try {
      await deleteWholeOrder(wholeOrderToDelete.id);
      
      // Also unlink any items that were linked to this order
      const linkedItems = inventory.filter(item => item.orderId === wholeOrderToDelete.id);
      for (const item of linkedItems) {
        await updateItem(item.id, { orderId: '' });
      }

      // Also unlink any sales that were linked to this order
      const linkedSales = sales.filter(sale => sale.orderId === wholeOrderToDelete.id);
      for (const sale of linkedSales) {
        await updateSale(sale.id, { orderId: '' });
      }

      setWholeOrderToDelete(null);
    } catch (err) {
      console.error('Error deleting whole order:', err);
    }
  };

  // Whole Orders Stats Calculator
  const getBatchStats = (order: any) => {
    const bItems = inventory.filter(item => item.orderId === order.id);
    const bSales = sales.filter(sale => sale.orderId === order.id);
    
    // Total quantities
    const invQty = bItems.reduce((sum, item) => sum + (item.quantityStocked || 0), 0);
    const salesQty = bSales.reduce((sum, sale) => sum + (sale.quantitySold || 0), 0);
    const totalQty = invQty + salesQty;
    
    // Product Buying Cost (excluding shipping/customs/etc)
    const invBuying = bItems.reduce((sum, item) => sum + ((item.buyingPriceUSD || 0) * (item.exchangeRate || 1) * (item.quantityStocked || 0)), 0);
    const salesBuying = bSales.reduce((sum, sale) => {
      const origItem = inventory.find(i => i.id === sale.itemId);
      const buyingPriceUSD = origItem ? (origItem.buyingPriceUSD || 0) : 0;
      const exchangeRate = origItem ? (origItem.exchangeRate || 1) : 1;
      
      if (buyingPriceUSD > 0) {
        return sum + (buyingPriceUSD * exchangeRate * (sale.quantitySold || 0));
      } else {
        const estBuying = (sale.totalCostPriceETB || 0) * 0.85; 
        return sum + (estBuying * (sale.quantitySold || 0));
      }
    }, 0);
    const totalProductBuyingETB = invBuying + salesBuying;
    
    // Individual Allocated Item Expenses (item-level shipping, customs, local delivery)
    const invAllocated = bItems.reduce((sum, item) => {
      const allocated = (item.shippingCostETB || 0) + (item.customsTaxETB || 0) + (item.localDeliveryFeeETB || 0);
      return sum + (allocated * (item.quantityStocked || 0));
    }, 0);
    const salesAllocated = bSales.reduce((sum, sale) => {
      const origItem = inventory.find(i => i.id === sale.itemId);
      const allocated = origItem 
        ? ((origItem.shippingCostETB || 0) + (origItem.customsTaxETB || 0) + (origItem.localDeliveryFeeETB || 0))
        : 0;
      return sum + (allocated * (sale.quantitySold || 0));
    }, 0);
    const totalAllocatedItemExpenses = invAllocated + salesAllocated;
    
    // Order-Level Expenses
    const orderShipping = Number(order.orderShippingCostETB) || 0;
    const orderCustoms = Number(order.orderCustomsTaxETB) || 0;
    const orderOther = Number(order.orderOtherExpensesETB) || 0;
    const totalOrderExpenses = orderShipping + orderCustoms + orderOther;
    
    // Total Order Investment
    const totalOrderInvestment = totalProductBuyingETB + totalAllocatedItemExpenses + totalOrderExpenses;
    
    // Projected Revenue (if all items sell at target sellingPriceETB)
    const invProjectedRev = bItems.reduce((sum, item) => sum + ((item.sellingPriceETB || 0) * (item.quantityStocked || 0)), 0);
    const salesProjectedRev = bSales.reduce((sum, sale) => sum + ((sale.sellingPriceETB || 0) * (sale.quantitySold || 0)), 0);
    const totalProjectedRevenue = invProjectedRev + salesProjectedRev;
    
    // Realized Revenue (actual sales)
    const totalRealizedRevenue = bSales.reduce((sum, sale) => sum + ((sale.sellingPriceETB * sale.quantitySold) - (sale.discountAmountETB || 0)), 0);
    
    // Projected Profit
    const projectedProfit = totalProjectedRevenue - totalOrderInvestment;
    
    // Realized Gains (cashflow balance)
    const realizedGains = totalRealizedRevenue - totalOrderInvestment;
    
    // Sold-Items Profit (Unit Cost = Product Buying + Allocated + (Order-Level Expenses / Total Qty))
    const orderLevelPerUnit = totalQty > 0 ? (totalOrderExpenses / totalQty) : 0;
    
    const soldItemsCost = bSales.reduce((sum, sale) => {
      const origItem = inventory.find(i => i.id === sale.itemId);
      const itemBuyingCost = origItem ? ((origItem.buyingPriceUSD || 0) * (origItem.exchangeRate || 1)) : ((sale.totalCostPriceETB || 0) * 0.85);
      const itemAllocatedExpenses = origItem ? ((origItem.shippingCostETB || 0) + (origItem.customsTaxETB || 0) + (origItem.localDeliveryFeeETB || 0)) : 0;
      const unitTotalCost = itemBuyingCost + itemAllocatedExpenses + orderLevelPerUnit;
      return sum + (unitTotalCost * (sale.quantitySold || 0));
    }, 0);
    const soldItemsProfit = totalRealizedRevenue - soldItemsCost;
    
    return {
      totalQty,
      invQty,
      salesQty,
      totalProductBuyingETB,
      totalAllocatedItemExpenses,
      totalOrderExpenses,
      totalOrderInvestment,
      totalProjectedRevenue,
      totalRealizedRevenue,
      projectedProfit,
      realizedGains,
      soldItemsCost,
      soldItemsProfit,
      items: [
        ...bItems.map(i => ({ ...i, isSold: false, quantity: i.quantityStocked })),
        ...bSales.map(s => ({ ...s, isSold: true, quantity: s.quantitySold }))
      ]
    };
  };

  // Calculate aggregate metrics across all batches
  const activeBatchesCount = wholeOrders?.length || 0;
  
  let totalInvestmentSum = 0;
  let totalRealizedRevenueSum = 0;
  let totalExpectedRevenueSum = 0;
  let totalSoldItemsProfitSum = 0;
  let totalGainsSum = 0;
  
  wholeOrders?.forEach(order => {
    const stats = getBatchStats(order);
    totalInvestmentSum += stats.totalOrderInvestment;
    totalRealizedRevenueSum += stats.totalRealizedRevenue;
    totalExpectedRevenueSum += stats.totalProjectedRevenue;
    totalSoldItemsProfitSum += stats.soldItemsProfit;
    totalGainsSum += stats.realizedGains;
  });

  const filteredWholeOrders = wholeOrders?.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(woSearchQuery.toLowerCase()) ||
      (order.orderName || '').toLowerCase().includes(woSearchQuery.toLowerCase());
      
    const matchesStatus = woStatusFilter === 'All' || order.status === woStatusFilter;
    
    return matchesSearch && matchesStatus;
  }) || [];

  const renderWholeOrdersTab = () => {
    return (
      <div className="space-y-6">
        {/* Whole Orders Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-50 text-[#a94442]">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Batches</p>
              <span className="text-2xl font-bold tracking-tight text-gray-900">{activeBatchesCount}</span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Investment</p>
              <span className="text-xl font-bold tracking-tight text-gray-900 font-mono text-blue-700">
                {formatETB(totalInvestmentSum)}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Sold-Items Profit</p>
              <span className="text-xl font-bold tracking-tight text-gray-900 font-mono text-emerald-700">
                {formatETB(totalSoldItemsProfitSum)}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-50 text-indigo-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Net Cashflow</p>
              <span className={`text-xl font-bold tracking-tight font-mono ${totalGainsSum >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {totalGainsSum >= 0 ? '+' : ''}{formatETB(totalGainsSum)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Search controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm ring-1 ring-gray-900/5 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID or Batch Name..."
              value={woSearchQuery}
              onChange={(e) => setWoSearchQuery(e.target.value)}
              className="pl-9 w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            />
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Status:</label>
            <select
              value={woStatusFilter}
              onChange={(e) => setWoStatusFilter(e.target.value as any)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="All">All Statuses</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Whole Orders Table */}
        <div className="bg-white shadow-sm ring-1 ring-gray-900/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Batch Info</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Items Qty</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales Rev</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sold-Items Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Cashflow</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredWholeOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-10 text-center text-sm text-gray-500">
                      No whole orders or batches found. Click "New Whole Order / Batch" to start tracking.
                    </td>
                  </tr>
                ) : (
                  filteredWholeOrders.map((order) => {
                    const stats = getBatchStats(order);
                    return (
                      <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{order.id}</div>
                          {order.orderName && (
                            <div className="text-xs text-gray-500 italic">{order.orderName}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {order.dateOrdered ? format(parseISO(order.dateOrdered), 'MMM dd, yyyy') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {order.status === 'completed' && (
                            <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                              Completed
                            </span>
                          )}
                          {order.status === 'received' && (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/10">
                              Received
                            </span>
                          )}
                          {order.status === 'ordered' && (
                            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/10">
                              Ordered
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {stats.totalQty} <span className="text-gray-400 text-xs">({stats.salesQty} sold)</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {formatETB(stats.totalOrderInvestment)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono text-emerald-600">
                          {formatETB(stats.totalRealizedRevenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-emerald-700 font-mono">
                          {formatETB(stats.soldItemsProfit)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold font-mono ${stats.realizedGains >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {stats.realizedGains >= 0 ? '+' : ''}{formatETB(stats.realizedGains)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setViewingWholeOrderDetails(order)}
                              title="View Details"
                              className="inline-flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 text-xs font-semibold text-indigo-700 cursor-pointer transition-all"
                            >
                              <Eye className="h-3 w-3" />
                              <span>View</span>
                            </button>
                            <button
                              onClick={() => openWholeOrderForm(order)}
                              title="Edit"
                              className="inline-flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 cursor-pointer transition-all"
                            >
                              <Pencil className="h-3 w-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setWholeOrderToDelete(order)}
                              title="Delete"
                              className="inline-flex items-center gap-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 cursor-pointer transition-all"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Delivered'>('All');
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Fully Paid' | 'Balance Due'>('All');
  const [batchFilter, setBatchFilter] = useState<string>('All');
  const [selectedOrderKeys, setSelectedOrderKeys] = useState<string[]>([]);
  const [selectedOrderForBatch, setSelectedOrderForBatch] = useState<any>(null);
  const [batchSelectValue, setBatchSelectValue] = useState<string>('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isBulkBatchModalOpen, setIsBulkBatchModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [dateFilterType, setDateFilterType] = useState<'all' | 'today' | 'monthly' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const toggleSelectOrder = (key: string) => {
    setSelectedOrderKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = (visibleOrders: any[]) => {
    const visibleKeys = visibleOrders.map(order => order.isSale ? `sale-${order.id}` : `item-${order.id}`);
    const allSelected = visibleKeys.length > 0 && visibleKeys.every(k => selectedOrderKeys.includes(k));
    if (allSelected) {
      setSelectedOrderKeys(prev => prev.filter(k => !visibleKeys.includes(k)));
    } else {
      setSelectedOrderKeys(prev => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

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

  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingOrder(null);
  };

  const confirmDelete = () => {
    if (orderToDelete) {
      if (orderToDelete.isSale) {
        deleteSale(orderToDelete.id);
      } else {
        deleteItem(orderToDelete.id);
      }
      setOrderToDelete(null);
    }
  };

  // Only show inventory orders
  const activeOrders = inventory
    .filter(item => item.status === 'ordered' || !!item.customerName || (Number(item.prePaymentETB) > 0))
    .map(item => ({
      ...item,
      isSale: false,
      dateDisplay: item.dateAdded,
      quantityDisplay: item.quantityStocked,
    }));

  // Show delivered orders from sales
  const deliveredOrders = sales
    .filter(sale => sale.status === 'delivered')
    .map(sale => ({
      ...sale,
      isSale: true,
      dateDisplay: sale.dateSold,
      quantityDisplay: sale.quantitySold,
    }));

  const allOrders = [...activeOrders, ...deliveredOrders]
    .sort((a, b) => new Date(b.dateDisplay).getTime() - new Date(a.dateDisplay).getTime());

  const filteredOrders = allOrders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customerName && order.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.customerPhone && order.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (order.customerTelegram && order.customerTelegram.toLowerCase().includes(searchQuery.toLowerCase()));

    let uiStatus = 'Pending';
    if (order.isSale) {
      uiStatus = 'Delivered';
    } else {
      if (order.status === 'ordered') uiStatus = 'Pending';
    }
    
    const matchesStatus = statusFilter === 'All' || uiStatus === statusFilter;

    const matchesDate = checkDateFilter(order.dateDisplay);

    const totalPrice = (order.sellingPriceETB * order.quantityDisplay) - (order.discountAmountETB || 0);
    const prepayment = order.isSale ? totalPrice : (Number(order.prePaymentETB) || 0);
    const remaining = totalPrice - prepayment;

    const matchesPayment = paymentFilter === 'All' || (() => {
      if (paymentFilter === 'Fully Paid') {
        return remaining <= 0;
      } else { // 'Balance Due'
        return remaining > 0;
      }
    })();

    const matchesBatch = batchFilter === 'All' || 
                         (batchFilter === 'None' && !order.orderId) ||
                         (order.orderId === batchFilter);

    return matchesSearch && matchesStatus && matchesDate && matchesPayment && matchesBatch;
  });

  // Calculate metrics
  const totalOrders = allOrders.length;
  const pendingOrders = allOrders.filter(o => !o.isSale && o.status === 'ordered').length;
  const deliveredCount = allOrders.filter(o => o.isSale).length;

  const totalOrdersValue = allOrders.reduce((sum, o) => sum + ((o.sellingPriceETB * o.quantityDisplay) - (o.discountAmountETB || 0)), 0);
  const pendingOrdersValue = allOrders.filter(o => !o.isSale && o.status === 'ordered')
    .reduce((sum, o) => sum + ((o.sellingPriceETB * o.quantityDisplay) - (o.discountAmountETB || 0)), 0);
  const pendingPrepaidValue = allOrders.filter(o => !o.isSale && o.status === 'ordered')
    .reduce((sum, o) => sum + (Number(o.prePaymentETB) || 0), 0);
  const deliveredOrdersValue = allOrders.filter(o => o.isSale)
    .reduce((sum, o) => sum + ((o.sellingPriceETB * o.quantityDisplay) - (o.discountAmountETB || 0)), 0);

  // Filtered orders total calculations
  const filteredOrdersQtySum = filteredOrders.reduce((sum, o) => sum + o.quantityDisplay, 0);
  const filteredOrdersValueSum = filteredOrders.reduce((sum, o) => sum + ((o.sellingPriceETB * o.quantityDisplay) - (o.discountAmountETB || 0)), 0);
  const filteredOrdersPrepaidSum = filteredOrders.reduce((sum, o) => sum + (Number(o.prePaymentETB) || 0), 0);
  
  const filteredOrdersRemainingSum = filteredOrders.reduce((sum, o) => {
    const totalPrice = (o.sellingPriceETB * o.quantityDisplay) - (o.discountAmountETB || 0);
    const prepayment = o.isSale ? totalPrice : (Number(o.prePaymentETB) || 0);
    return sum + (totalPrice - prepayment);
  }, 0);

  const filteredOrdersProfitSum = filteredOrders.reduce((sum, o) => {
    const totalPrice = (o.sellingPriceETB * o.quantityDisplay) - (o.discountAmountETB || 0);
    const cost = (o.totalCostPriceETB || 0) * o.quantityDisplay;
    return sum + (totalPrice - cost);
  }, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Pending</span>;
      case 'Confirmed':
        return <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-600/20">Confirmed</span>;
      case 'Processing':
        return <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/20">Processing</span>;
      case 'Shipped':
        return <span className="inline-flex items-center rounded-md bg-cyan-50 px-2 py-1 text-xs font-medium text-cyan-700 ring-1 ring-inset ring-cyan-600/20">Shipped</span>;
      case 'Delivered':
        return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Delivered</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">Cancelled</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">{status}</span>;
    }
  };

  const getPaymentBadge = (remaining: number) => {
    if (remaining <= 0) {
      return (
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
          Fully Paid
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20">
          Balance Due
        </span>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Conditional Page Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            {activeTab === 'customer_orders' ? 'Customer Orders' : 'Whole Orders & Batches'}
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === 'customer_orders' 
              ? 'Manage and track customer orders' 
              : 'Track shipping, customs, other expenses, and actual profits per whole order batch'}
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap gap-3">
          {activeTab === 'customer_orders' ? (
            <>
              <button 
                onClick={() => setIsFormOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto"
              >
                <Plus className="-ml-1 mr-2 h-4 w-4" />
                Create Order
              </button>
              <button 
                onClick={() => setIsBulkImportOpen(true)}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto"
              >
                <Upload className="-ml-1 mr-2 h-4 w-4 text-[#a94442]" />
                Bulk Import
              </button>
              <button className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto">
                <Download className="-ml-1 mr-2 h-4 w-4" />
                Export Orders
              </button>
            </>
          ) : (
            <button 
              onClick={() => openWholeOrderForm(null)}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto"
            >
              <Plus className="-ml-1 mr-2 h-4 w-4" />
              New Whole Order / Batch
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('customer_orders')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-all ${
              activeTab === 'customer_orders'
                ? 'border-[#a94442] text-[#a94442]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Customer Orders
          </button>
          <button
            onClick={() => setActiveTab('whole_orders')}
            className={`whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium transition-all ${
              activeTab === 'whole_orders'
                ? 'border-[#a94442] text-[#a94442]'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Whole Orders Tracker
          </button>
        </nav>
      </div>

      {activeTab === 'customer_orders' ? (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-50 text-[#a94442]">
                <Box className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-gray-900">{totalOrders}</span>
                  <span className="text-sm text-gray-500">({formatETB(totalOrdersValue)})</span>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-50 text-amber-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Pending Orders</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-gray-900">{pendingOrders}</span>
                  <span className="text-sm text-amber-700 font-semibold">({formatETB(pendingOrdersValue)})</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Prepaid: <span className="font-semibold text-indigo-600 font-mono">{formatETB(pendingPrepaidValue)}</span>
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Delivered Orders</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-gray-900">{deliveredCount}</span>
                  <span className="text-sm text-emerald-700 font-semibold">({formatETB(deliveredOrdersValue)})</span>
                </div>
              </div>
            </div>
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
              placeholder="Search by order #, customer name, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full rounded-md border-0 py-2 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#a94442] sm:text-sm sm:leading-6"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['All', 'Pending', 'Delivered'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    statusFilter === status
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1">
              {(['All', 'Fully Paid', 'Balance Due'] as const).map((pType) => (
                <button
                  key={pType}
                  onClick={() => setPaymentFilter(pType)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                    paymentFilter === pType
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {pType}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Date Filter & Batch Filter sub-bar */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#a94442]" />
                Filter by Order Date:
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

          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700 flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-[#a94442]" />
              Filter by Batch:
            </span>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="rounded-md border-0 py-1.5 px-3 bg-white text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-[#a94442] text-xs font-semibold cursor-pointer"
            >
              <option value="All">All Batches</option>
              <option value="None">Unbatched Only</option>
              {wholeOrders?.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.id} {batch.orderName ? `(${batch.orderName})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrderKeys.length > 0 && (
          <div className="bg-indigo-50/70 border-b border-indigo-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-indigo-600 text-xs font-bold text-white">
                {selectedOrderKeys.length}
              </span>
              <span className="text-sm font-semibold text-indigo-900">items selected for batch actions</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setBatchSelectValue('');
                  setIsBulkBatchModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all focus:outline-none"
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Link to Batch</span>
              </button>
              <button
                onClick={async () => {
                  if (confirm(`Are you sure you want to remove batch code from the ${selectedOrderKeys.length} selected items?`)) {
                    try {
                      const promises = selectedOrderKeys.map(async (key) => {
                        const isSale = key.startsWith('sale-');
                        const id = isSale ? key.replace('sale-', '') : key.replace('item-', '');
                        
                        if (isSale) {
                          return updateSale(id, { orderId: '' });
                        } else {
                          return updateItem(id, { orderId: '' });
                        }
                      });
                      
                      await Promise.all(promises);
                      setSelectedOrderKeys([]);
                    } catch (err) {
                      console.error('Error removing batch from selected:', err);
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-all"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
                <span>Unlink Batch</span>
              </button>
              <button
                onClick={() => setSelectedOrderKeys([])}
                className="text-xs font-medium text-gray-500 hover:text-gray-700"
              >
                Cancel Selection
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="relative py-3.5 pl-4 pr-3 text-left w-12">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-gray-300 text-[#a94442] focus:ring-[#a94442] cursor-pointer"
                    checked={filteredOrders.length > 0 && filteredOrders.every(order => selectedOrderKeys.includes(order.isSale ? `sale-${order.id}` : `item-${order.id}`))}
                    onChange={() => toggleSelectAll(filteredOrders)}
                  />
                </th>
                <th scope="col" className="py-3.5 pl-2 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pre-paid</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remaining</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profit</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th scope="col" className="relative py-3.5 pl-3 pr-6 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredOrders.map((order) => {
                let uiStatus = 'Delivered';
                if (!order.isSale) {
                  if (order.status === 'ordered') uiStatus = 'Pending';
                }
                
                const orderId = `ORD-${order.id.slice(0, 3).toUpperCase()}`;
                const totalPrice = (order.sellingPriceETB * order.quantityDisplay) - (order.discountAmountETB || 0);
                const prepayment = order.isSale ? totalPrice : (Number(order.prePaymentETB) || 0);
                const remainingBalance = totalPrice - prepayment;
                const totalCost = (order.totalCostPriceETB || 0) * order.quantityDisplay;
                const profit = totalPrice - totalCost;
                const orderKey = order.isSale ? `sale-${order.id}` : `item-${order.id}`;
                const isSelected = selectedOrderKeys.includes(orderKey);
                
                return (
                  <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-indigo-50/40' : ''}`}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 text-[#a94442] focus:ring-[#a94442] cursor-pointer"
                        checked={isSelected}
                        onChange={() => toggleSelectOrder(orderKey)}
                      />
                    </td>
                    <td className="whitespace-nowrap py-4 pl-2 pr-3 text-sm font-medium text-gray-900">
                      {orderId}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-gray-900">{order.customerName || 'Walk-in Customer'}</span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {order.customerTelegram && (
                            <a
                              href={getTelegramLink(order.customerTelegram)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded transition-all"
                              title="Chat on Telegram"
                            >
                              <Send className="h-2.5 w-2.5" />
                              <span>@{order.customerTelegram.replace('@', '')}</span>
                            </a>
                          )}
                          {order.customerPhone && (
                            <a
                              href={getWhatsAppLink(order.customerPhone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded transition-all"
                              title="Chat on WhatsApp"
                            >
                              <MessageSquare className="h-2.5 w-2.5" />
                              <span>{order.customerPhone}</span>
                            </a>
                          )}
                          {!order.customerTelegram && !order.customerPhone && (
                            <span className="text-xs text-gray-400">No contact info</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-3">
                        {order.image ? (
                          <img
                            src={order.image}
                            alt={order.itemName}
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 rounded-md object-cover ring-1 ring-gray-900/10"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-50 flex items-center justify-center border border-dashed border-gray-200">
                            <Box className="h-5 w-5 text-gray-300" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{order.quantityDisplay}x {order.itemName}</span>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {order.selectedSize ? (
                              <span className="text-xs text-gray-500">Size: {order.selectedSize}</span>
                            ) : order.size ? (
                              <span className="text-xs text-gray-500">Size: {order.size}</span>
                            ) : null}
                            
                            {/* Interactive Batch Badge */}
                            {order.orderId ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderForBatch(order);
                                  setBatchSelectValue(order.orderId || '');
                                  setIsBatchModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 cursor-pointer transition-all"
                                title="Click to assign or change batch"
                              >
                                <Truck className="h-2.5 w-2.5" />
                                <span>{order.orderId}</span>
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrderForBatch(order);
                                  setBatchSelectValue('');
                                  setIsBatchModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-400 cursor-pointer transition-all"
                                title="Click to link to a batch"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>No Batch</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                      <div className="flex flex-col">
                        <span>{formatETB(totalPrice)}</span>
                        {order.discountAmountETB > 0 && (
                          <span className="text-xs text-green-600">-{formatETB(order.discountAmountETB)} discount</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-indigo-600 font-medium">
                      {prepayment > 0 ? formatETB(prepayment) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">
                      {remainingBalance > 0 ? (
                        <span className="text-amber-700 font-bold">{formatETB(remainingBalance)}</span>
                      ) : (
                        <span className="text-gray-400 font-normal">-</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold">
                      {profit >= 0 ? (
                        <span className="text-emerald-700">+{formatETB(profit)}</span>
                      ) : (
                        <span className="text-red-600">{formatETB(profit)}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {getStatusBadge(uiStatus)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {getPaymentBadge(remainingBalance)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {order.dateDisplay ? format(parseISO(order.dateDisplay), 'dd/MM/yyyy') : 'N/A'}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <div className="flex justify-end items-center gap-2">
                        {!order.isSale && (
                          <button 
                            onClick={() => markAsSold(order.id, order.quantityDisplay, order.selectedSize || order.size)}
                            className="inline-flex items-center gap-1 rounded bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 cursor-pointer transition-all"
                            title="Mark as Delivered"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Deliver</span>
                          </button>
                        )}
                        
                        {!order.isSale && (
                          <button
                            onClick={() => handleEdit(order)}
                            className="inline-flex items-center gap-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 cursor-pointer transition-all"
                            title="Edit"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                        )}

                        <button
                          onClick={() => setOrderToDelete(order)}
                          className="inline-flex items-center gap-1 rounded bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 cursor-pointer transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-sm text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={3} className="py-4 pl-6 pr-3 text-sm text-gray-700 font-bold uppercase tracking-wider">
                    Filtered Totals:
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900">
                    {filteredOrdersQtySum} units
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-emerald-700 font-mono">
                    {formatETB(filteredOrdersValueSum)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-indigo-600 font-mono">
                    {filteredOrdersPrepaidSum > 0 ? formatETB(filteredOrdersPrepaidSum) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-amber-700 font-mono">
                    {filteredOrdersRemainingSum > 0 ? formatETB(filteredOrdersRemainingSum) : '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-emerald-700 font-mono">
                    {filteredOrdersProfitSum >= 0 ? '+' : ''}{formatETB(filteredOrdersProfitSum)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
          
          <div className="border-t border-gray-200 px-6 py-3 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Showing 1 to {filteredOrders.length} of {filteredOrders.length} orders
            </div>
            <div className="flex items-center gap-2">
              <button className="p-1 rounded-md border border-gray-300 text-gray-400 hover:bg-gray-50 disabled:opacity-50">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </button>
              <span className="text-sm text-gray-700">Page 1 of 1</span>
              <button className="p-1 rounded-md border border-gray-300 text-gray-400 hover:bg-gray-50 disabled:opacity-50">
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
      ) : (
        renderWholeOrdersTab()
      )}

      {isFormOpen && (
        <ItemForm 
          item={editingOrder}
          onClose={handleCloseForm} 
          defaultStatus="ordered" 
        />
      )}

      {isBulkImportOpen && (
        <BulkImportOrders 
          onClose={() => setIsBulkImportOpen(false)} 
        />
      )}

      {orderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Order</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this order ({`ORD-${orderToDelete.id.slice(0, 3).toUpperCase()}`})? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
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

      {/* Single Batch Assignment Modal */}
      {isBatchModalOpen && selectedOrderForBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#a94442]" />
              Link Item to Batch / Whole Order
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Select which Whole Order or Shipping Batch <strong>{selectedOrderForBatch.quantityDisplay}x {selectedOrderForBatch.itemName}</strong> belongs to.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch / Whole Order</label>
                <select
                  value={batchSelectValue}
                  onChange={(e) => setBatchSelectValue(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[#a94442] focus:outline-none focus:ring-1 focus:ring-[#a94442] sm:text-sm"
                >
                  <option value="">-- None (Individual Item) --</option>
                  {wholeOrders?.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.id} {wo.orderName ? `(${wo.orderName})` : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-500">
                  Linking an item links its sales margins and metrics with the batch's total shipping, customs, and local expenses.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsBatchModalOpen(false);
                  setSelectedOrderForBatch(null);
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (selectedOrderForBatch.isSale) {
                      await updateSale(selectedOrderForBatch.id, { orderId: batchSelectValue });
                    } else {
                      await updateItem(selectedOrderForBatch.id, { orderId: batchSelectValue });
                    }
                    setIsBatchModalOpen(false);
                    setSelectedOrderForBatch(null);
                  } catch (err) {
                    console.error('Error linking item to batch:', err);
                  }
                }}
                className="rounded-md bg-[#a94442] px-4 py-2 text-sm font-medium text-white hover:bg-[#8c3533]"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Batch Assignment Modal */}
      {isBulkBatchModalOpen && selectedOrderKeys.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Truck className="h-5 w-5 text-[#a94442]" />
              Bulk Link {selectedOrderKeys.length} Items to Batch
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Assign all {selectedOrderKeys.length} selected items/sales to a single batch at once.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Batch / Whole Order</label>
                <select
                  value={batchSelectValue}
                  onChange={(e) => setBatchSelectValue(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-[#a94442] focus:outline-none focus:ring-1 focus:ring-[#a94442] sm:text-sm"
                >
                  <option value="">-- None (Individual Items) --</option>
                  {wholeOrders?.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.id} {wo.orderName ? `(${wo.orderName})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsBulkBatchModalOpen(false);
                }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const promises = selectedOrderKeys.map(async (key) => {
                      const isSale = key.startsWith('sale-');
                      const id = isSale ? key.replace('sale-', '') : key.replace('item-', '');
                      
                      if (isSale) {
                        return updateSale(id, { orderId: batchSelectValue });
                      } else {
                        return updateItem(id, { orderId: batchSelectValue });
                      }
                    });
                    
                    await Promise.all(promises);
                    setIsBulkBatchModalOpen(false);
                    setSelectedOrderKeys([]);
                  } catch (err) {
                    console.error('Error bulk linking items to batch:', err);
                  }
                }}
                className="rounded-md bg-[#a94442] px-4 py-2 text-sm font-medium text-white hover:bg-[#8c3533]"
              >
                Save Bulk Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whole Order Add/Edit Modal */}
      {isWholeOrderFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingWholeOrder ? 'Edit Whole Order / Batch' : 'Add New Whole Order / Batch'}
            </h2>
            <form onSubmit={handleWholeOrderSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Order ID / Batch Code</label>
                <input
                  type="text"
                  required
                  disabled={!!editingWholeOrder}
                  placeholder="e.g. SHEIN-2026-07"
                  value={woFormId}
                  onChange={(e) => setWoFormId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
                />
                {!editingWholeOrder && (
                  <p className="mt-1 text-xs text-gray-500">
                    Enter a unique, short code (e.g., SHEIN-01). You will link inventory items to this code.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Order/Batch Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Clothes Batch"
                  value={woFormName}
                  onChange={(e) => setWoFormName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date Ordered</label>
                  <input
                    type="date"
                    required
                    value={woFormDate}
                    onChange={(e) => setWoFormDate(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={woFormStatus}
                    onChange={(e) => setWoFormStatus(e.target.value as any)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                  >
                    <option value="ordered">Ordered</option>
                    <option value="received">Received</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Order-Level Overhead Expenses (ETB)</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Shipping Cost</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={woFormShipping}
                      onChange={(e) => setWoFormShipping(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Customs / Tax</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={woFormCustoms}
                      onChange={(e) => setWoFormCustoms(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500">Other Overhead</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={woFormOther}
                      onChange={(e) => setWoFormOther(e.target.value)}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black text-sm"
                    />
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-gray-500">
                  These are unallocated expenses for the entire batch. They will be distributed to items to calculate exact unit margins and actual sold-items profits.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => setIsWholeOrderFormOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  {editingWholeOrder ? 'Save Changes' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Whole Order Details analysis popup */}
      {viewingWholeOrderDetails && (() => {
        const stats = getBatchStats(viewingWholeOrderDetails);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl my-8">
              <div className="flex items-center justify-between border-b border-gray-200 pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Batch Details: {viewingWholeOrderDetails.id}</h2>
                  {viewingWholeOrderDetails.orderName && (
                    <p className="text-sm text-gray-500">{viewingWholeOrderDetails.orderName}</p>
                  )}
                </div>
                <button
                  onClick={() => setViewingWholeOrderDetails(null)}
                  className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100 font-bold text-xl"
                >
                  &times;
                </button>
              </div>

              {/* Financial analysis cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Total Cost Price</div>
                  <div className="text-lg font-bold text-gray-900 font-mono mt-1">
                    {formatETB(stats.totalOrderInvestment)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 space-y-0.5">
                    <div>Product cost: {formatETB(stats.totalProductBuyingETB)}</div>
                    <div>Allocated: {formatETB(stats.totalAllocatedItemExpenses)}</div>
                    <div>Overhead: {formatETB(stats.totalOrderExpenses)}</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Sales Revenue</div>
                  <div className="text-lg font-bold text-emerald-600 font-mono mt-1">
                    {formatETB(stats.totalRealizedRevenue)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Projected total: {formatETB(stats.totalProjectedRevenue)}
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Sold-Items Profit</div>
                  <div className="text-lg font-bold text-emerald-700 font-mono mt-1">
                    {formatETB(stats.soldItemsProfit)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Profit on sold units, factoring overhead
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase font-semibold">Actual Net Cashflow</div>
                  <div className={`text-lg font-bold font-mono mt-1 ${stats.realizedGains >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {stats.realizedGains >= 0 ? '+' : ''}{formatETB(stats.realizedGains)}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Cash in hand minus all upfront investment
                  </div>
                </div>
              </div>

              {/* Linked Items Table */}
              <div>
                <h3 className="text-md font-bold text-gray-900 mb-3">Linked Inventory & Sold Items ({stats.items.length})</h3>
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Item Name / SKU</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Size</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Total Unit Cost</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Selling Price</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200 text-sm">
                      {stats.items.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                            No items are currently linked to this batch. Edit an inventory item to link it to this batch code.
                          </td>
                        </tr>
                      ) : (
                        stats.items.map((item, idx) => {
                          const itemBuying = (item.buyingPriceUSD || 0) * (item.exchangeRate || 1);
                          const itemAllocated = (item.shippingCostETB || 0) + (item.customsTaxETB || 0) + (item.localDeliveryFeeETB || 0);
                          const overheadShare = stats.totalQty > 0 ? (stats.totalOrderExpenses / stats.totalQty) : 0;
                          const finalUnitCost = itemBuying + itemAllocated + overheadShare;
                          
                          return (
                            <tr key={idx} className={item.isSold ? 'bg-gray-50' : ''}>
                              <td className="px-4 py-2">
                                <div className="font-medium text-gray-950">{item.itemName}</div>
                                <div className="text-xs text-gray-400 font-mono">{item.sheinSku || '-'}</div>
                              </td>
                              <td className="px-4 py-2 text-gray-600">{item.selectedSize || item.size || '-'}</td>
                              <td className="px-4 py-2 font-mono">{item.quantity || 1}</td>
                              <td className="px-4 py-2">
                                {item.isSold ? (
                                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/10">
                                    Sold & Delivered
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-600/10">
                                    On Hand / Stock
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2 font-mono text-gray-600">{formatETB(finalUnitCost)}</td>
                              <td className="px-4 py-2 font-mono text-emerald-600 font-medium">
                                {formatETB(item.sellingPriceETB || 0)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
                <button
                  onClick={() => setViewingWholeOrderDetails(null)}
                  className="rounded-md bg-black px-5 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Whole Order Delete Confirmation Modal */}
      {wholeOrderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Whole Order / Batch</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete the batch order ({wholeOrderToDelete.id})? 
              This will also unlink all items currently associated with this batch. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setWholeOrderToDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleWholeOrderDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
