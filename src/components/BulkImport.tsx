import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../context/InventoryContext';

interface BulkImportProps {
  onClose: () => void;
}

export function BulkImport({ onClose }: BulkImportProps) {
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
        const requiredHeaders = ['itemName', 'sheinSku', 'category', 'size', 'quantityStocked', 'totalCostPriceETB', 'sellingPriceETB'];
        const headers = results.meta.fields || [];
        
        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
          validationErrors.push(`Missing required columns: ${missingHeaders.join(', ')}`);
        }

        // Validate data
        const validData = parsedData.map((row, index) => {
          const rowNum = index + 2; // +2 because of header row and 0-index
          
          if (!row.itemName) validationErrors.push(`Row ${rowNum}: Item Name is required`);
          if (!row.category) validationErrors.push(`Row ${rowNum}: Category is required`);
          if (!row.size) validationErrors.push(`Row ${rowNum}: Size is required`);
          
          const qty = parseInt(row.quantityStocked);
          if (isNaN(qty) || qty < 0) validationErrors.push(`Row ${rowNum}: Invalid Quantity`);
          
          const cost = parseFloat(row.totalCostPriceETB);
          if (isNaN(cost) || cost < 0) validationErrors.push(`Row ${rowNum}: Invalid Cost Price`);
          
          const price = parseFloat(row.sellingPriceETB);
          if (isNaN(price) || price < 0) validationErrors.push(`Row ${rowNum}: Invalid Selling Price`);

          return {
            itemName: row.itemName,
            sheinSku: row.sheinSku || '',
            category: row.category,
            size: row.size,
            quantityStocked: isNaN(qty) ? 0 : qty,
            totalCostPriceETB: isNaN(cost) ? 0 : cost,
            sellingPriceETB: isNaN(price) ? 0 : price,
            image: row.image || '', // Optional image URL
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
      for (const item of preview) {
        await addItem(item);
        count++;
        setSuccessCount(count);
      }
      
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error) {
      setErrors(['An error occurred during import. Some items may not have been saved.']);
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = 'itemName,sheinSku,category,size,quantityStocked,totalCostPriceETB,sellingPriceETB,image\n"Example Dress","SKU123","Dress","M","5","1000","1500","https://example.com/image.jpg"';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_import_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-8">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-xl font-semibold text-gray-900">Bulk Import Inventory</h2>
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
              <p className="text-gray-500">Successfully imported {successCount} items.</p>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV file to add multiple items at once. You can include image URLs in the "image" column.
                </p>
                <button 
                  onClick={downloadTemplate}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-4"
                >
                  Download CSV Template
                </button>
              </div>

              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  file ? 'border-indigo-300 bg-indigo-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
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
                    <Upload className="h-8 w-8 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-base font-medium text-gray-900">
                      {file ? file.name : 'Click to upload CSV file'}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {file ? `${(file.size / 1024).toFixed(1)} KB` : 'CSV files only'}
                    </p>
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
                  >
                    {file ? 'Choose Different File' : 'Select File'}
                  </button>
                </div>
              </div>

              {errors.length > 0 && (
                <div className="mt-6 rounded-lg bg-red-50 p-4 border border-red-100">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                      <ul className="mt-2 list-disc pl-5 text-sm text-red-700 space-y-1">
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
                    <h3 className="text-lg font-medium text-gray-900">Preview ({preview.length} items)</h3>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {preview.slice(0, 5).map((item, i) => (
                          <tr key={i}>
                            <td className="px-4 py-3 text-sm text-gray-900">{item.itemName}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.sheinSku}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.size}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.quantityStocked}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.totalCostPriceETB}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{item.sellingPriceETB}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.length > 5 && (
                      <div className="bg-gray-50 px-4 py-3 text-center text-sm text-gray-500 border-t border-gray-200">
                        And {preview.length - 5} more items...
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
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={preview.length === 0 || errors.length > 0 || isImporting}
            className="rounded-md border border-transparent bg-black px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isImporting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                Importing ({successCount}/{preview.length})...
              </>
            ) : (
              'Import Items'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
