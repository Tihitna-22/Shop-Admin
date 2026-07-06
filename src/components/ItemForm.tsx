import React, { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Category, Size, InventoryItem, ProductVariant } from '../types';
import { calculateTotalCost } from '../lib/formatters';
import { compressImage } from '../lib/utils';
import { X, Upload, Plus, Trash2, Search } from 'lucide-react';

interface ItemFormProps {
  item?: InventoryItem;
  onClose: () => void;
  defaultStatus?: 'in_stock' | 'ordered';
}

export function ItemForm({ item, onClose, defaultStatus }: ItemFormProps) {
  const { addItem, updateItem, settings, userId, wholeOrders, customers } = useInventory();
  console.log('ItemForm: Current userId from context:', userId);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [postToTelegram, setPostToTelegram] = useState(false);
  const [variants, setVariants] = useState<ProductVariant[]>(item?.variants || []);
  const [customerSearch, setCustomerSearch] = useState('');

  const addVariant = () => {
    setVariants([...variants, { size: 'M', quantity: 1 }]);
  };

  const removeVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: keyof ProductVariant, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setVariants(newVariants);
  };

  React.useEffect(() => {
    if (!item && settings?.autoPostToTelegram) {
      setPostToTelegram(true);
    }
  }, [item, settings?.autoPostToTelegram]);
  
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
    status: item?.status || defaultStatus || 'in_stock',
    customerName: item?.customerName || '',
    customerPhone: item?.customerPhone || '',
    customerTelegram: item?.customerTelegram || '',
    prePaymentETB: item?.prePaymentETB?.toString() ?? '',
    orderId: item?.orderId || '',
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
    if (!userId) {
      setError('User identity not established. Please wait or refresh.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    
      const totalQuantity = variants.length > 0 
        ? variants.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0)
        : Number(formData.quantityStocked) || 0;

      const itemData: any = {
        ...formData,
        size: String(formData.size || ''),
        quantityStocked: totalQuantity,
        buyingPriceUSD: Number(formData.buyingPriceUSD) || 0,
        exchangeRate: Number(formData.exchangeRate) || 0,
        shippingCostETB: Number(formData.shippingCostETB) || 0,
        customsTaxETB: Number(formData.customsTaxETB) || 0,
        localDeliveryFeeETB: Number(formData.localDeliveryFeeETB) || 0,
        sellingPriceETB: Number(formData.sellingPriceETB) || 0,
        prePaymentETB: Number(formData.prePaymentETB) || 0,
        totalCostPriceETB,
        orderId: formData.orderId || '',
      };

      if (variants.length > 0) {
        itemData.variants = variants.map(v => ({
          ...v,
          size: String(v.size || ''),
          quantity: Number(v.quantity) || 0
        }));
      }

      // Clean up customer fields if not ordered
      if (itemData.status !== 'ordered') {
        delete itemData.customerName;
        delete itemData.customerPhone;
        delete itemData.customerTelegram;
        delete itemData.prePaymentETB;
      }

    try {
      if (item) {
        await updateItem(item.id, itemData);
      } else {
        await addItem(itemData);
        
        // Post to Telegram if configured and checked
        if (postToTelegram && settings?.telegramBotToken && settings?.telegramChatId) {
          try {
            const contactUsername = settings.telegramUsername || import.meta.env.VITE_TELEGRAM_USERNAME || 'Seller';
            
            let caption = '';
            if (settings.autoPostTemplate) {
              caption = settings.autoPostTemplate
                .replace(/{itemName}/g, itemData.itemName || '')
                .replace(/{price}/g, itemData.sellingPriceETB?.toString() || '0')
                .replace(/{size}/g, itemData.size || '')
                .replace(/{category}/g, itemData.category || '')
                .replace(/{sku}/g, itemData.sheinSku || '')
                .replace(/{telegramUsername}/g, contactUsername);
            } else {
              caption = `✨Available on hand\n✨Price- ${itemData.sellingPriceETB} ETB\n     Size - ${itemData.size}\n     Contact- @${contactUsername}`;
            }

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
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm bg-gray-50"
              >
                <option value="in_stock">In Stock (Available)</option>
                <option value="ordered">Ordered (Incoming / Pre-order)</option>
              </select>
            </div>

            {formData.status === 'ordered' && (
              <div className="sm:col-span-2 bg-indigo-50 p-4 rounded-lg border border-indigo-100 space-y-4">
                <h3 className="text-sm font-medium text-indigo-900">Customer Details (Optional)</h3>
                
                {/* Customer Selection from existing Customers */}
                {customers && customers.length > 0 && (
                  <div className="bg-white p-3 rounded-md border border-indigo-100 space-y-2 shadow-sm">
                    <label className="block text-xs font-semibold text-indigo-900">
                      Select from Existing Customers:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5">
                          <Search className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          placeholder="Search customer by name, phone, or Telegram..."
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          className="block w-full rounded-md border border-gray-300 py-1.5 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      </div>
                      {customerSearch && (
                        <button
                          type="button"
                          onClick={() => setCustomerSearch('')}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 border border-gray-200 transition-colors"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    
                    {/* Customer Selection Dropdown */}
                    <div className="relative">
                      <select
                        onChange={(e) => {
                          const custId = e.target.value;
                          if (custId) {
                            const selectedCust = customers.find(c => c.id === custId);
                            if (selectedCust) {
                              setFormData(prev => ({
                                ...prev,
                                customerName: selectedCust.name || '',
                                customerPhone: selectedCust.phone || '',
                                customerTelegram: selectedCust.telegram || '',
                              }));
                            }
                          }
                        }}
                        className="block w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        defaultValue=""
                      >
                        <option value="">-- Click to select customer ({
                          customerSearch 
                            ? `${customers.filter(c => {
                                const q = customerSearch.toLowerCase();
                                return c.name.toLowerCase().includes(q) || 
                                       (c.phone && c.phone.includes(q)) || 
                                       (c.telegram && c.telegram.toLowerCase().includes(q));
                              }).length} matches` 
                            : `${customers.length} total`
                        }) --</option>
                        {(customerSearch 
                          ? customers.filter(c => {
                              const q = customerSearch.toLowerCase();
                              return c.name.toLowerCase().includes(q) || 
                                     (c.phone && c.phone.includes(q)) || 
                                     (c.telegram && c.telegram.toLowerCase().includes(q));
                            })
                          : customers
                        ).slice(0, 50).map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.phone ? `| Phone: ${c.phone}` : ''} {c.telegram ? `| Telegram: @${c.telegram.replace('@', '')}` : ''}
                          </option>
                        ))}
                      </select>
                      {customerSearch && customers.filter(c => {
                        const q = customerSearch.toLowerCase();
                        return c.name.toLowerCase().includes(q) || 
                               (c.phone && c.phone.includes(q)) || 
                               (c.telegram && c.telegram.toLowerCase().includes(q));
                      }).length === 0 && (
                        <p className="text-[10px] text-amber-600 mt-1">No customers match your search query.</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-medium text-indigo-700">Name</label>
                    <input
                      type="text"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleChange}
                      placeholder="John Doe"
                      className="mt-1 block w-full rounded-md border border-indigo-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-700">Phone Number</label>
                    <input
                      type="tel"
                      name="customerPhone"
                      value={formData.customerPhone}
                      onChange={handleChange}
                      placeholder="0911..."
                      className="mt-1 block w-full rounded-md border border-indigo-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-700">Telegram Username</label>
                    <input
                      type="text"
                      name="customerTelegram"
                      value={formData.customerTelegram}
                      onChange={handleChange}
                      placeholder="@username"
                      className="mt-1 block w-full rounded-md border border-indigo-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-indigo-700">Pre-payment (ETB)</label>
                    <input
                      type="number"
                      name="prePaymentETB"
                      value={formData.prePaymentETB}
                      onChange={handleChange}
                      placeholder="0"
                      className="mt-1 block w-full rounded-md border border-indigo-200 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Whole Order / Batch (Optional)</label>
              <select
                name="orderId"
                value={formData.orderId}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
              >
                <option value="">-- None (Individual Item) --</option>
                {wholeOrders?.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.id} {order.orderName ? `(${order.orderName})` : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Link this item to a Whole Order/Batch to track and aggregate costs, expenses, and profits.
              </p>
            </div>

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
                {['Top', 'Dress', 'Trouser', 'Bra', 'Other'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Size</label>
              {formData.category === 'Other' ? (
                <input
                  type="text"
                  name="size"
                  value={formData.size}
                  onChange={handleChange}
                  placeholder="e.g. 38, 100ml, Standard"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm"
                />
              ) : (
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
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity Stocked</label>
              <input
                type="number"
                name="quantityStocked"
                min="0"
                value={formData.quantityStocked}
                onChange={handleChange}
                disabled={variants.length > 0}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black sm:text-sm disabled:bg-gray-100"
              />
              {variants.length > 0 && (
                <p className="mt-1 text-xs text-gray-500 italic">Managed by variants below</p>
              )}
            </div>
          </div>

          {/* Variants Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Product Variants (Sizes)</h3>
              <button
                type="button"
                onClick={addVariant}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#a94442] hover:text-red-800"
              >
                <Plus className="h-4 w-4" />
                Add Variant
              </button>
            </div>
            
            {variants.length > 0 ? (
              <div className="space-y-3">
                {variants.map((variant, index) => (
                  <div key={index} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Size</label>
                      {formData.category === 'Other' ? (
                        <input
                          type="text"
                          value={variant.size}
                          onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                          placeholder="e.g. 38, 100ml"
                          className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      ) : (
                        <select
                          value={variant.size}
                          onChange={(e) => handleVariantChange(index, 'size', e.target.value)}
                          className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                        >
                          {['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Quantity</label>
                      <input
                        type="number"
                        min="0"
                        value={variant.quantity}
                        onChange={(e) => handleVariantChange(index, 'quantity', Number(e.target.value))}
                        className="block w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVariant(index)}
                      className="mt-5 p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300 text-center">
                No variants added. Using default size and quantity.
              </p>
            )}
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

          {!item && settings?.telegramBotToken && settings?.telegramChatId && (
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center gap-x-3">
                <input
                  id="postToTelegram"
                  type="checkbox"
                  checked={postToTelegram}
                  onChange={(e) => setPostToTelegram(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <label htmlFor="postToTelegram" className="text-sm font-medium leading-6 text-gray-900">
                  Post this item to Telegram channel
                </label>
              </div>
            </div>
          )}

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
