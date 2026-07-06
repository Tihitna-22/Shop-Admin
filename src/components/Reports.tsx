import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { formatETB } from '../lib/formatters';
import { 
  Download, Calendar, ArrowUpRight, ArrowDownRight, DollarSign, Users, 
  BarChart3, Package, UserCircle, ShoppingCart, TrendingUp, AlertTriangle, 
  Layers, ListFilter, PieChart, Sparkles, CheckCircle2, FileText, Info,
  Printer, ArrowRight, Tag, Percent, RefreshCw, ShoppingBag, EyeOff, AlertCircle,
  Send, MessageSquare
} from 'lucide-react';
import { 
  format, subDays, isSameDay, parseISO, startOfMonth, isSameMonth, 
  subMonths, isWithinInterval, startOfDay, endOfDay, eachDayOfInterval, 
  endOfMonth, startOfYesterday, subWeeks
} from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

function getTelegramLink(tg: string) {
  const clean = tg.replace('@', '').trim();
  return `https://t.me/${clean}`;
}

function getWhatsAppLink(phone: string) {
  let clean = phone.replace(/[^\d]/g, '');
  if (clean.startsWith('0') && clean.length === 10) {
    clean = '251' + clean.substring(1);
  }
  return `https://wa.me/${clean}`;
}

export function Reports() {
  const { sales, inventory, expenses, userProfile } = useInventory();
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'superadmin';
  
  const [activeTab, setActiveTab] = useState<'profit_loss' | 'orders_analysis' | 'inventory_analysis'>('profit_loss');
  const [plStatementType, setPlStatementType] = useState<'standard' | 'ordered_items' | 'inventory_valuation'>('standard');
  
  // Unified date filters
  const [dateFilterType, setDateFilterType] = useState<'today' | 'yesterday' | 'specific' | '7days' | 'month' | 'range' | 'overall'>('overall');
  const [specificDateString, setSpecificDateString] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [startDateString, setStartDateString] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDateString, setEndDateString] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Parse active date limits based on selection
  const periodLabel = useMemo(() => {
    switch (dateFilterType) {
      case 'today':
        return `Today (${format(new Date(), 'MMM dd, yyyy')})`;
      case 'yesterday':
        return `Yesterday (${format(startOfYesterday(), 'MMM dd, yyyy')})`;
      case 'specific':
        try {
          return `Daily: ${format(parseISO(specificDateString), 'MMM dd, yyyy')}`;
        } catch {
          return 'Selected Day';
        }
      case '7days':
        return `Last 7 Days (${format(subDays(new Date(), 6), 'MMM dd')} - ${format(new Date(), 'MMM dd')})`;
      case 'month':
        return `This Month (${format(new Date(), 'MMMM yyyy')})`;
      case 'range':
        try {
          return `Range: ${format(parseISO(startDateString), 'MMM dd, yyyy')} - ${format(parseISO(endDateString), 'MMM dd, yyyy')}`;
        } catch {
          return 'Selected Range';
        }
      case 'overall':
      default:
        return 'Overall (To Date)';
    }
  }, [dateFilterType, specificDateString, startDateString, endDateString]);

  // Unified helper to check if a date string is in the selected period
  const isDateInPeriod = useMemo(() => {
    return (dateStr: string | undefined): boolean => {
      if (dateFilterType === 'overall') return true;
      if (!dateStr) return false;
      
      try {
        const itemDate = startOfDay(parseISO(dateStr));
        let start = startOfDay(new Date());
        let end = endOfDay(new Date());

        if (dateFilterType === 'today') {
          start = startOfDay(new Date());
          end = endOfDay(new Date());
        } else if (dateFilterType === 'yesterday') {
          start = startOfDay(startOfYesterday());
          end = endOfDay(startOfYesterday());
        } else if (dateFilterType === 'specific') {
          start = startOfDay(parseISO(specificDateString));
          end = endOfDay(parseISO(specificDateString));
        } else if (dateFilterType === '7days') {
          start = startOfDay(subDays(new Date(), 6));
          end = endOfDay(new Date());
        } else if (dateFilterType === 'month') {
          start = startOfDay(startOfMonth(new Date()));
          end = endOfDay(endOfMonth(new Date()));
        } else if (dateFilterType === 'range') {
          start = startOfDay(parseISO(startDateString));
          end = endOfDay(parseISO(endDateString));
        }

        return itemDate >= start && itemDate <= end;
      } catch (e) {
        return false;
      }
    };
  }, [dateFilterType, specificDateString, startDateString, endDateString]);

  // ==========================================
  // PROFIT & LOSS CALCULATIONS
  // ==========================================
  const filteredSales = useMemo(() => {
    return sales.filter(sale => isDateInPeriod(sale.dateSold));
  }, [sales, isDateInPeriod]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => isDateInPeriod(exp.date));
  }, [expenses, isDateInPeriod]);

  // Revenue = sum of ((sellingPrice * quantitySold) - discountAmount)
  const totalRevenue = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      const saleVal = (Number(sale.sellingPriceETB) * Number(sale.quantitySold)) - (Number(sale.discountAmountETB) || 0);
      return sum + saleVal;
    }, 0);
  }, [filteredSales]);

  const standardSales = useMemo(() => {
    return filteredSales.filter(s => s.status !== 'delivered' && !s.customerName && !(Number(s.prePaymentETB) > 0));
  }, [filteredSales]);

  const orderedSales = useMemo(() => {
    return filteredSales.filter(s => s.status === 'delivered' || !!s.customerName || (Number(s.prePaymentETB) > 0));
  }, [filteredSales]);

  const standardRevenue = useMemo(() => {
    return standardSales.reduce((sum, sale) => {
      const saleVal = (Number(sale.sellingPriceETB) * Number(sale.quantitySold)) - (Number(sale.discountAmountETB) || 0);
      return sum + saleVal;
    }, 0);
  }, [standardSales]);

  const orderedRevenue = useMemo(() => {
    return orderedSales.reduce((sum, sale) => {
      const saleVal = (Number(sale.sellingPriceETB) * Number(sale.quantitySold)) - (Number(sale.discountAmountETB) || 0);
      return sum + saleVal;
    }, 0);
  }, [orderedSales]);

  // Cost of Goods Sold (COGS) = sum of (totalCostPrice * quantitySold)
  const totalCOGS = useMemo(() => {
    return filteredSales.reduce((sum, sale) => {
      const costVal = Number(sale.totalCostPriceETB) * Number(sale.quantitySold);
      return sum + costVal;
    }, 0);
  }, [filteredSales]);

  const standardCOGS = useMemo(() => {
    return standardSales.reduce((sum, sale) => {
      const costVal = Number(sale.totalCostPriceETB) * Number(sale.quantitySold);
      return sum + costVal;
    }, 0);
  }, [standardSales]);

  const orderedCOGS = useMemo(() => {
    return orderedSales.reduce((sum, sale) => {
      const costVal = Number(sale.totalCostPriceETB) * Number(sale.quantitySold);
      return sum + costVal;
    }, 0);
  }, [orderedSales]);

  // Gross Profit = Revenue - COGS
  const grossProfit = totalRevenue - totalCOGS;

  // Operating Expenses = sum of (amountETB)
  const totalOperatingExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + Number(exp.amountETB), 0);
  }, [filteredExpenses]);

  // Net Profit = Gross Profit - Operating Expenses
  const netProfit = grossProfit - totalOperatingExpenses;
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // Group Expenses by Category
  const expensesByCategory = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const cat = e.category || 'Other';
      cats[cat] = (cats[cat] || 0) + Number(e.amountETB);
    });
    return Object.entries(cats)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses]);


  // ==========================================
  // ACTIVE ORDERS ANALYSIS CALCULATIONS
  // ==========================================
  // Active/pending orders are items in the inventory that represent custom client orders
  const activeOrdersList = useMemo(() => {
    return inventory.filter(item => 
      (item.status === 'ordered' || !!item.customerName || (Number(item.prePaymentETB) > 0)) && 
      isDateInPeriod(item.dateAdded)
    );
  }, [inventory, isDateInPeriod]);

  const totalActiveOrdersCount = activeOrdersList.length;

  const ordersExpectedRevenue = useMemo(() => {
    // Expected revenue = sum of sellingPriceETB for these orders
    return activeOrdersList.reduce((sum, order) => sum + (Number(order.sellingPriceETB) * Number(order.quantityStocked || 1)), 0);
  }, [activeOrdersList]);

  const ordersPrepaymentsCollected = useMemo(() => {
    return activeOrdersList.reduce((sum, order) => sum + (Number(order.prePaymentETB) || 0), 0);
  }, [activeOrdersList]);

  const ordersPendingBalance = ordersExpectedRevenue - ordersPrepaymentsCollected;

  const avgPrepaymentPercentage = useMemo(() => {
    if (ordersExpectedRevenue === 0) return 0;
    return (ordersPrepaymentsCollected / ordersExpectedRevenue) * 100;
  }, [ordersExpectedRevenue, ordersPrepaymentsCollected]);

  const ordersByCategory = useMemo(() => {
    const cats: Record<string, { count: number; value: number }> = {};
    activeOrdersList.forEach(order => {
      const cat = order.category || 'Uncategorized';
      if (!cats[cat]) cats[cat] = { count: 0, value: 0 };
      cats[cat].count += Number(order.quantityStocked || 1);
      cats[cat].value += (Number(order.sellingPriceETB) * Number(order.quantityStocked || 1));
    });
    return Object.entries(cats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [activeOrdersList]);


  // ==========================================
  // INVENTORY ANALYSIS CALCULATIONS (CURRENT SNAPSHOT)
  // ==========================================
  // Inventory is styled as a current snapshot, but we can also filter or analyze the active styles.
  const activeInventory = useMemo(() => {
    return inventory.filter(item => 
      item.status !== 'ordered' && !item.customerName && !(Number(item.prePaymentETB) > 0)
    );
  }, [inventory]);

  const totalUniqueStyles = activeInventory.length;
  
  const totalPhysicalStock = useMemo(() => {
    return activeInventory.reduce((sum, item) => sum + Number(item.quantityStocked), 0);
  }, [activeInventory]);

  const totalInventoryCostValue = useMemo(() => {
    return activeInventory.reduce((sum, item) => sum + (Number(item.totalCostPriceETB) * Number(item.quantityStocked)), 0);
  }, [activeInventory]);

  const totalInventoryRetailValue = useMemo(() => {
    return activeInventory.reduce((sum, item) => sum + (Number(item.sellingPriceETB) * Number(item.quantityStocked)), 0);
  }, [activeInventory]);

  const potentialInventoryProfit = totalInventoryRetailValue - totalInventoryCostValue;
  const avgInventoryMarkup = totalInventoryCostValue > 0 
    ? ((totalInventoryRetailValue - totalInventoryCostValue) / totalInventoryCostValue) * 100 
    : 0;

  // Inventory by Category
  const inventoryByCategory = useMemo(() => {
    const cats: Record<string, { styles: number; stock: number; cost: number; retail: number }> = {};
    activeInventory.forEach(item => {
      const cat = item.category || 'Uncategorized';
      if (!cats[cat]) {
        cats[cat] = { styles: 0, stock: 0, cost: 0, retail: 0 };
      }
      cats[cat].styles += 1;
      cats[cat].stock += Number(item.quantityStocked);
      cats[cat].cost += Number(item.totalCostPriceETB) * Number(item.quantityStocked);
      cats[cat].retail += Number(item.sellingPriceETB) * Number(item.quantityStocked);
    });
    return Object.entries(cats).map(([name, data]) => ({
      name,
      ...data,
      potentialProfit: data.retail - data.cost,
      markup: data.cost > 0 ? ((data.retail - data.cost) / data.cost) * 100 : 0
    })).sort((a, b) => b.retail - a.retail);
  }, [activeInventory]);

  // Inventory by Size Distribution (Aggregating variants + main size)
  const inventoryBySize = useMemo(() => {
    const sizes: Record<string, number> = {
      'XS': 0, 'S': 0, 'M': 0, 'L': 0, 'XL': 0, 'XXL': 0, 'One Size': 0
    };
    
    activeInventory.forEach(item => {
      if (item.variants && item.variants.length > 0) {
        item.variants.forEach(variant => {
          if (sizes[variant.size] !== undefined) {
            sizes[variant.size] += Number(variant.quantity);
          } else {
            sizes[variant.size] = Number(variant.quantity);
          }
        });
      } else {
        const itemSize = item.size || 'One Size';
        if (sizes[itemSize] !== undefined) {
          sizes[itemSize] += Number(item.quantityStocked);
        } else {
          sizes[itemSize] = Number(item.quantityStocked);
        }
      }
    });

    return Object.entries(sizes)
      .map(([size, quantity]) => ({ size, quantity }))
      .filter(item => item.quantity > 0);
  }, [activeInventory]);

  // SHEIN SKU Stock Density analysis
  const sheinSkuStockDensity = useMemo(() => {
    const skus: Record<string, { itemName: string; category: string; quantity: number; costVal: number; retailVal: number }> = {};
    activeInventory.forEach(item => {
      const sku = item.sheinSku || 'No-SKU';
      if (!skus[sku]) {
        skus[sku] = {
          itemName: item.itemName,
          category: item.category,
          quantity: 0,
          costVal: 0,
          retailVal: 0
        };
      }
      skus[sku].quantity += Number(item.quantityStocked);
      skus[sku].costVal += Number(item.totalCostPriceETB) * Number(item.quantityStocked);
      skus[sku].retailVal += Number(item.sellingPriceETB) * Number(item.quantityStocked);
    });

    return Object.entries(skus)
      .map(([sku, data]) => ({ sku, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10); // Top 10 SKUs in physical inventory
  }, [activeInventory]);

  // Low Stock Items (0 < qty < 5)
  const lowStockList = useMemo(() => {
    return activeInventory
      .filter(item => item.quantityStocked > 0 && item.quantityStocked < 5)
      .sort((a, b) => a.quantityStocked - b.quantityStocked);
  }, [activeInventory]);

  // Out of Stock Items (qty === 0)
  const outOfStockList = useMemo(() => {
    return activeInventory.filter(item => item.quantityStocked === 0);
  }, [activeInventory]);


  // ==========================================
  // CHART DATA: REVENUE & EXPENSES OVER TIME
  // ==========================================
  const temporalChartData = useMemo(() => {
    if (dateFilterType === 'overall') {
      // If overall, group sales and expenses by month for the last 6 months
      const months = Array.from({ length: 6 }).map((_, i) => {
        const d = subMonths(new Date(), 5 - i);
        return {
          label: format(d, 'MMM yy'),
          dateStart: startOfMonth(d),
          dateEnd: endOfMonth(d),
          revenue: 0,
          expenses: 0,
          net: 0
        };
      });

      sales.forEach(sale => {
        if (!sale.dateSold) return;
        try {
          const sDate = parseISO(sale.dateSold);
          const mData = months.find(m => sDate >= m.dateStart && sDate <= m.dateEnd);
          if (mData) {
            mData.revenue += ((Number(sale.sellingPriceETB) * Number(sale.quantitySold)) - (Number(sale.discountAmountETB) || 0));
          }
        } catch {}
      });

      expenses.forEach(exp => {
        if (!exp.date) return;
        try {
          const eDate = parseISO(exp.date);
          const mData = months.find(m => eDate >= m.dateStart && eDate <= m.dateEnd);
          if (mData) {
            mData.expenses += Number(exp.amountETB);
          }
        } catch {}
      });

      return months.map(m => ({
        label: m.label,
        Revenue: m.revenue,
        Expenses: m.expenses,
        Profit: m.revenue - m.expenses
      }));
    }

    // For specific date, range or month - list daily items
    let start = subDays(new Date(), 6);
    let end = new Date();

    if (dateFilterType === 'today') {
      start = startOfDay(new Date());
      end = endOfDay(new Date());
    } else if (dateFilterType === 'yesterday') {
      start = startOfDay(startOfYesterday());
      end = endOfDay(startOfYesterday());
    } else if (dateFilterType === 'specific') {
      start = startOfDay(parseISO(specificDateString));
      end = endOfDay(parseISO(specificDateString));
    } else if (dateFilterType === '7days') {
      start = subDays(new Date(), 6);
      end = new Date();
    } else if (dateFilterType === 'month') {
      start = startOfMonth(new Date());
      end = endOfMonth(new Date());
    } else if (dateFilterType === 'range') {
      start = parseISO(startDateString);
      end = parseISO(endDateString);
    }

    try {
      const interval = eachDayOfInterval({ start, end });
      const dailyData = interval.map(d => ({
        date: d,
        label: interval.length > 12 ? format(d, 'dd/MM') : format(d, 'EEE dd'),
        Revenue: 0,
        Expenses: 0,
        Profit: 0
      }));

      filteredSales.forEach(sale => {
        if (!sale.dateSold) return;
        try {
          const sDate = parseISO(sale.dateSold);
          const dayMatch = dailyData.find(d => isSameDay(d.date, sDate));
          if (dayMatch) {
            dayMatch.Revenue += ((Number(sale.sellingPriceETB) * Number(sale.quantitySold)) - (Number(sale.discountAmountETB) || 0));
          }
        } catch {}
      });

      filteredExpenses.forEach(exp => {
        if (!exp.date) return;
        try {
          const eDate = parseISO(exp.date);
          const dayMatch = dailyData.find(d => isSameDay(d.date, eDate));
          if (dayMatch) {
            dayMatch.Expenses += Number(exp.amountETB);
          }
        } catch {}
      });

      return dailyData.map(d => ({
        label: d.label,
        Revenue: d.Revenue,
        Expenses: d.Expenses,
        Profit: d.Revenue - d.Expenses
      }));
    } catch {
      // Return empty or fallback
      return [];
    }
  }, [dateFilterType, specificDateString, startDateString, endDateString, sales, expenses, filteredSales, filteredExpenses]);

  // Handle trigger for window printing
  const handlePrint = () => {
    window.print();
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5">
        <EyeOff className="h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-1">Access Restrained</h3>
        <p className="text-sm text-gray-500 max-w-md">
          You need Administrator or Superadmin level privileges to view business financial statements, inventory cost profiles, and order valuations.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:p-0 print:space-y-4 print:bg-white">
      {/* Header Info */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 font-serif">Reports & Analytics</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#a94442]/10 px-2.5 py-0.5 text-xs font-medium text-[#a94442]">
              <Sparkles className="h-3 w-3" />
              Live Ledger
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Real-time financial audits, active order tracking, and stock value evaluations.
          </p>
        </div>
        
        {/* Print / Export Action Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#a94442] transition-colors"
          >
            <Printer className="-ml-1 mr-2 h-4 w-4 text-gray-500" />
            Print Ledger
          </button>
        </div>
      </div>

      {/* Unified Date Filters Banner */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-4 sm:p-5 print:border print:shadow-none print:p-0">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-50 text-[#a94442] rounded-lg">
              <ListFilter className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-semibold tracking-wider uppercase">Active Reporting Period</p>
              <h4 className="text-sm font-bold text-gray-900">{periodLabel}</h4>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1.5 rounded-xl">
            {(['today', 'yesterday', 'specific', '7days', 'month', 'range', 'overall'] as const).map((type) => {
              let label = '';
              switch (type) {
                case 'today': label = 'Today'; break;
                case 'yesterday': label = 'Yesterday'; break;
                case 'specific': label = 'Specific Day'; break;
                case '7days': label = '7 Days'; break;
                case 'month': label = 'This Month'; break;
                case 'range': label = 'Custom Range'; break;
                case 'overall': label = 'Overall / To Date'; break;
              }
              return (
                <button
                  key={type}
                  onClick={() => setDateFilterType(type)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    dateFilterType === type
                      ? 'bg-[#a94442] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Contextual Inputs */}
        {(dateFilterType === 'specific' || dateFilterType === 'range') && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 items-center print:hidden">
            {dateFilterType === 'specific' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-500">Pick Target Day:</span>
                <input 
                  type="date" 
                  value={specificDateString}
                  onChange={(e) => setSpecificDateString(e.target.value)}
                  className="text-xs border-gray-300 rounded-lg focus:ring-1 focus:ring-[#a94442] focus:border-[#a94442]"
                />
              </div>
            )}
            {dateFilterType === 'range' && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">Start Date:</span>
                  <input 
                    type="date" 
                    value={startDateString}
                    onChange={(e) => setStartDateString(e.target.value)}
                    className="text-xs border-gray-300 rounded-lg focus:ring-1 focus:ring-[#a94442]"
                  />
                </div>
                <span className="text-gray-400 text-xs">to</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500">End Date:</span>
                  <input 
                    type="date" 
                    value={endDateString}
                    onChange={(e) => setEndDateString(e.target.value)}
                    className="text-xs border-gray-300 rounded-lg focus:ring-1 focus:ring-[#a94442]"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Print Header Overlay (Only visible in Print) */}
        <div className="hidden print:block border-b pb-4 mb-4 text-center">
          <h1 className="text-2xl font-serif font-bold text-gray-900">MIRA FASHION LEDGER REPORT</h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Generated on: {format(new Date(), 'yyyy-MM-dd HH:mm')}</p>
          <div className="mt-2 text-sm font-semibold text-gray-800 bg-gray-50 inline-block px-4 py-1.5 rounded-full border">
            Report Type: {activeTab === 'profit_loss' ? 'Profit & Loss Statement' : activeTab === 'orders_analysis' ? 'Orders Analysis' : 'Inventory Analysis'} — Period: {periodLabel}
          </div>
        </div>
      </div>

      {/* Main Reports Sub-Tab Selectors */}
      <div className="flex border-b border-gray-200 bg-white rounded-2xl p-1 shadow-sm ring-1 ring-gray-900/5 print:hidden">
        <button
          onClick={() => setActiveTab('profit_loss')}
          className={`flex-1 py-3 text-xs font-bold text-center flex items-center justify-center gap-2 rounded-xl transition-all ${
            activeTab === 'profit_loss'
              ? 'bg-[#a94442] text-white shadow'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Financial Profit & Loss
        </button>
        <button
          onClick={() => setActiveTab('orders_analysis')}
          className={`flex-1 py-3 text-xs font-bold text-center flex items-center justify-center gap-2 rounded-xl transition-all ${
            activeTab === 'orders_analysis'
              ? 'bg-[#a94442] text-white shadow'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <ShoppingCart className="h-4 w-4" />
          Orders Analysis
        </button>
        <button
          onClick={() => setActiveTab('inventory_analysis')}
          className={`flex-1 py-3 text-xs font-bold text-center flex items-center justify-center gap-2 rounded-xl transition-all ${
            activeTab === 'inventory_analysis'
              ? 'bg-[#a94442] text-white shadow'
              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
          }`}
        >
          <Package className="h-4 w-4" />
          Inventory Analysis
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. FINANCIAL PROFIT & LOSS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'profit_loss' && (
        <div className="space-y-6">
          {/* Key Financial KPIs Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Revenue card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                <span>Gross Revenue</span>
                <span className="p-1 rounded bg-emerald-50 text-emerald-700">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xl font-bold text-gray-900 font-mono">{formatETB(totalRevenue)}</p>
                <p className="text-[10px] text-gray-400 mt-1">{filteredSales.length} Units Dispatched</p>
              </div>
            </div>

            {/* COGS card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                <span>Cost of Goods Sold</span>
                <span className="p-1 rounded bg-orange-50 text-orange-700">
                  <Package className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xl font-bold text-red-600 font-mono">{formatETB(totalCOGS)}</p>
                <p className="text-[10px] text-gray-400 mt-1">Acquisition & logistics</p>
              </div>
            </div>

            {/* Gross Profit card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                <span>Gross Profit</span>
                <span className={`p-1 rounded text-xs font-bold ${grossProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {grossMargin.toFixed(0)}% margin
                </span>
              </div>
              <div className="mt-3">
                <p className={`text-xl font-bold font-mono ${grossProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatETB(grossProfit)}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Pre-operating expense</p>
              </div>
            </div>

            {/* Expenses card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                <span>Operating Expenses</span>
                <span className="p-1 rounded bg-red-50 text-red-700">
                  <ArrowDownRight className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xl font-bold text-gray-900 font-mono">{formatETB(totalOperatingExpenses)}</p>
                <p className="text-[10px] text-gray-400 mt-1">{filteredExpenses.length} Expense Slips</p>
              </div>
            </div>

            {/* Net Profit card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5 flex flex-col justify-between border border-[#a94442]/10 bg-gradient-to-br from-white to-red-50/10">
              <div className="flex items-center justify-between text-gray-500 text-xs font-semibold">
                <span>Net Bottom Profit</span>
                <span className={`p-1 rounded text-xs font-bold ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {netMargin.toFixed(0)}% Margin
                </span>
              </div>
              <div className="mt-3">
                <p className={`text-xl font-bold font-mono ${netProfit >= 0 ? 'text-[#a94442]' : 'text-red-700'}`}>
                  {formatETB(netProfit)}
                </p>
                <p className="text-[10px] text-gray-400 mt-1">Final earnings in period</p>
              </div>
            </div>
          </div>

          {/* Temporal Income & Expense Chart */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6 print:hidden">
            <h3 className="text-sm font-bold text-gray-900 mb-1">Financial Trendline</h3>
            <p className="text-xs text-gray-500 mb-6">Revenue versus expenses plotted for the selected reporting period</p>
            
            <div className="h-72 w-full">
              {temporalChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={temporalChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      dy={8}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10 }}
                      tickFormatter={(value) => `${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 shadow-xl ring-1 ring-gray-900/5 rounded-xl border border-gray-100 text-xs space-y-1.5">
                              <p className="font-bold text-gray-900 mb-1 border-b pb-1">{payload[0].payload.label}</p>
                              {payload.map((p, i) => (
                                <div key={i} className="flex justify-between gap-6">
                                  <span className="text-gray-500 font-medium">{p.name}:</span>
                                  <span className="font-bold text-gray-900">{formatETB(p.value as number)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="Revenue" fill="#10b981" fillOpacity={0.85} radius={[3, 3, 0, 0]} barSize={16} />
                    <Bar dataKey="Expenses" fill="#f43f5e" fillOpacity={0.85} radius={[3, 3, 0, 0]} barSize={16} />
                    <Bar dataKey="Profit" fill="#a94442" fillOpacity={0.9} radius={[3, 3, 0, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 text-xs gap-2 bg-gray-50 rounded-xl border-2 border-dashed">
                  <BarChart3 className="h-8 w-8 opacity-20 text-[#a94442]" />
                  <p>Insufficient ledger records to display temporal charts</p>
                </div>
              )}
            </div>
            <div className="flex justify-center gap-4 text-[10px] font-semibold text-gray-500 mt-2">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span>Revenue</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-full"></span>Operating Expenses</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#a94442] rounded-full"></span>Net Profit</span>
            </div>
          </div>

          {/* Income Statement Matrix */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-6 print:border print:shadow-none">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b pb-4 mb-6 gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 font-serif uppercase tracking-wider flex items-center gap-2">
                  <span>Financial Statement Analysis</span>
                </h3>
                <p className="text-xs text-gray-500 mt-1">For period: {periodLabel}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 bg-gray-100 p-1 rounded-xl print:hidden">
                <button
                  onClick={() => setPlStatementType('standard')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    plStatementType === 'standard'
                      ? 'bg-white text-[#a94442] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Standard P&amp;L
                </button>
                <button
                  onClick={() => setPlStatementType('ordered_items')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    plStatementType === 'ordered_items'
                      ? 'bg-white text-[#a94442] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Ordered Items
                </button>
                <button
                  onClick={() => setPlStatementType('inventory_valuation')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    plStatementType === 'inventory_valuation'
                      ? 'bg-white text-[#a94442] shadow-sm'
                      : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  Inventory Valuation
                </button>
              </div>
            </div>

            {plStatementType === 'standard' && (
              <div className="space-y-4 text-sm font-medium text-gray-800">
                {/* Category 1: Revenue */}
                <div>
                  <div className="flex justify-between py-1.5 border-b font-bold text-gray-900 text-base">
                    <span>1. Gross Sales Revenue</span>
                    <span className="font-mono">{formatETB(totalRevenue)}</span>
                  </div>
                  
                  {/* Separate standard and ordered revenue lines */}
                  <div className="pl-4 mt-2 space-y-1.5 border-l-2 border-[#a94442]/10">
                    <div className="flex justify-between text-xs text-gray-700">
                      <span className="font-medium">Standard Stock Sales:</span>
                      <span className="font-mono font-semibold">{formatETB(standardRevenue)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-indigo-700">
                      <span className="font-medium">Delivered Custom Orders Sales:</span>
                      <span className="font-mono font-semibold">{formatETB(orderedRevenue)}</span>
                    </div>
                  </div>

                  <div className="pl-4 mt-3 text-[11px] text-gray-400 font-bold uppercase tracking-wider">Top Product Sales Logs</div>
                  <div className="pl-4 text-xs text-gray-500 mt-1 space-y-1">
                    {filteredSales.slice(0, 5).map((s, idx) => {
                      const isOrd = s.status === 'delivered' || !!s.customerName || (Number(s.prePaymentETB) > 0);
                      return (
                        <div key={idx} className="flex justify-between">
                          <span>
                            {s.itemName} ({s.selectedSize || s.sheinSku}) - x{s.quantitySold} units
                            {isOrd && <span className="ml-1 text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-semibold">Custom Order</span>}
                          </span>
                          <span className="font-mono">{formatETB((s.sellingPriceETB * s.quantitySold) - (s.discountAmountETB || 0))}</span>
                        </div>
                      );
                    })}
                    {filteredSales.length > 5 && (
                      <div className="text-left font-serif italic text-[#a94442]">... and {filteredSales.length - 5} other product sales records.</div>
                    )}
                    {filteredSales.length === 0 && <div className="text-left italic">No sales registered in this period.</div>}
                  </div>
                </div>

                {/* Category 2: Cost of Sales */}
                <div className="pt-2">
                  <div className="flex justify-between py-1.5 border-b font-bold text-gray-900 text-base">
                    <span>2. Cost of Goods Sold (COGS)</span>
                    <span className="text-red-600 font-mono">({formatETB(totalCOGS)})</span>
                  </div>
                  
                  {/* Separate standard and ordered COGS lines */}
                  <div className="pl-4 mt-2 space-y-1.5 border-l-2 border-red-500/10">
                    <div className="flex justify-between text-xs text-gray-700">
                      <span className="font-medium">Standard Stock COGS:</span>
                      <span className="font-mono font-semibold">({formatETB(standardCOGS)})</span>
                    </div>
                    <div className="flex justify-between text-xs text-indigo-700">
                      <span className="font-medium">Delivered Custom Orders COGS:</span>
                      <span className="font-mono font-semibold">({formatETB(orderedCOGS)})</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-400 pl-4 mt-2">Represents direct manufacturing, sourcing buying prices, shipping costs, local delivery, customs taxes, and logistics costs tied to dispatched inventory.</p>
                  <div className="pl-4 text-xs text-gray-500 mt-2 space-y-1">
                    {filteredSales.slice(0, 5).map((s, idx) => {
                      const isOrd = s.status === 'delivered' || !!s.customerName || (Number(s.prePaymentETB) > 0);
                      return (
                        <div key={idx} className="flex justify-between">
                          <span>
                            Cost of sale: {s.itemName} (x{s.quantitySold})
                            {isOrd && <span className="ml-1 text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.2 rounded font-semibold">Custom Order</span>}
                          </span>
                          <span className="font-mono">{formatETB(s.totalCostPriceETB * s.quantitySold)}</span>
                        </div>
                      );
                    })}
                    {filteredSales.length === 0 && <div className="text-left italic">No cost of goods logged.</div>}
                  </div>
                </div>

                {/* Gross Margin Row */}
                <div className="bg-gray-50 p-3 rounded-xl flex justify-between font-bold text-gray-950 text-base border-y my-3">
                  <span>Gross Profit Margin ({grossMargin.toFixed(1)}%)</span>
                  <span className="font-mono">{formatETB(grossProfit)}</span>
                </div>

                {/* Category 3: Operating Expenses */}
                <div className="pt-2">
                  <div className="flex justify-between py-1.5 border-b font-bold text-gray-900 text-base">
                    <span>3. Operating Expenses (OpEx)</span>
                    <span className="text-red-600 font-mono">({formatETB(totalOperatingExpenses)})</span>
                  </div>
                  <div className="pl-4 text-xs text-gray-500 mt-2.5 space-y-2">
                    {expensesByCategory.map((exp, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                          <span className="font-semibold text-gray-700">{exp.name} category</span>
                        </div>
                        <span className="font-mono">{formatETB(exp.amount)}</span>
                      </div>
                    ))}
                    {filteredExpenses.length === 0 && <div className="text-left italic">No operating expenses registered.</div>}
                  </div>
                </div>

                {/* Net Margins Row */}
                <div className={`p-4 rounded-xl flex justify-between items-center font-bold text-lg border mt-6 ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'}`}>
                  <div>
                    <p>Net Bottom Line Earnings</p>
                    <p className="text-xs font-semibold text-gray-500 font-sans mt-0.5">Net Profit Margin: {netMargin.toFixed(1)}%</p>
                  </div>
                  <span className="font-mono text-xl">{formatETB(netProfit)}</span>
                </div>
              </div>
            )}

            {plStatementType === 'ordered_items' && (
              <div className="space-y-6">
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 flex items-start gap-2.5 text-xs text-[#a94442]">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#a94442]" />
                  <div>
                    <span className="font-bold">Ordered Items Financial Position:</span> These are customer custom orders that are currently "In Transit" or "Pending Delivery". Prepayments represent liquid deposits, while pending balances represent future cash inflows upon fulfillment.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b pb-6">
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Gross Expected Value</p>
                    <p className="text-lg font-bold text-gray-900 font-mono mt-1">{formatETB(ordersExpectedRevenue)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Contract value of all items</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Prepayments Collected</p>
                    <p className="text-lg font-bold text-emerald-700 font-mono mt-1">{formatETB(ordersPrepaymentsCollected)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Average ratio: {avgPrepaymentPercentage.toFixed(1)}%</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Outstanding Balance Due</p>
                    <p className="text-lg font-bold text-amber-700 font-mono mt-1">{formatETB(ordersPendingBalance)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">To collect at delivery points</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Order Category Distribution &amp; Portfolio Value</h4>
                  <div className="space-y-3">
                    {ordersByCategory.map((cat, idx) => {
                      const percentage = ordersExpectedRevenue > 0 ? (cat.value / ordersExpectedRevenue) * 100 : 0;
                      return (
                        <div key={idx} className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="font-semibold text-gray-700">{cat.name} ({cat.count} units)</span>
                            <span className="font-bold text-gray-900">{formatETB(cat.value)}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${percentage}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {ordersByCategory.length === 0 && <p className="text-xs italic text-gray-400">No ordered items available.</p>}
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Active Order Inventory &amp; Balances</h4>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto border rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">Customer</th>
                          <th className="px-3 py-2 text-left">Item Details</th>
                          <th className="px-3 py-2 text-right">Selling Price</th>
                          <th className="px-3 py-2 text-right">Deposit Paid</th>
                          <th className="px-3 py-2 text-right">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-600 bg-white">
                        {activeOrdersList.map((order) => {
                          const totalVal = Number(order.sellingPriceETB) * Number(order.quantityStocked || 1);
                          const prepay = Number(order.prePaymentETB) || 0;
                          const bal = totalVal - prepay;
                          return (
                            <tr key={order.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2">
                                <div className="font-bold text-gray-800">{order.customerName || 'Walk-in'}</div>
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {order.customerTelegram && (
                                    <a
                                      href={getTelegramLink(order.customerTelegram)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-1 py-0.5 rounded transition-all"
                                      title="Chat on Telegram"
                                    >
                                      <Send className="h-2 w-2" />
                                      <span>TG</span>
                                    </a>
                                  )}
                                  {order.customerPhone && (
                                    <a
                                      href={getWhatsAppLink(order.customerPhone)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1 py-0.5 rounded transition-all"
                                      title="Chat on WhatsApp"
                                    >
                                      <MessageSquare className="h-2 w-2" />
                                      <span>WA</span>
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-semibold text-gray-800">{order.itemName}</div>
                                <div className="text-[10px] text-gray-400">{order.size || 'One Size'} (x{order.quantityStocked})</div>
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold">{formatETB(totalVal)}</td>
                              <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold">{formatETB(prepay)}</td>
                              <td className="px-3 py-2 text-right font-mono text-amber-700 font-bold">{formatETB(bal)}</td>
                            </tr>
                          );
                        })}
                        {activeOrdersList.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-gray-400 italic">No active client orders found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {plStatementType === 'inventory_valuation' && (
              <div className="space-y-6">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100 flex items-start gap-2.5 text-xs text-[#a94442]">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#a94442]" />
                  <div>
                    <span className="font-bold">Inventory Asset Notice:</span> This analysis evaluates physical stock assets currently held "In Stock" (excluding ordered/sold items). Values represent tied capital at direct cost and potential revenue generation at current catalog prices.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 border-b pb-6">
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Asset Cost Value (CapEx)</p>
                    <p className="text-lg font-bold text-gray-900 font-mono mt-1">{formatETB(totalInventoryCostValue)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Capital tied up in stock</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Expected Retail Value</p>
                    <p className="text-lg font-bold text-[#a94442] font-mono mt-1">{formatETB(totalInventoryRetailValue)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">If fully liquidated at full list</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Locked Gross Profit</p>
                    <p className="text-lg font-bold text-emerald-700 font-mono mt-1">{formatETB(potentialInventoryProfit)}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Potential unrealized margin</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border">
                    <p className="text-xs font-semibold text-gray-500">Average Markup Ratio</p>
                    <p className="text-lg font-bold text-blue-700 font-mono mt-1">{avgInventoryMarkup.toFixed(1)}%</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">Markup over landed cost</p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Valuation breakdown by Category</h4>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Category</th>
                          <th className="px-3 py-2 text-center">In-Stock Styles</th>
                          <th className="px-3 py-2 text-right">Capital Cost Value</th>
                          <th className="px-3 py-2 text-right">Retail Potential</th>
                          <th className="px-3 py-2 text-right">Markup %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-gray-600 bg-white">
                        {inventoryByCategory.map((cat, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-bold text-gray-800">{cat.name}</td>
                            <td className="px-3 py-2 text-center">{cat.styles} styles ({cat.stock} units)</td>
                            <td className="px-3 py-2 text-right font-mono">{formatETB(cat.cost)}</td>
                            <td className="px-3 py-2 text-right font-mono text-emerald-700 font-bold">{formatETB(cat.retail)}</td>
                            <td className="px-3 py-2 text-right font-mono font-semibold text-blue-700">{cat.markup.toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Historical Dual Ledger Journal List */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6 print:hidden">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-500" />
              Reporting Journal Logs ({filteredSales.length + filteredExpenses.length} entries)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50 font-bold text-gray-700">
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-right">Inflow (Sales)</th>
                    <th className="px-4 py-3 text-right">Outflow (Costs / Expenses)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {/* Map Sales */}
                  {filteredSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono">
                        {sale.dateSold ? format(parseISO(sale.dateSold), 'yyyy-MM-dd HH:mm') : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sale Dispatch
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-gray-900">{sale.itemName}</div>
                        <div className="text-[10px] text-gray-400">SKU: {sale.sheinSku} | Size: {sale.selectedSize || 'Standard'} | Qty: {sale.quantitySold}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700 font-bold">
                        {formatETB((sale.sellingPriceETB * sale.quantitySold) - (sale.discountAmountETB || 0))}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-400">
                        {formatETB(sale.totalCostPriceETB * sale.quantitySold)} <span className="text-[9px] text-gray-300 font-sans block">Cost base</span>
                      </td>
                    </tr>
                  ))}

                  {/* Map Expenses */}
                  {filteredExpenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono">
                        {exp.date ? format(parseISO(exp.date), 'yyyy-MM-dd') : 'N/A'}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 text-rose-700 border border-rose-200">
                          Operating OpEx
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-gray-900">{exp.description}</div>
                        <div className="text-[10px] text-gray-400">Category: {exp.category}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-400">
                        -
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-rose-700 font-bold">
                        {formatETB(exp.amountETB)}
                      </td>
                    </tr>
                  ))}

                  {filteredSales.length === 0 && filteredExpenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                        No transactions registered inside the designated reporting period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ORDERS ANALYSIS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'orders_analysis' && (
        <div className="space-y-6">
          {/* Orders Metrics cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Active Undelivered Orders</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900 font-mono">{totalActiveOrdersCount}</span>
                <span className="text-xs text-gray-400">In Transit/Pending</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Awaiting delivery dispatch</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Gross Expected Value</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#a94442] font-mono">{formatETB(ordersExpectedRevenue)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Retail price of ordered styles</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Prepayments Collected</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-700 font-mono">{formatETB(ordersPrepaymentsCollected)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Deposits in bank cashflow</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Remaining Collectable</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600 font-mono">{formatETB(ordersPendingBalance)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">To collect at delivery point</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Average Prepayment Ratio</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900 font-mono">{avgPrepaymentPercentage.toFixed(1)}%</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Of total order contract value</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders Category Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6 lg:col-span-1">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-gray-500" />
                Orders Category Volume
              </h3>
              <div className="space-y-4">
                {ordersByCategory.map((cat, idx) => {
                  const percentage = ordersExpectedRevenue > 0 ? (cat.value / ordersExpectedRevenue) * 100 : 0;
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-gray-700">{cat.name} ({cat.count} units)</span>
                        <span className="font-bold text-gray-900">{formatETB(cat.value)}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-[#a94442] rounded-full transition-all" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {ordersByCategory.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">No order volume logged in this timeframe.</p>
                )}
              </div>
            </div>

            {/* General Orders Status Metrics */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6 lg:col-span-2">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                Fulfillment Funnel Efficiency
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-between border">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500">Order-to-Delivery Rate</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Ratio of delivered sales against total orders</p>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold text-emerald-700 font-mono">
                      {((filteredSales.length / (totalActiveOrdersCount + filteredSales.length || 1)) * 100).toFixed(0)}%
                    </span>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {filteredSales.length} Delivered vs {totalActiveOrdersCount} Pending
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 flex flex-col justify-between border">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500">Uncollected Cash Ratio</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">Funds waiting on transit dispatch</p>
                  </div>
                  <div className="mt-4">
                    <span className="text-3xl font-extrabold text-amber-600 font-mono">
                      {((ordersPendingBalance / (ordersExpectedRevenue || 1)) * 100).toFixed(0)}%
                    </span>
                    <p className="text-[10px] text-gray-500 mt-1">
                      {formatETB(ordersPendingBalance)} collectable out of {formatETB(ordersExpectedRevenue)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-red-50/50 rounded-xl border border-red-100 flex items-start gap-2.5 text-xs text-[#a94442] leading-snug">
                <Info className="h-4 w-4 shrink-0 mt-0.5 text-[#a94442]" />
                <div>
                  <span className="font-bold">Pending Delivery Dispatch Notice:</span> Secure client verification logs before dispatching items. Prepayment percentages below 50% should be prioritized with cautious courier assignments.
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Active Orders Ledger */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-gray-500" />
                Active Undelivered Client Orders ({activeOrdersList.length} items waiting)
              </span>
              <span className="text-xs text-gray-500 font-semibold">Total to Collect: {formatETB(ordersPendingBalance)}</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50 font-bold text-gray-700">
                    <th className="px-4 py-3 text-left">Order Date</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Product Details</th>
                    <th className="px-4 py-3 text-right">Retail Value</th>
                    <th className="px-4 py-3 text-right">Deposit Paid</th>
                    <th className="px-4 py-3 text-right">Balance Due</th>
                    <th className="px-4 py-3 text-center">Prepaid %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {activeOrdersList.map((order) => {
                    const totalVal = Number(order.sellingPriceETB) * Number(order.quantityStocked || 1);
                    const prepay = Number(order.prePaymentETB) || 0;
                    const bal = totalVal - prepay;
                    const pct = totalVal > 0 ? (prepay / totalVal) * 100 : 0;

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap font-mono">
                          {order.dateAdded ? format(parseISO(order.dateAdded), 'yyyy-MM-dd') : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900">{order.customerName || 'Anonymous Customer'}</div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {order.customerTelegram && (
                              <a
                                href={getTelegramLink(order.customerTelegram)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-1 py-0.5 rounded transition-all"
                                title="Chat on Telegram"
                              >
                                <Send className="h-2 w-2" />
                                <span>TG</span>
                              </a>
                            )}
                            {order.customerPhone && (
                              <a
                                href={getWhatsAppLink(order.customerPhone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-1 py-0.5 rounded transition-all"
                                title="Chat on WhatsApp"
                              >
                                <MessageSquare className="h-2 w-2" />
                                <span>WA</span>
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900">{order.itemName}</div>
                          <div className="text-[10px] text-gray-400">
                            Sku: {order.sheinSku} | Size: {order.size || 'One Size'} (x{order.quantityStocked})
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold">
                          {formatETB(totalVal)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-emerald-700 font-bold">
                          {formatETB(prepay)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-amber-700 font-bold">
                          {formatETB(bal)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            pct >= 100 
                              ? 'bg-emerald-50 text-emerald-700' 
                              : pct >= 50 
                              ? 'bg-blue-50 text-blue-700' 
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {pct.toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {activeOrdersList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-gray-400 italic">
                        No active/pending undelivered orders were logged during this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INVENTORY ANALYSIS TAB */}
      {/* ========================================================================= */}
      {activeTab === 'inventory_analysis' && (
        <div className="space-y-6">
          <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2.5 print:hidden">
            <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Real-time Stock Snapshot Notice:</span> Inventory valuations and stock health levels are represented as a <strong>current active snapshot</strong> of physical merchandise in your warehouses (independent of the calendar filters).
            </div>
          </div>

          {/* Inventory Valuation Card Matrices */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Styles count (SKUs)</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900 font-mono">{totalUniqueStyles}</span>
                <span className="text-xs text-gray-400">styles catalogued</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Unique active model lines</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Total Physical Units</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-gray-900 font-mono">{totalPhysicalStock}</span>
                <span className="text-xs text-gray-400">pcs in stock</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Aggregated clothing units</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Total Capital Value (Cost)</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-red-600 font-mono">{formatETB(totalInventoryCostValue)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Asset value at purchase cost</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5">
              <p className="text-xs font-semibold text-gray-500">Total Retail Value (Selling)</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-700 font-mono">{formatETB(totalInventoryRetailValue)}</span>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Expected yield if fully sold</p>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm ring-1 ring-gray-900/5 bg-[#a94442]/5 border border-[#a94442]/10">
              <p className="text-xs font-semibold text-[#a94442]">Potential Future Profit</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#a94442] font-mono">{formatETB(potentialInventoryProfit)}</span>
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Avg markup: {avgInventoryMarkup.toFixed(0)}% ROI</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown Table */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-500" />
                Inventory Distribution by Category
              </h3>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead>
                    <tr className="font-semibold text-gray-500 text-left">
                      <th className="py-2 pb-3">Category</th>
                      <th className="py-2 pb-3 text-center">Styles</th>
                      <th className="py-2 pb-3 text-center">Units</th>
                      <th className="py-2 pb-3 text-right">Cost Value</th>
                      <th className="py-2 pb-3 text-right">Potential profit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-600">
                    {inventoryByCategory.map((cat, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="py-2.5 font-bold text-gray-900">{cat.name}</td>
                        <td className="py-2.5 text-center font-mono">{cat.styles}</td>
                        <td className="py-2.5 text-center font-mono">{cat.stock}</td>
                        <td className="py-2.5 text-right font-mono">{formatETB(cat.cost)}</td>
                        <td className="py-2.5 text-right font-mono text-emerald-700 font-bold">{formatETB(cat.potentialProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Size Distribution and low stock metrics */}
            <div className="space-y-6">
              {/* Size distribution density */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-gray-500" />
                  Active Physical Size Distributions
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {inventoryBySize.map((sizeData, idx) => (
                    <div key={idx} className="bg-gray-50 border rounded-xl p-3 text-center">
                      <span className="block text-xs font-bold text-gray-500 uppercase tracking-widest">{sizeData.size}</span>
                      <span className="text-xl font-extrabold text-gray-900 font-mono mt-1 block">{sizeData.quantity}</span>
                      <span className="text-[10px] text-gray-400 mt-0.5 block">units in stock</span>
                    </div>
                  ))}
                  {inventoryBySize.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-6 col-span-4">No sized variants detected.</p>
                  )}
                </div>
              </div>

              {/* Stock Alerts Overview */}
              <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2 text-rose-800">
                  <AlertTriangle className="h-4 w-4 text-[#a94442]" />
                  Inventory Health Alert Indexes
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="border border-red-200 bg-red-50/20 p-4 rounded-xl text-center">
                    <span className="text-xs font-bold text-[#a94442] uppercase">Out of Stock Lines</span>
                    <span className="text-2xl font-extrabold text-[#a94442] block mt-1 font-mono">{outOfStockList.length}</span>
                    <span className="text-[10px] text-gray-500 mt-1 block">Catalog styles with 0 qty</span>
                  </div>

                  <div className="border border-amber-200 bg-amber-50/20 p-4 rounded-xl text-center">
                    <span className="text-xs font-bold text-amber-800 uppercase">Low Stock Alert Index</span>
                    <span className="text-2xl font-extrabold text-amber-800 block mt-1 font-mono">{lowStockList.length}</span>
                    <span className="text-[10px] text-gray-500 mt-1 block">Styles with under 5 units</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SHEIN SKU Density analysis */}
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
            <h3 className="text-sm font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Package className="h-4 w-4 text-gray-500" />
              SHEIN SKU Stock Valuations &amp; Density Analysis
            </h3>
            <p className="text-xs text-gray-500 mb-4">Displays your top SHEIN SKUs ordered or held, showing total stock, unit acquisition cost, and retail potential.</p>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead>
                  <tr className="bg-gray-50 font-bold text-gray-700">
                    <th className="px-4 py-3 text-left">SHEIN SKU</th>
                    <th className="px-4 py-3 text-left">Main Product Name</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-center">In-Stock Units</th>
                    <th className="px-4 py-3 text-right">Asset Cost Value</th>
                    <th className="px-4 py-3 text-right">Potential Yield</th>
                    <th className="px-4 py-3 text-right">Potential profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {sheinSkuStockDensity.map((item) => (
                    <tr key={item.sku} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono font-bold text-[#a94442]">{item.sku}</td>
                      <td className="px-4 py-2.5">{item.itemName}</td>
                      <td className="px-4 py-2.5">{item.category}</td>
                      <td className="px-4 py-2.5 text-center font-mono font-bold text-gray-900">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatETB(item.costVal)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-emerald-700">{formatETB(item.retailVal)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-700">{formatETB(item.retailVal - item.costVal)}</td>
                    </tr>
                  ))}
                  {sheinSkuStockDensity.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-400 italic">No inventory styles currently catalogued.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Replenishment Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Low Stock Items Details List */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span className="text-amber-800 flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Replenish List: Low Stock ({lowStockList.length} styles)
                </span>
              </h3>

              <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {lowStockList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2.5 bg-amber-50/40 hover:bg-amber-50 rounded-lg border border-amber-100">
                    <div>
                      <h4 className="font-bold text-gray-950">{item.itemName}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">SKU: {item.sheinSku} | Unit Cost: {formatETB(item.totalCostPriceETB)}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-md bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800">
                        {item.quantityStocked} left
                      </span>
                    </div>
                  </div>
                ))}
                {lowStockList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">All catalog items have healthy stock levels (&gt;= 5 units).</p>
                )}
              </div>
            </div>

            {/* Out Of Stock Items Details List */}
            <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-900/5 p-5 md:p-6">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center justify-between">
                <span className="text-rose-900 flex items-center gap-1.5 font-bold">
                  <AlertCircle className="h-4 w-4 text-rose-600" />
                  Replenish List: Out of Stock / Sold Out ({outOfStockList.length} styles)
                </span>
              </h3>

              <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {outOfStockList.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-2.5 bg-red-50/30 hover:bg-red-50/60 rounded-lg border border-red-100">
                    <div>
                      <h4 className="font-bold text-gray-950">{item.itemName}</h4>
                      <p className="text-[10px] text-gray-500 mt-0.5">SKU: {item.sheinSku} | Retail Value: {formatETB(item.sellingPriceETB)}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-md bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-800 tracking-wider uppercase">
                        Sold Out
                      </span>
                    </div>
                  </div>
                ))}
                {outOfStockList.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">Great job! There are no sold out products in your catalog.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
