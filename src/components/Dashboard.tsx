import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { isToday, isThisMonth, parseISO } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart } from 'lucide-react';

export function Dashboard() {
  const { inventory, sales } = useInventory();

  // Calculate Daily Profit
  const todaySales = sales.filter((sale) => isToday(parseISO(sale.dateSold)));
  const dailyRevenue = todaySales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const dailyCost = todaySales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0);
  const dailyProfit = dailyRevenue - dailyCost;

  // Calculate Monthly Profit
  const monthSales = sales.filter((sale) => isThisMonth(parseISO(sale.dateSold)));
  const monthlyRevenue = monthSales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const monthlyCost = monthSales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0);
  const monthlyProfit = monthlyRevenue - monthlyCost;

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
      <h2 className="text-2xl font-bold tracking-tight text-gray-900">Financial Analytics</h2>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Daily Profit Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className={`p-3 rounded-xl ${dailyProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {dailyProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Daily Profit</p>
              <p className={`text-2xl font-semibold tracking-tight ${dailyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatETB(dailyProfit)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Revenue: {formatETB(dailyRevenue)}
          </div>
        </div>

        {/* Monthly Profit Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className={`p-3 rounded-xl ${monthlyProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {monthlyProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Monthly Profit</p>
              <p className={`text-2xl font-semibold tracking-tight ${monthlyProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatETB(monthlyProfit)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            Revenue: {formatETB(monthlyRevenue)}
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

      {/* Recent Sales Table */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Sales</h3>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Item</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">SKU</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Qty</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Sale Price</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Profit</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sales.slice().reverse().slice(0, 10).map((sale) => {
                  const profit = (sale.sellingPriceETB - sale.totalCostPriceETB) * sale.quantitySold;
                  return (
                    <tr key={sale.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">{sale.itemName}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{sale.sheinSku}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{sale.quantitySold}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatETB(sale.sellingPriceETB)}</td>
                      <td className={`whitespace-nowrap px-3 py-4 text-sm font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatETB(profit)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(sale.dateSold).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
                {sales.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-sm text-gray-500">
                      No sales recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
