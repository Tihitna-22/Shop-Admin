import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Tag, Plus, Edit2, Trash2, Percent, DollarSign } from 'lucide-react';
import { DiscountCode } from '../types';

export function DiscountCodes() {
  const { discountCodes, addDiscountCode, updateDiscountCode } = useInventory();
  const [isAddingCode, setIsAddingCode] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    isActive: true,
    maxUses: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: formData.code.toUpperCase(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      isActive: formData.isActive,
      ...(formData.maxUses ? { maxUses: Number(formData.maxUses) } : {}),
    };

    if (editingCode) {
      await updateDiscountCode(editingCode.id, payload);
    } else {
      await addDiscountCode(payload);
    }
    setIsAddingCode(false);
    setEditingCode(null);
    setFormData({ code: '', discountType: 'percentage', discountValue: 0, isActive: true, maxUses: '' });
  };

  const handleEdit = (code: DiscountCode) => {
    setEditingCode(code);
    setFormData({
      code: code.code,
      discountType: code.discountType,
      discountValue: code.discountValue,
      isActive: code.isActive,
      maxUses: code.maxUses ? String(code.maxUses) : '',
    });
    setIsAddingCode(true);
  };

  const toggleStatus = async (code: DiscountCode) => {
    await updateDiscountCode(code.id, { isActive: !code.isActive });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-semibold text-gray-900">Discount Codes</h2>
          <p className="text-sm text-gray-500 mt-1">Create and manage promotional codes for your customers</p>
        </div>
        <button
          onClick={() => {
            setIsAddingCode(true);
            setEditingCode(null);
            setFormData({ code: '', discountType: 'percentage', discountValue: 0, isActive: true, maxUses: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#a94442] text-white rounded-lg hover:bg-[#8a3634] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Code
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {discountCodes.map((code) => (
          <div key={code.id} className={`bg-white rounded-xl border ${code.isActive ? 'border-gray-200' : 'border-gray-200 opacity-60'} p-6 shadow-sm relative overflow-hidden`}>
            {/* Status indicator */}
            <div className={`absolute top-0 right-0 w-16 h-16 overflow-hidden`}>
              <div className={`absolute transform rotate-45 text-center text-white font-semibold py-1 right-[-35px] top-[32px] w-[170px] text-[10px] shadow-sm ${code.isActive ? 'bg-green-500' : 'bg-gray-400'}`}>
                {code.isActive ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>

            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${code.isActive ? 'bg-red-50 text-[#a94442]' : 'bg-gray-100 text-gray-500'}`}>
                  <Tag className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-wider">{code.code}</h3>
                  <p className="text-sm text-gray-500">
                    {code.discountType === 'percentage' ? (
                      <span className="flex items-center gap-1"><Percent className="h-3 w-3" /> {code.discountValue}% off</span>
                    ) : (
                      <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> {code.discountValue} ETB off</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Uses</span>
                <span className="font-medium text-gray-900">
                  {code.currentUses} {code.maxUses ? `/ ${code.maxUses}` : ''}
                </span>
              </div>
              {code.maxUses && (
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div 
                    className="bg-[#a94442] h-1.5 rounded-full" 
                    style={{ width: `${Math.min(100, (code.currentUses / code.maxUses) * 100)}%` }}
                  ></div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-gray-100">
              <button
                onClick={() => toggleStatus(code)}
                className={`text-sm font-medium ${code.isActive ? 'text-gray-500 hover:text-gray-700' : 'text-green-600 hover:text-green-700'}`}
              >
                {code.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={() => handleEdit(code)}
                className="p-2 text-gray-400 hover:text-[#a94442] hover:bg-red-50 rounded-lg transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        
        {discountCodes.length === 0 && (
          <div className="col-span-full bg-gray-50 rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <Tag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No discount codes</h3>
            <p className="text-gray-500 mb-4">Create your first promo code to offer discounts to your customers.</p>
            <button
              onClick={() => setIsAddingCode(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Code
            </button>
          </div>
        )}
      </div>

      {isAddingCode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCode ? 'Edit Discount Code' : 'Create Discount Code'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent uppercase"
                  placeholder="e.g. SUMMER20"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select
                    value={formData.discountType}
                    onChange={(e) => setFormData({ ...formData, discountType: e.target.value as 'percentage' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (ETB)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step={formData.discountType === 'percentage' ? '1' : '0.01'}
                    max={formData.discountType === 'percentage' ? '100' : undefined}
                    value={formData.discountValue}
                    onChange={(e) => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maximum Uses (Optional)</label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                  placeholder="Leave blank for unlimited"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-[#a94442] focus:ring-[#a94442]"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">
                  Code is active and can be used
                </label>
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingCode(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#a94442] text-white rounded-lg hover:bg-[#8a3634] transition-colors"
                >
                  {editingCode ? 'Save Changes' : 'Create Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
