import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Users, Search, Plus, Edit2, Star, Trophy, Medal, Award } from 'lucide-react';
import { Customer } from '../types';

export function Customers() {
  const { customers, addCustomer, updateCustomer } = useInventory();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    telegram: '',
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, formData);
    } else {
      await addCustomer(formData);
    }
    setIsAddingCustomer(false);
    setEditingCustomer(null);
    setFormData({ name: '', email: '', phone: '', telegram: '' });
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      telegram: customer.telegram || '',
    });
    setIsAddingCustomer(true);
  };

  const getVipIcon = (status: string) => {
    switch (status) {
      case 'gold': return <Trophy className="h-4 w-4 text-yellow-500" />;
      case 'silver': return <Medal className="h-4 w-4 text-gray-400" />;
      case 'bronze': return <Award className="h-4 w-4 text-amber-600" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-serif font-semibold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your customer relationships and loyalty program</p>
        </div>
        <button
          onClick={() => {
            setIsAddingCustomer(true);
            setEditingCustomer(null);
            setFormData({ name: '', email: '', phone: '', telegram: '' });
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[#a94442] text-white rounded-lg hover:bg-[#8a3634] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-medium text-gray-900">Customer</th>
                <th className="px-6 py-4 font-medium text-gray-900">Contact</th>
                <th className="px-6 py-4 font-medium text-gray-900">Total Spend</th>
                <th className="px-6 py-4 font-medium text-gray-900">Points</th>
                <th className="px-6 py-4 font-medium text-gray-900">VIP Status</th>
                <th className="px-6 py-4 font-medium text-gray-900 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{customer.name}</div>
                      <div className="text-xs text-gray-500">Joined {new Date(customer.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-gray-600">{customer.email || '-'}</div>
                      <div className="text-gray-600">{customer.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {customer.totalSpend.toLocaleString()} ETB
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                        <Star className="h-3 w-3" />
                        {customer.points}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {customer.vipStatus !== 'none' ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize
                          ${customer.vipStatus === 'gold' ? 'bg-yellow-50 text-yellow-700' : ''}
                          ${customer.vipStatus === 'silver' ? 'bg-gray-100 text-gray-700' : ''}
                          ${customer.vipStatus === 'bronze' ? 'bg-amber-50 text-amber-700' : ''}
                        `}>
                          {getVipIcon(customer.vipStatus)}
                          {customer.vipStatus}
                        </span>
                      ) : (
                        <span className="text-gray-400 text-xs">Standard</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-2 text-gray-400 hover:text-[#a94442] hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddingCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telegram Handle</label>
                <input
                  type="text"
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#a94442] focus:border-transparent"
                  placeholder="@username"
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingCustomer(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#a94442] text-white rounded-lg hover:bg-[#8a3634] transition-colors"
                >
                  {editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
