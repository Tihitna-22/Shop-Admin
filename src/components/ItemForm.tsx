import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Category, Size, InventoryItem } from '../types';
import { calculateTotalCost } from '../lib/formatters';
import { compressImage } from '../lib/utils';
import { X, Upload } from 'lucide-react';

interface ItemFormProps {
  item?: InventoryItem;
  onClose: () => void;
}

export function ItemForm({ item, onClose }: ItemFormProps) {
  const { addItem, updateItem, settings } = useInventory();
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    itemName: item?.itemName || '',
    sheinSku: item?.sheinSku || '',
    category: item?.category || 'Top' as Category,
    size: item?.size || 'M' as Size,
    quantityStocked: item?.quantityStocked?.toString() ?? '1',
    buyingPriceUSD: item?.buyingPriceUSD?.toString() ?? '',
    exchangeRate: item?.exchangeRate?.toString() ?? '120',
    shippingCostETB: item?.shippingCostETB?.toString() ?? '',
    customsTaxETB: item?.customsTaxETB?.toString() ?? '',
    localDeliveryFeeETB: item?.localDeliveryFeeETB?.toString() ?? '',
    sellingPriceETB: item?.sellingPriceETB?.toString() ?? '',
    image: item?.image || '',
  });

  const totalCostPriceETB = calculateTotalCost(
    Number(formData.buyingPriceUSD) || 0,
    Number(formData.exchangeRate) || 0,
    Number(formData.shippingCostETB) || 0,
    Number(formData.customsTaxETB) || 0,
    Number(formData.localDeliveryFeeETB) || 0
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressing(true);
      setError(null);
      const compressed = await compressImage(file);
      setFormData(prev => ({ ...prev, image: compressed }));
    } catch (error) {
      console.error('Error compressing image:', error);
      setError('Failed to process image. Please try a different file.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    const itemData = {
      ...formData,
      quantityStocked: Number(formData.quantityStocked) || 0,
      buyingPriceUSD: Number(formData.buyingPriceUSD) || 0,
      exchangeRate: Number(formData.exchangeRate) || 0,
      shippingCostETB: Number(formData.shippingCostETB) || 0,
      customsTaxETB: Number(formData.customsTaxETB) || 0,
      localDeliveryFeeETB: Number(formData.localDeliveryFeeETB) || 0,
      sellingPriceETB: Number(formData.sellingPriceETB) || 0,
      totalCostPriceETB,
    };

    try {
      if (item) {
        await updateItem(item.id, itemData);
      } else {
        await addItem(itemData);
        
        // Post to Telegram if configured
        if (settings?.autoPostToTelegram && settings?.telegramBotToken && settings?.telegramChatId) {
          try {
            const caption = `✨Available on hand\n✨Price- ${itemData.sellingPriceETB} ETB\n     Size - ${itemData.size}\n     Contact- @Mirafashion22`;
            const tgFormData = new FormData();
            tgFormData.append('chat_id', settings.telegramChatId);
            tgFormData.append('caption', caption);

            if (itemData.image) {
              const res = await fetch(itemData.image);
              const blob = await res.blob();
              tgFormData.append('photo', blob, 'image.jpg');
              
              await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendPhoto`, {
                method: 'POST',
                body: tgFormData,
              });
            } else {
              tgFormData.append('text', caption);
              await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
                method: 'POST',
                body: tgFormData,
              });
            }
          } catch (tgError) {
            console.error('Failed to post to Telegram:', tgError);
          }
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError('Failed to save item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl mt-16 mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            {item ? 'Edit Item' : 'Add New Item'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-500 rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">{error}</h3>
                </div>
              </div>
            </div>
          )}
          {/* Image Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Upload Item Image</label>
            <div className="mt-2 flex items-center gap-4">
              {formData.image ? (
                <div className="relative h-24 w-24 rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <img src={formData.image} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                    className="absolute top-1 right-1 rounded-full bg-white/90 p-1 text-gray-600 hover:bg-white hover:text-red-600 shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <Upload className="h-6 w-6 text-gray-400" />
                  <span className="mt-2 text-xs text-gray-500 font-medium">Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isCompressing} />
                </label>
              )}
              {isCompressing && <span className="text-sm text-gray-500 animate-pulse">Compressing image...</span>}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Item Name</label>
              <input
                type="text"
                name="itemName"
                required
                value={formData.itemName}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Item SKU</label>
              <input
                type="text"
                name="sheinSku"
                required
                value={formData.sheinSku}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              >
                {['Top', 'Dress', 'Trouser', 'Bra'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Size</label>
              <select
                name="size"
                value={formData.size}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              >
                {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity Stocked</label>
              <input
                type="number"
                name="quantityStocked"
                min="0"
                value={formData.quantityStocked}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Cost & Pricing</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Buying Price (USD)</label>
                <input
                  type="number"
                  name="buyingPriceUSD"
                  min="0"
                  step="0.01"
                  value={formData.buyingPriceUSD}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Exchange Rate (USD to ETB)</label>
                <input
                  type="number"
                  name="exchangeRate"
                  min="0"
                  step="0.01"
                  value={formData.exchangeRate}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Shipping Cost per Item (ETB)</label>
                <input
                  type="number"
                  name="shippingCostETB"
                  min="0"
                  step="0.01"
                  value={formData.shippingCostETB}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Customs/Tax (ETB)</label>
                <input
                  type="number"
                  name="customsTaxETB"
                  min="0"
                  step="0.01"
                  value={formData.customsTaxETB}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Local Delivery Fee (ETB)</label>
                <input
                  type="number"
                  name="localDeliveryFeeETB"
                  min="0"
                  step="0.01"
                  value={formData.localDeliveryFeeETB}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4 border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Calculated Total Cost Price:</span>
              <span className="text-lg font-bold text-gray-900">{totalCostPriceETB.toFixed(2)} ETB</span>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Selling Price (ETB)</label>
              <input
                type="number"
                name="sellingPriceETB"
                min="0"
                step="0.01"
                value={formData.sellingPriceETB}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              />
              {Number(formData.sellingPriceETB) > 0 && (
                <p className={`mt-2 text-sm ${Number(formData.sellingPriceETB) - totalCostPriceETB >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  Estimated Profit per item: {(Number(formData.sellingPriceETB) - totalCostPriceETB).toFixed(2)} ETB
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCompressing || isSubmitting}
              className="inline-flex justify-center rounded-md border border-transparent bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : (item ? 'Save Changes' : 'Add Item')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
