import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { isThisMonth, parseISO, isSameDay, format } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart, Receipt, Calendar, Image as ImageIcon } from 'lucide-react';

export function Dashboard() {
  const { inventory, sales, expenses } = useInventory();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Calculate Selected Day Profit
  const selectedDaySales = sales.filter((sale) => isSameDay(parseISO(sale.dateSold), selectedDate));
  const dailyRevenue = selectedDaySales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const dailyCost = selectedDaySales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0);
  const dailyProfit = dailyRevenue - dailyCost;

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
          <input
            type="date"
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              if (!isNaN(newDate.getTime())) {
                setSelectedDate(newDate);
              }
            }}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Daily Profit Card */}
        <div className="overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-900/5">
          <div className="flex items-center gap-x-4">
            <div className={`p-3 rounded-xl ${dailyProfit >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
              {dailyProfit >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Profit on {format(selectedDate, 'MMM d')}</p>
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
        <h3 className="text-lg font-medium text-gray-900 mb-4">Activities on {format(selectedDate, 'MMMM d, yyyy')}</h3>
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Photo</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Item</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">SKU</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Qty</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Sale Price</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Profit</th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {selectedDaySales.slice().reverse().map((sale) => {
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{sale.sheinSku}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{sale.quantitySold}</td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{formatETB(sale.sellingPriceETB)}</td>
                      <td className={`whitespace-nowrap px-3 py-4 text-sm font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {formatETB(profit)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {new Date(sale.dateSold).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
                {selectedDaySales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                      No activities recorded on this day.
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
