import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, AlertCircle, CheckCircle2, FileText, Download } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Category, Size } from '../types';

interface BulkImportOrdersProps {
  onClose: () => void;
}

export function BulkImportOrders({ onClose }: BulkImportOrdersProps) {
  const { addItem } = useInventory();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data as any[];
        const validationErrors: string[] = [];
        
        // Validate headers
        const requiredHeaders = ['itemName', 'customerName', 'quantityStocked', 'sellingPriceETB'];
        const headers = results.meta.fields || [];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          validationErrors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        // Validate rows
        const validData = parsedData.map((row, index) => {
          const rowNum = index + 2; // +2 for header and 0-index offset
          
          if (!row.itemName?.trim()) {
            validationErrors.push(`Row ${rowNum}: Item Name is required`);
          }
          if (!row.customerName?.trim()) {
            validationErrors.push(`Row ${rowNum}: Customer Name is required`);
          }
          
          const qty = parseInt(row.quantityStocked);
          if (isNaN(qty) || qty <= 0) {
            validationErrors.push(`Row ${rowNum}: Quantity (quantityStocked) must be at least 1`);
          }
          
          const price = parseFloat(row.sellingPriceETB);
          if (isNaN(price) || price < 0) {
            validationErrors.push(`Row ${rowNum}: Selling Price (sellingPriceETB) must be a positive number`);
          }

          const prePayment = parseFloat(row.prePaymentETB || '0');
          if (isNaN(prePayment) || prePayment < 0) {
            validationErrors.push(`Row ${rowNum}: Prepayment must be a positive number`);
          }

          // Optional cost fields
          const buyingPriceUSD = parseFloat(row.buyingPriceUSD || '0');
          const exchangeRate = parseFloat(row.exchangeRate || '120');
          const shippingCostETB = parseFloat(row.shippingCostETB || '0');
          const customsTaxETB = parseFloat(row.customsTaxETB || '0');
          const localDeliveryFeeETB = parseFloat(row.localDeliveryFeeETB || '0');

          if (isNaN(buyingPriceUSD) || buyingPriceUSD < 0) validationErrors.push(`Row ${rowNum}: Invalid Buying Price (USD)`);
          if (isNaN(exchangeRate) || exchangeRate <= 0) validationErrors.push(`Row ${rowNum}: Invalid Exchange Rate`);
          if (isNaN(shippingCostETB) || shippingCostETB < 0) validationErrors.push(`Row ${rowNum}: Invalid Shipping Cost (ETB)`);
          if (isNaN(customsTaxETB) || customsTaxETB < 0) validationErrors.push(`Row ${rowNum}: Invalid Customs Tax (ETB)`);
          if (isNaN(localDeliveryFeeETB) || localDeliveryFeeETB < 0) validationErrors.push(`Row ${rowNum}: Invalid Local Delivery Fee (ETB)`);

          const calculatedCost = (buyingPriceUSD * exchangeRate) + shippingCostETB + customsTaxETB + localDeliveryFeeETB;

          // Standardize Category and Size
          const validCategories: Category[] = ['Top', 'Dress', 'Trouser', 'Bra', 'Other'];
          const inputCategory = (row.category || 'Top').trim();
          const category = validCategories.includes(inputCategory as Category) ? (inputCategory as Category) : 'Top';

          const validSizes: Size[] = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];
          const inputSize = (row.size || 'M').trim().toUpperCase();
          const size = validSizes.includes(inputSize as Size) ? (inputSize as Size) : 'M';

          return {
            itemName: row.itemName.trim(),
            sheinSku: (row.sheinSku || '').trim(),
            category,
            size,
            quantityStocked: isNaN(qty) ? 1 : qty,
            buyingPriceUSD: isNaN(buyingPriceUSD) ? 0 : buyingPriceUSD,
            exchangeRate: isNaN(exchangeRate) ? 120 : exchangeRate,
            shippingCostETB: isNaN(shippingCostETB) ? 0 : shippingCostETB,
            customsTaxETB: isNaN(customsTaxETB) ? 0 : customsTaxETB,
            localDeliveryFeeETB: isNaN(localDeliveryFeeETB) ? 0 : localDeliveryFeeETB,
            totalCostPriceETB: calculatedCost,
            sellingPriceETB: isNaN(price) ? 0 : price,
            prePaymentETB: isNaN(prePayment) ? 0 : prePayment,
            customerName: row.customerName.trim(),
            customerPhone: (row.customerPhone || '').trim(),
            customerTelegram: (row.customerTelegram || '').trim(),
            status: 'ordered', // Hardcoded as 'ordered' to go into pending orders
          };
        });

        setErrors(validationErrors);
        if (validationErrors.length === 0) {
          setPreview(validData);
        } else {
          setPreview([]);
        }
      },
      error: (error) => {
        setErrors([`Failed to parse CSV: ${error.message}`]);
      }
    });
  };

  const handleImport = async () => {
    if (preview.length === 0 || errors.length > 0) return;
    
    setIsImporting(true);
    let count = 0;
    
    try {
      for (const order of preview) {
        await addItem(order);
        count++;
        setSuccessCount(count);
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setErrors(['An error occurred during import. Some orders may not have been saved.']);
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'itemName,sheinSku,category,size,quantityStocked,sellingPriceETB,prePaymentETB,customerName,customerPhone,customerTelegram,buyingPriceUSD,exchangeRate,shippingCostETB,customsTaxETB,localDeliveryFeeETB\n';
    const row1 = '"Floral Maxi Dress","SKU-DR-01","Dress","M","2","2500","1000","Selamawit Ketema","+251911223344","@selam_k","12","120","150","50","30"\n';
    const row2 = '"Classic Silk Top","SKU-TP-08","Top","S","1","1800","0","Yonas Tesfaye","+251911556677","@yonas_tesfaye","8","120","100","20","20"';
    
    const template = headers + row1 + row2;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'orders_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Import Orders</h2>
          <button onClick={onClose} className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {successCount > 0 && successCount === preview.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-green-100 p-3 mb-4">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">Import Successful!</h3>
              <p className="text-gray-500">Successfully imported {successCount} orders.</p>
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-amber-50/50 p-4 rounded-xl border border-amber-100">
                <div>
                  <p className="text-sm font-semibold text-gray-900 mb-1">
                    Upload a CSV file to add multiple orders.
                  </p>
                  <p className="text-xs text-gray-600">
                    Required columns: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">itemName</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">customerName</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">quantityStocked</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">sellingPriceETB</code>.
                  </p>
                </div>
                <button 
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#a94442] text-[#a94442] hover:bg-[#a94442]/5 bg-white px-3.5 py-2 text-xs font-semibold shadow-sm shrink-0"
                >
                  <Download className="h-4 w-4" />
                  Template CSV
                </button>
              </div>

              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  file ? 'border-[#a94442]/50 bg-[#a94442]/5' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  ref={fileInputRef}
                />
                
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="rounded-full bg-white p-3 shadow-sm">
                    <Upload className="h-8 w-8 text-[#a94442]" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-gray-900">
                      {file ? file.name : 'Click to upload CSV file'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV / Excel-exported files only'}
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 text-xs"
                  >
                    {file ? 'Choose Different File' : 'Select File'}
                  </button>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="mt-6 rounded-lg bg-red-50 p-4 border border-red-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div className="max-h-40 overflow-y-auto">
                      <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                      <ul className="mt-2 list-disc pl-5 text-xs text-red-700 space-y-1">
                        {errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {preview.length > 0 && errors.length === 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      Previewing ({preview.length} orders to import)
                    </h3>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Item Name</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Customer</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Size</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Price (ETB)</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Prepaid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white text-xs">
                        {preview.slice(0, 5).map((order, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2.5 text-gray-900 font-medium">{order.itemName}</td>
                            <td className="px-4 py-2.5 text-gray-500">
                              <span className="font-semibold text-gray-800">{order.customerName}</span>
                              {order.customerPhone && <div className="text-[10px] text-gray-400">{order.customerPhone}</div>}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">{order.size}</td>
                            <td className="px-4 py-2.5 text-gray-500 font-mono">{order.quantityStocked}</td>
                            <td className="px-4 py-2.5 text-gray-800 font-mono font-semibold">{order.sellingPriceETB}</td>
                            <td className="px-4 py-2.5 text-indigo-600 font-mono font-semibold">{order.prePaymentETB || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.length > 5 && (
                      <div className="bg-gray-50 px-4 py-2 text-center text-xs text-gray-500 border-t border-gray-200">
                        And {preview.length - 5} more orders...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 rounded-b-2xl flex justify-end gap-3 sticky bottom-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={preview.length === 0 || errors.length > 0 || isImporting}
            className="rounded-md border border-transparent bg-black px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2 text-xs"
          >
            {isImporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Importing ({successCount}/{preview.length})...
              </>
            ) : (
              'Import Orders'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
