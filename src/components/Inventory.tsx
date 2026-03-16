import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { ItemForm } from './ItemForm';
import { Plus, Edit2, Trash2, CheckCircle2, Image as ImageIcon, X } from 'lucide-react';

export function Inventory() {
  const { inventory, sales, deleteItem, markAsSold } = useInventory();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [sellingItem, setSellingItem] = useState<any>(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [filterCategory, setFilterCategory] = useState<'All' | 'Top' | 'Dress' | 'Trouser' | 'Bra'>('All');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const filteredInventory = inventory.filter(item => 
    filterCategory === 'All' || item.category === filterCategory
  );

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

  const handleSell = (e: React.FormEvent) => {
    e.preventDefault();
    if (sellingItem) {
      markAsSold(sellingItem.id, sellQuantity);
      setSellingItem(null);
      setSellQuantity(1);
    }
  };

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">Inventory Management</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your stock, pricing, and record sales.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => {
              setEditingItem(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Add Item
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['All', 'Top', 'Dress', 'Trouser', 'Bra'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filterCategory === cat
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat === 'All' ? 'All' : cat + 's'}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-2xl">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 w-16">Photo</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Item Details</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Stock</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Cost (ETB)</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price (ETB)</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Profit</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredInventory.map((item) => {
                    const profit = item.sellingPriceETB - item.totalCostPriceETB;
                    const hasBeenSold = sales.some(s => s.itemId === item.id);
                    return (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 sm:pl-6">
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt={item.itemName} 
                              className="h-[50px] w-[50px] rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity border border-gray-200 shadow-sm"
                              onClick={() => setLightboxImage(item.image!)}
                            />
                          ) : (
                            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-md bg-gray-50 border border-gray-200">
                              <ImageIcon className="h-6 w-6 text-gray-300" />
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <div className="flex items-center">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">{item.itemName}</span>
                                <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                                  {item.category}
                                </span>
                              </div>
                              <div className="text-gray-500 text-sm mt-0.5">SKU: {item.sheinSku} | Size: {item.size}</div>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            item.quantityStocked > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {item.quantityStocked} in stock
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {formatETB(item.totalCostPriceETB)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 font-medium">
                          {formatETB(item.sellingPriceETB)}
                        </td>
                        <td className={`whitespace-nowrap px-3 py-4 text-sm font-medium ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {formatETB(profit)}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setSellingItem(item)}
                              disabled={item.quantityStocked === 0}
                              className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-sm font-semibold shadow-sm ring-1 ring-inset ${
                                item.quantityStocked > 0 
                                  ? 'bg-white text-gray-900 ring-gray-300 hover:bg-gray-50' 
                                  : 'bg-gray-50 text-gray-400 ring-gray-200 cursor-not-allowed'
                              }`}
                            >
                              <CheckCircle2 className="-ml-0.5 mr-1.5 h-4 w-4 text-emerald-500" />
                              Sell
                            </button>
                            <button
                              onClick={() => handleEdit(item)}
                              disabled={hasBeenSold}
                              className={`p-2 ${hasBeenSold ? 'text-gray-300 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-900'}`}
                              title={hasBeenSold ? "Cannot edit an item that has sales records" : "Edit item"}
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={hasBeenSold}
                              className={`p-2 ${hasBeenSold ? 'text-gray-300 cursor-not-allowed' : 'text-red-600 hover:text-red-900'}`}
                              title={hasBeenSold ? "Cannot delete an item that has sales records" : "Delete item"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {inventory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-gray-500">
                        No items in inventory. Click "Add Item" to get started.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredInventory.length > 0 && (
                  <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                    <tr>
                      <th scope="row" colSpan={3} className="px-3 py-4 text-right text-sm font-bold text-gray-900">
                        Total Value (Qty × Price):
                      </th>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900">
                        {formatETB(filteredInventory.reduce((sum, item) => sum + (item.totalCostPriceETB * item.quantityStocked), 0))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-gray-900">
                        {formatETB(filteredInventory.reduce((sum, item) => sum + (item.sellingPriceETB * item.quantityStocked), 0))}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-bold text-emerald-600">
                        {formatETB(filteredInventory.reduce((sum, item) => sum + ((item.sellingPriceETB - item.totalCostPriceETB) * item.quantityStocked), 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <ItemForm
          item={editingItem}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
        />
      )}

      {/* Sell Modal */}
      {sellingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Record Sale</h3>
            <p className="text-sm text-gray-500 mb-4">
              Selling: <span className="font-medium text-gray-900">{sellingItem.itemName}</span>
            </p>
            <form onSubmit={handleSell}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">Quantity to Sell</label>
                <input
                  type="number"
                  min="1"
                  max={sellingItem.quantityStocked}
                  value={sellQuantity}
                  onChange={(e) => setSellQuantity(Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Max available: {sellingItem.quantityStocked}
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSellingItem(null)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
                >
                  Confirm Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delete Item</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete this item? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-h-full max-w-4xl w-full flex justify-center">
            <button 
              className="absolute -top-12 right-0 text-white/70 hover:text-white p-2"
              onClick={() => setLightboxImage(null)}
            >
              <X className="h-8 w-8" />
            </button>
            <img 
              src={lightboxImage} 
              alt="Full size preview" 
              className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
}
