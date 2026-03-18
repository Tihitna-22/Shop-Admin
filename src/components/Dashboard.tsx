import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { isThisMonth, parseISO, isSameDay, format, startOfMonth, endOfDay, startOfDay, isWithinInterval } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, Receipt, Calendar, Image as ImageIcon, Trash2, X } from 'lucide-react';

export function Dashboard() {
  const { inventory, sales, expenses, deleteSale } = useInventory();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);
  const [saleFilter, setSaleFilter] = useState<'All' | 'In Stock' | 'Ordered'>('All');

  // Calculate Selected Range Profit
  const selectedRangeSales = sales.filter((sale) => {
    const saleDate = parseISO(sale.dateSold);
    return isWithinInterval(saleDate, { start: startOfDay(startDate), end: endOfDay(endDate) });
  });
  const rangeRevenue = selectedRangeSales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const rangeCost = selectedRangeSales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0);
  const rangeProfit = rangeRevenue - rangeCost;

  // Calculate Monthly Profit
  const monthSales = sales.filter((sale) => isThisMonth(parseISO(sale.dateSold)));
  const monthExpenses = expenses.filter((exp) => isThisMonth(parseISO(exp.date)));
  const monthlyRevenue = monthSales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const monthlyCost = monthSales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0);
  const monthlyExpenseTotal = monthExpenses.reduce((sum, exp) => sum + exp.amountETB, 0);
  const monthlyProfit = monthlyRevenue - monthlyCost - monthlyExpenseTotal;

  // Calculate Total Inventory Value
  const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.totalCostPriceETB * item.quantityStocked), 0);
  const totalItemsInStock = inventory.reduce((sum, item) => sum + item.quantityStocked, 0);

  // Calculate Profit by Category (All Time)
  const profitByCategory = sales.reduce((acc, sale) => {
    const cat = sale.category || 'Other';
    const profit = (sale.sellingPriceETB - sale.totalCostPriceETB) * sale.quantitySold;
    acc[cat] = (acc[cat] || 0) + profit;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Financial Analytics</h2>
        <div className="mt-4 sm:mt-0 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-500" />
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={format(startDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                if (!isNaN(newDate.getTime())) {
                  setStartDate(newDate);
                }
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={format(endDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                if (!isNaN(newDate.getTime())) {
                  setEndDate(newDate);
                }
              }}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-black sm:text-sm"
            />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Selected Range Profit Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className={`p-3 rounded-xl ${rangeProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {rangeProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Profit (Selected Range)</p>
              <p className={`text-2xl font-semibold tracking-tight ${rangeProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatETB(rangeProfit)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Revenue: {formatETB(rangeRevenue)}
          </div>
        </div>

        {/* Monthly Profit Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className={`p-3 rounded-xl ${monthlyProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {monthlyProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Net Monthly Profit</p>
              <p className={`text-2xl font-semibold tracking-tight ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatETB(monthlyProfit)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500 flex justify-between">
            <span>Rev: {formatETB(monthlyRevenue)}</span>
            <span className="text-red-500">Exp: {formatETB(monthlyExpenseTotal)}</span>
          </div>
        </div>

        {/* Inventory Value Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <DollarSign className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Inventory Value</p>
              <p className="text-2xl font-semibold tracking-tight text-gray-900">
                {formatETB(totalInventoryValue)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Total cost of current stock
          </div>
        </div>

        {/* Total Items Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Items in Stock</p>
              <p className="text-2xl font-semibold tracking-tight text-gray-900">
                {totalItemsInStock}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Across {inventory.length} unique SKUs
          </div>
        </div>
      </div>

      {/* Profit by Category Breakdown */}
      <div className="mt-8 overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Total Profit by Category</h3>
        <div className="flex flex-wrap gap-4">
          {['Top', 'Dress', 'Trouser', 'Bra'].map(cat => (
            <div key={cat} className="flex items-center px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 min-w-[140px]">
              <span className="text-sm font-medium text-gray-500 w-16">{cat}:</span>
              <span className={`ml-2 text-lg font-semibold ${
                (profitByCategory[cat] || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatETB(profitByCategory[cat] || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Activities Table */}
      <div className="mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h3 className="text-lg font-medium text-gray-900">Activities ({format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')})</h3>
          <div className="flex bg-gray-100 rounded-full p-0.5">
            {(['All', 'In Stock', 'Ordered'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setSaleFilter(status)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  saleFilter === status
                    ? 'bg-white text-black shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Photo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Item</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Customer</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">SKU</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Qty</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Sale Price</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Profit</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date & Time</th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {selectedRangeSales
                  .filter(sale => {
                    if (saleFilter === 'All') return true;
                    if (saleFilter === 'In Stock') return sale.status === 'in_stock' || !sale.status;
                    if (saleFilter === 'Ordered') return sale.status === 'ordered';
                    return true;
                  })
                  .slice()
                  .reverse()
                  .map((sale) => {
                  const profit = (sale.sellingPriceETB - sale.totalCostPriceETB) * sale.quantitySold;
                  const item = inventory.find(i => i.id === sale.itemId);
                  return (
                    <tr key={sale.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                        {item?.image ? (
                          <img
                            src={item.image}
                            alt={sale.itemName}
                            className="h-[50px] w-[50px] rounded-md object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="flex h-[50px] w-[50px] items-center justify-center rounded-md bg-gray-50 border border-gray-200">
                            <ImageIcon className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900">{sale.itemName}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          sale.status === 'ordered' 
                            ? 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-600/20'
                            : 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20'
                        }`}>
                          {sale.status === 'ordered' ? 'Ordered' : 'In Stock'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {sale.customerName || sale.customerPhone || sale.customerTelegram ? (
                          <div className="flex flex-col gap-0.5 text-xs">
                            {sale.customerName && <span className="font-medium text-gray-900">{sale.customerName}</span>}
                            {sale.customerPhone && <span>{sale.customerPhone}</span>}
                            {sale.customerTelegram && <span className="text-indigo-600">{sale.customerTelegram}</span>}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Walk-in</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{sale.sheinSku}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{sale.quantitySold}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatETB(sale.sellingPriceETB)}</td>
                      <td className={`whitespace-nowrap px-3 py-4 text-sm font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatETB(profit)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {format(new Date(sale.dateSold), 'MMM d, h:mm a')}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          onClick={() => setSaleToDelete(sale.id)}
                          className="text-red-600 hover:text-red-900 p-2"
                          title="Delete sale record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {selectedRangeSales.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-sm text-gray-500">
                      No activities recorded in this date range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Delete Sale Record</h3>
              <button
                onClick={() => setSaleToDelete(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this sale record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSaleToDelete(null)}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 border border-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteSale(saleToDelete);
                  setSaleToDelete(null);
                }}
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
