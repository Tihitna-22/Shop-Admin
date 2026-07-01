import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { Download, Search, MoreHorizontal, Box, Clock, Truck, CheckCircle2, Plus, Trash2, Pencil, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ItemForm } from './ItemForm';

export function Orders() {
  const { inventory, sales, markAsSold, deleteItem, deleteSale } = useInventory();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Delivered'>('All');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
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

    return matchesSearch && matchesStatus && matchesDate;
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

  const getPaymentBadge = (status: string) => {
    switch (status) {
      case 'Pending':
        return <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">Pending</span>;
      case 'Paid':
        return <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">Paid</span>;
      case 'Refunded':
        return <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">Refunded</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Orders</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage and track customer orders
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-3">
          <button 
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Create Order
          </button>
          <button className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto">
            <Download className="-ml-1 mr-2 h-4 w-4" />
            Export Orders
          </button>
        </div>
      </div>

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
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['All', 'Pending', 'Delivered'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Date Filter sub-bar */}
        <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center gap-4 text-sm text-gray-600">
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-6 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Items</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th scope="col" className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pre-paid</th>
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
                
                const paymentStatus = !order.isSale ? 'Pending' : 'Paid';
                const orderId = `ORD-${order.id.slice(0, 3).toUpperCase()}`;
                
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap py-4 pl-6 pr-3 text-sm font-medium text-gray-900">
                      {orderId}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{order.customerName || 'Walk-in Customer'}</span>
                        {order.customerTelegram && <span className="text-gray-500 text-xs">@{order.customerTelegram.replace('@', '')}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{order.quantityDisplay}x {order.itemName}</span>
                        {order.selectedSize ? (
                          <span className="text-xs text-gray-500">Size: {order.selectedSize}</span>
                        ) : order.size ? (
                          <span className="text-xs text-gray-500">Size: {order.size}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                      <div className="flex flex-col">
                        <span>{formatETB(order.sellingPriceETB * order.quantityDisplay - (order.discountAmountETB || 0))}</span>
                        {order.discountAmountETB > 0 && (
                          <span className="text-xs text-green-600">-{formatETB(order.discountAmountETB)} discount</span>
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-indigo-600 font-medium">
                      {order.prePaymentETB ? formatETB(order.prePaymentETB) : '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {getStatusBadge(uiStatus)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {getPaymentBadge(paymentStatus)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                      {order.dateDisplay ? format(parseISO(order.dateDisplay), 'dd/MM/yyyy') : 'N/A'}
                    </td>
                    <td className="whitespace-nowrap py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <div className="flex justify-end items-center gap-3">
                        {!order.isSale && (
                          <button 
                            onClick={() => markAsSold(order.id, order.quantityDisplay, order.selectedSize || order.size)}
                            className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 hover:bg-emerald-100"
                            title="Mark as Delivered"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Deliver</span>
                          </button>
                        )}
                        
                        <div className="relative inline-block text-left">
                          <button 
                            onClick={() => setActiveDropdownId(activeDropdownId === order.id ? null : order.id)}
                            className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
                            title="More Actions"
                          >
                            <MoreHorizontal className="h-5 w-5" />
                          </button>

                          {activeDropdownId === order.id && (
                            <>
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDropdownId(null);
                                }}
                              />
                              <div className="absolute right-0 mt-1 w-36 rounded-lg bg-white shadow-lg ring-1 ring-black/5 divide-y divide-gray-100 focus:outline-none z-20 text-left">
                                <div className="py-1">
                                  {!order.isSale && (
                                    <button
                                      onClick={() => {
                                        setActiveDropdownId(null);
                                        handleEdit(order);
                                      }}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900"
                                    >
                                      <Pencil className="h-4 w-4 text-gray-400" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setActiveDropdownId(null);
                                      setOrderToDelete(order);
                                    }}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-900 font-medium"
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-sm text-gray-500">
                    No orders found.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="py-4 pl-6 pr-3 text-sm text-gray-700 font-bold uppercase tracking-wider">
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

      {isFormOpen && (
        <ItemForm 
          item={editingOrder}
          onClose={handleCloseForm} 
          defaultStatus="ordered" 
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
    </div>
  );
}
