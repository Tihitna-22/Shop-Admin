import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { Plus, Download, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Trash2 } from 'lucide-react';
import { ExpenseCategory } from '../types';
import { format, parseISO } from 'date-fns';

export function Expenses() {
  const { expenses, sales, addExpense, deleteExpense, deleteSale } = useInventory();
  const [activeTab, setActiveTab] = useState<'Overview' | 'Expenses' | 'Revenue'>('Overview');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'Today' | 'This Week' | 'This Month' | 'Custom'>('This Month');
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [saleToDelete, setSaleToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    description: '',
    amountETB: '',
    category: 'Other' as ExpenseCategory,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addExpense({
      description: formData.description,
      amountETB: Number(formData.amountETB) || 0,
      category: formData.category,
    });
    setFormData({ description: '', amountETB: '', category: 'Other' });
    setIsFormOpen(false);
  };

  const confirmDeleteExpense = () => {
    if (expenseToDelete) {
      deleteExpense(expenseToDelete);
      setExpenseToDelete(null);
    }
  };

  const confirmDeleteSale = () => {
    if (saleToDelete) {
      deleteSale(saleToDelete);
      setSaleToDelete(null);
    }
  };

  // Calculate metrics
  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.sellingPriceETB * sale.quantitySold), 0);
  const totalCostOfGoods = sales.reduce((sum, sale) => sum + (sale.totalCostPriceETB * sale.quantitySold), 0);
  const totalOtherExpenses = expenses.reduce((sum, exp) => sum + exp.amountETB, 0);
  const totalExpenses = totalCostOfGoods + totalOtherExpenses;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';
  const totalOrders = sales.length;
  const totalItemsSold = sales.reduce((sum, sale) => sum + sale.quantitySold, 0);

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Expenditure</h2>
          <p className="mt-1 text-sm text-gray-500">
            Track revenue, expenses, and profit margins
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center gap-3">
          <button className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto">
            <Download className="-ml-1 mr-2 h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-[#a94442] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-4 w-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Time Filter */}
      <div className="flex bg-gray-100 rounded-lg p-1 w-fit">
        {(['Today', 'This Week', 'This Month', 'Custom'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setTimeFilter(filter)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              timeFilter === filter
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">{formatETB(totalRevenue)}</p>
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-50 text-red-600">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-red-600">{formatETB(totalExpenses)}</p>
            <p className="text-sm font-medium text-gray-500">Total Expenses</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-600">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-emerald-600">{formatETB(netProfit)}</p>
            <p className="text-sm font-medium text-gray-500">Net Profit</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-red-50 text-[#a94442]">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-gray-900">{totalOrders}</p>
            <p className="text-sm font-medium text-gray-500">Orders ({totalItemsSold} items)</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 pb-4">
        {['Overview', 'Expenses', 'Revenue'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expenses by Category */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6 min-h-[400px]">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Expenses by Category</h3>
            {/* Placeholder for chart */}
            <div className="flex items-center justify-center h-64 text-gray-400">
              Chart will be displayed here
            </div>
          </div>

          {/* Profit Summary */}
          <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Profit Summary</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Revenue</span>
                <span className="text-emerald-600 font-bold">+{formatETB(totalRevenue)}</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600 font-medium">Expenses</span>
                <span className="text-red-600 font-bold">-{formatETB(totalExpenses)}</span>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-900 font-bold">Net Profit</span>
                  <span className="text-emerald-600 font-bold">{formatETB(netProfit)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Profit Margin</span>
                  <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-medium">{profitMargin}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Expenses' && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Expenses Log</h3>
            <p className="text-xs text-gray-500 font-mono">Total records: {expenses.length}</p>
          </div>
          
          {expenses.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No expenses recorded yet. Click "Add Expense" to add one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Description</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Amount</th>
                    <th scope="col" className="relative py-3 pl-3 pr-4">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {exp.date ? format(parseISO(exp.date), 'MMM dd, yyyy') : 'N/A'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          {exp.category}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate" title={exp.description}>
                        {exp.description}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900 font-medium">
                        {formatETB(exp.amountETB)}
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                        <button
                          onClick={() => setExpenseToDelete(exp.id)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 cursor-pointer"
                          title="Delete Expense"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Revenue' && (
        <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-900/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Log (Sales)</h3>
            <p className="text-xs text-gray-500 font-mono">Total sales: {sales.length}</p>
          </div>
          
          {sales.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              No sales recorded yet. Mark items as sold in the Inventory tab.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Size</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Price</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Discount</th>
                    <th scope="col" className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Net Rev</th>
                    <th scope="col" className="relative py-3 pl-3 pr-4">
                      <span className="sr-only">Delete</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {[...sales].sort((a, b) => (b.dateSold || '').localeCompare(a.dateSold || '')).map((sale) => {
                    const netRevenue = (sale.sellingPriceETB * sale.quantitySold) - (sale.discountAmountETB || 0);
                    return (
                      <tr key={sale.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {sale.dateSold ? format(parseISO(sale.dateSold), 'MMM dd, yyyy') : 'N/A'}
                        </td>
                        <td className="px-3 py-4 text-sm text-gray-900 max-w-xs truncate" title={sale.itemName}>
                          {sale.itemName}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {sale.selectedSize || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900">
                          {sale.quantitySold}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-gray-900">
                          {formatETB(sale.sellingPriceETB)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-red-500">
                          {sale.discountAmountETB ? `-${formatETB(sale.discountAmountETB)}` : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-right text-emerald-600 font-medium">
                          {formatETB(netRevenue)}
                        </td>
                        <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium">
                          <button
                            onClick={() => setSaleToDelete(sale.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 cursor-pointer"
                            title="Delete Sales Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Delete Expense Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-sans">Delete Expense</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this expense record? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setExpenseToDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteExpense}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sale Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 font-sans">Delete Sales Record</h3>
            <p className="text-sm text-gray-500 mb-6">Are you sure you want to delete this sales record? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setSaleToDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSale}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Add Expense</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  type="text"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                  placeholder="e.g., Shop Rent for March"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                >
                  <option value="Rent">Rent</option>
                  <option value="Utilities">Utilities</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Shipping">Shipping</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount (ETB)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amountETB}
                  onChange={(e) => setFormData({ ...formData, amountETB: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#a94442] focus:ring-[#a94442] sm:text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md border border-transparent bg-[#a94442] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-[#a94442] focus:ring-offset-2"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
