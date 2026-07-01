import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { isToday, parseISO, isThisMonth, startOfMonth, endOfDay, startOfDay, isWithinInterval } from 'date-fns';
import { TrendingUp, Box, ShoppingCart, AlertTriangle, ArrowUpRight, ArrowDownRight, Search, Plus, Download, MoreHorizontal } from 'lucide-react';

export function Dashboard() {
  const { inventory, sales, expenses, userProfile } = useInventory();
  const [activeTab, setActiveTab] = useState('Overview');
  const [expenditureTab, setExpenditureTab] = useState('Daily');
  const isAdmin = userProfile?.role === 'admin';

  const activeInventory = inventory.filter(item => 
    item.status !== 'ordered' && !item.customerName && !(Number(item.prePaymentETB) > 0)
  );

  const recentOrders = inventory.filter(item => 
    item.status === 'ordered' || !!item.customerName || (Number(item.prePaymentETB) > 0)
  ).slice(0, 5);
  const recentSales = sales.filter(s => s.status !== 'ordered').slice(0, 5);
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate metrics
  const totalStock = activeInventory.reduce((sum, item) => sum + item.quantityStocked, 0);
  const lowStockItems = activeInventory.filter(item => item.quantityStocked < 5).length;

  const todaysSales = sales.filter(sale => sale.dateSold && isToday(parseISO(sale.dateSold)));
  const todaysOrdersCount = todaysSales.length;
  const todaysRevenue = todaysSales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);

  // For the bottom section (Expenditure Summary)
  // Let's just use all-time or monthly based on the tab, but for now we'll just show some aggregated data
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const totalCost = sales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0) + expenses.reduce((sum, exp) => sum + exp.amountETB, 0);
  const netProfit = totalRevenue - totalCost;
  const totalItemsSold = sales.reduce((sum, sale) => sum + sale.quantitySold, 0);
  const totalOrders = sales.length;

  const filteredInventory = activeInventory.filter(item => 
    (item.itemName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.sheinSku || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Welcome back!</h2>
        <p className="text-gray-500 mt-1">Here's what's happening with your store.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Stock */}
        <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Box className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Stock</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-gray-900">{totalStock}</p>
                <span className="text-sm text-gray-500">items</span>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium">
            <ArrowUpRight className="h-4 w-4 mr-1" />
            <span>+8.2%</span>
            <span className="text-gray-400 ml-1 font-normal">vs last month</span>
          </div>
        </div>

        {/* Today's Orders */}
        <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <ShoppingCart className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Today's Orders</p>
              <p className="text-2xl font-bold tracking-tight text-gray-900">{todaysOrdersCount}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium">
            <ArrowUpRight className="h-4 w-4 mr-1" />
            <span>+12.5%</span>
            <span className="text-gray-400 ml-1 font-normal">vs yesterday</span>
          </div>
        </div>

        {/* Today's Revenue */}
        {isAdmin && (
          <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
            <div className="flex items-center gap-x-4">
              <div className="p-3 rounded-xl bg-red-50 text-[#a94442]">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Today's Revenue</p>
                <p className="text-2xl font-bold tracking-tight text-gray-900">{formatETB(todaysRevenue)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center text-sm text-emerald-600 font-medium">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              <span>+15.3%</span>
              <span className="text-gray-400 ml-1 font-normal">vs yesterday</span>
            </div>
          </div>
        )}

        {/* Low Stock Alert */}
        <div className="overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Low Stock Alert</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight text-gray-900">{lowStockItems}</p>
                <span className="text-sm text-gray-500">items</span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-amber-600 font-medium">
            Needs attention
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 pb-4">
        {['Overview', 'Inventory', isAdmin ? 'Expenditure' : null].filter(Boolean).map((tab) => (
          <button
            key={tab!}
            onClick={() => setActiveTab(tab!)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#a94442] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Orders */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
                  <button className="text-sm text-[#a94442] font-medium hover:text-red-800">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expected Price</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pre-paid</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {order.itemName}
                            {order.size && <span className="text-xs text-gray-400 ml-1">({order.size})</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.customerName || 'Walk-in'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-600/20">
                              Incoming
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatETB(order.sellingPriceETB)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600 font-medium">{order.prePaymentETB ? formatETB(order.prePaymentETB) : '-'}</td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">No recent orders</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Sales */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
                  <button className="text-sm text-[#a94442] font-medium hover:text-red-800">View All</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {recentSales.map((sale) => (
                        <tr key={sale.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{sale.id.slice(0, 6).toUpperCase()}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {sale.itemName}
                            {sale.selectedSize && <span className="text-xs text-gray-400 ml-1">({sale.selectedSize})</span>}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.customerName || 'Walk-in'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatETB(sale.sellingPriceETB * sale.quantitySold)}</td>
                        </tr>
                      ))}
                      {recentSales.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">No recent sales</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Inventory Overview */}
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Inventory Overview</h3>
                <button className="text-sm text-[#a94442] font-medium hover:text-red-800">View All</button>
              </div>
              <div className="p-6 space-y-6">
                {inventory.slice(0, 5).map((item) => {
                  const percentage = Math.min(100, (item.quantityStocked / 100) * 100); // Assuming 100 is max for visual
                  return (
                    <div key={item.id}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-900">{item.itemName}</span>
                        <span className="text-gray-500">{item.quantityStocked} in stock</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${item.quantityStocked < 5 ? 'bg-amber-500' : 'bg-[#a94442]'}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
                {inventory.length === 0 && (
                  <p className="text-center text-sm text-gray-500">No inventory items</p>
                )}
              </div>
            </div>
          </div>

          {/* Expenditure Summary */}
          {isAdmin && (
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-900">Expenditure Summary</h3>
                <div className="flex space-x-2">
                  {['Daily', 'Monthly', 'Custom'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setExpenditureTab(tab)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        expenditureTab === tab
                          ? 'bg-gray-100 text-gray-900'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">{formatETB(totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Total Cost</p>
                  <p className="text-2xl font-bold text-gray-900">{formatETB(totalCost)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Net Profit</p>
                  <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatETB(netProfit)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Items Sold</p>
                  <p className="text-2xl font-bold text-gray-900">{totalItemsSold}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Orders</p>
                  <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {activeTab === 'Inventory' && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold text-gray-900">Stock Management</h3>
          </div>
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative max-w-md w-full">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-[#a94442] sm:text-sm sm:leading-6"
              />
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-[#a94442] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a94442]">
              <Plus className="h-4 w-4" />
              Add Item
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>}
                  {isAdmin && <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInventory.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.itemName}
                      {item.variants && item.variants.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.variants.map((v, idx) => (
                            <span key={idx} className="text-[10px] bg-gray-100 px-1 rounded text-gray-600">
                              {v.size}: {v.quantity}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.sheinSku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.category || 'Uncategorized'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantityStocked}</td>
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatETB(item.totalCostPriceETB)}</td>}
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{formatETB(item.sellingPriceETB)}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        item.quantityStocked === 0 ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20' :
                        item.quantityStocked < 5 ? 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20' :
                        'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                      }`}>
                        {item.quantityStocked === 0 ? 'Sold Out' : item.quantityStocked < 5 ? 'Low Stock' : 'In Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button className="text-gray-400 hover:text-gray-500">
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">No items found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {activeTab === 'Expenditure' && isAdmin && (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-gray-900">Expenditure Summary</h3>
              <button className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="flex space-x-2">
                {['Daily', 'Monthly', 'Custom'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setExpenditureTab(tab)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      expenditureTab === tab
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">{formatETB(totalRevenue)}</p>
                <div className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                  <span>+12.5%</span>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Total Cost</p>
                <p className="text-2xl font-bold text-gray-900">{formatETB(totalCost)}</p>
                <div className="mt-1 flex items-center text-xs text-red-600 font-medium">
                  <ArrowDownRight className="h-3 w-3 mr-1" />
                  <span>-3.2%</span>
                </div>
              </div>
              <div className="bg-emerald-50 -m-4 p-4 rounded-xl">
                <p className="text-sm font-medium text-emerald-800 mb-1">Net Profit</p>
                <p className="text-2xl font-bold text-emerald-600">{formatETB(netProfit)}</p>
                <p className="text-xs text-emerald-600 mt-1">
                  {totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0}% margin
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Items Sold</p>
                <p className="text-2xl font-bold text-gray-900">{totalItemsSold}</p>
                <p className="text-xs text-gray-500 mt-1">units</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Orders</p>
                <p className="text-2xl font-bold text-gray-900">{totalOrders}</p>
                <p className="text-xs text-gray-500 mt-1">completed</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">Expenditure Breakdown</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Stock Purchases</p>
                <p className="text-xl font-bold text-gray-900">{formatETB(inventory.reduce((sum, item) => sum + (item.totalCostPriceETB * item.quantityStocked), 0))}</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Shipping Costs</p>
                <p className="text-xl font-bold text-gray-900">{formatETB(expenses.filter(e => e.category === 'Shipping').reduce((sum, e) => sum + e.amountETB, 0))}</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Marketing</p>
                <p className="text-xl font-bold text-gray-900">{formatETB(expenses.filter(e => e.category === 'Marketing').reduce((sum, e) => sum + e.amountETB, 0))}</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Packaging</p>
                <p className="text-xl font-bold text-gray-900">{formatETB(expenses.filter(e => e.category === 'Packaging').reduce((sum, e) => sum + e.amountETB, 0))}</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Platform Fees</p>
                <p className="text-xl font-bold text-gray-900">{formatETB(expenses.filter(e => e.category === 'Platform Fees').reduce((sum, e) => sum + e.amountETB, 0))}</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-1">Other Expenses</p>
                <p className="text-xl font-bold text-gray-900">{formatETB(expenses.filter(e => !['Shipping', 'Marketing', 'Packaging', 'Platform Fees'].includes(e.category)).reduce((sum, e) => sum + e.amountETB, 0))}</p>
                <p className="text-xs text-gray-400 mt-1">This month</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

