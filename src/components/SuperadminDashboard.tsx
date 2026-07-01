import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Plus, Building2, User, Mail, Shield, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const SuperadminDashboard: React.FC = () => {
  const { businesses, createBusiness } = useInventory();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createBusiness(name, adminEmail, adminName);
    setIsAdding(false);
    setName('');
    setAdminEmail('');
    setAdminName('');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Superadmin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage businesses and platform-wide settings</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Create Business
        </button>
      </div>

      {isAdding && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8"
        >
          <h2 className="text-xl font-semibold mb-4">New Business Details</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. Fashion Hub"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
              <input
                type="text"
                required
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="e.g. John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="admin@example.com"
              />
            </div>
            <div className="md:col-span-3 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Create Business
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {businesses.map((business) => (
          <div key={business.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                <Building2 size={24} />
              </div>
              {business.isActive ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  <CheckCircle2 size={12} /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full">
                  <XCircle size={12} /> Inactive
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">{business.name}</h3>
            <p className="text-sm text-gray-500 mb-4">ID: {business.id}</p>
            
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <User size={16} className="text-gray-400" />
                <span>Owner UID: {business.ownerUid || 'Pending Signup'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield size={16} className="text-gray-400" />
                <span>Created: {new Date(business.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            
            <button className="w-full mt-6 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-100">
              Manage Business
            </button>
          </div>
        ))}
        
        {businesses.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <Building2 size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No businesses yet</h3>
            <p className="text-gray-500">Create your first business to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};
