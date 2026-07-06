import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem, StoreSettings } from '../types';
import { formatETB } from '../lib/formatters';
import { ShoppingBag, Send, Store, Search, X, ChevronRight, Info, Instagram, Facebook, Twitter, Phone, Tag, CheckCircle2 } from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useInventory } from '../context/InventoryContext';

export function Storefront() {
  const { inventory, settings, loading: inventoryLoading } = useInventory();
  const { shopId } = useParams<{ shopId?: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [shops, setShops] = useState<StoreSettings[]>([]);
  const [shopSettings, setShopSettings] = useState<StoreSettings | null>(null);
  const [discountCodes, setDiscountCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSize, setSelectedSize] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [modalSize, setModalSize] = useState<string>('');
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<any | null>(null);
  const [promoError, setPromoError] = useState('');
  const [isOrdering, setIsOrdering] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);

  useEffect(() => {
    let unsubscribeSettings: () => void = () => {};
    let unsubscribeItems: () => void = () => {};
    let unsubscribeShops: () => void = () => {};
    let unsubscribeDiscountCodes: () => void = () => {};

    const fetchData = () => {
      console.log('Storefront: Fetching data for shopId:', shopId);
      setLoading(true);
      if (shopId) {
        // Fetch specific shop settings
        unsubscribeSettings = onSnapshot(doc(db, 'public_profiles', shopId), (docSnap) => {
          if (docSnap.exists()) {
            console.log('Storefront: Shop settings found:', docSnap.data());
            setShopSettings(docSnap.data() as StoreSettings);
          } else {
            console.log('Storefront: Shop settings not found for ID:', shopId);
          }
        });

        // Fetch items for this shop
        const q = query(collection(db, 'inventory'), where('userId', '==', shopId));
        unsubscribeItems = onSnapshot(q, (snapshot) => {
          console.log(`Storefront: Received items snapshot. Size: ${snapshot.size}`);
          const fetchedItems: InventoryItem[] = [];
          snapshot.forEach((doc) => {
            fetchedItems.push({ id: doc.id, ...doc.data() } as InventoryItem);
          });
          console.log(`Storefront: Fetched ${fetchedItems.length} items for shop:`, shopId);
          if (fetchedItems.length > 0) {
            console.log('Storefront: First item sample:', fetchedItems[0]);
          } else {
            console.log('Storefront: No items found for this shop in Firestore.');
          }
          setItems(fetchedItems);
          setLoading(false);
        }, (error) => {
          console.error('Storefront: Error fetching items:', error);
          setLoading(false);
        });

        // Fetch shop discount codes
        const dq = query(collection(db, 'discount_codes'), where('userId', '==', shopId), where('isActive', '==', true));
        unsubscribeDiscountCodes = onSnapshot(dq, (snapshot) => {
          const fetchedCodes: any[] = [];
          snapshot.forEach((doc) => {
            fetchedCodes.push({ id: doc.id, ...doc.data() });
          });
          setDiscountCodes(fetchedCodes);
        });
      } else {
        // Fetch all shops
        const q = query(collection(db, 'public_profiles'));
        unsubscribeShops = onSnapshot(q, (snapshot) => {
          const fetchedShops: StoreSettings[] = [];
          snapshot.forEach((doc) => {
            fetchedShops.push({ ...doc.data(), userId: doc.id } as StoreSettings);
          });
          console.log(`Storefront: Fetched ${fetchedShops.length} shops`);
          setShops(fetchedShops);
          setLoading(false);
        }, (error) => {
          console.error('Storefront: Error fetching shops:', error);
          setLoading(false);
        });
      }
    };

    fetchData();
    return () => {
      unsubscribeSettings();
      unsubscribeItems();
      unsubscribeShops();
      unsubscribeDiscountCodes();
    };
  }, [shopId]);

  const categories = useMemo(() => {
    const cats = new Set(['All']);
    items.forEach(item => {
      if (item.category) cats.add(item.category);
    });
    return Array.from(cats);
  }, [items]);

  const sizes = useMemo(() => {
    const szs = new Set(['All']);
    items.forEach(item => {
      if (item.size) szs.add(item.size);
      if (item.variants) {
        item.variants.forEach((v: any) => {
          if (v.size) szs.add(v.size);
        });
      }
    });
    return Array.from(szs);
  }, [items]);

  const filteredItems = items.filter(item => {
    const isAvailable = !item.status || item.status === 'in_stock';
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSize = selectedSize === 'All' || 
                        item.size === selectedSize || 
                        (item.variants && item.variants.some((v: any) => v.size === selectedSize));
    const itemName = item.itemName || '';
    const matchesSearch = itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.sheinSku && item.sheinSku.toLowerCase().includes(searchQuery.toLowerCase()));
    return isAvailable && matchesCategory && matchesSize && matchesSearch;
  });

  console.log(`Storefront: ${filteredItems.length} items passed filters out of ${items.length} total.`);

  // Group items by SKU
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const key = item.sheinSku || item.itemName;
      if (!acc[key]) {
        acc[key] = {
          ...item,
          availableSizes: item.quantityStocked > 0 ? [item.size] : [],
          totalQuantity: item.quantityStocked,
          allVariants: [item]
        };
      } else {
        if (item.quantityStocked > 0 && !acc[key].availableSizes.includes(item.size)) {
          acc[key].availableSizes.push(item.size);
        }
        acc[key].totalQuantity += item.quantityStocked;
        acc[key].allVariants.push(item);
        if (!acc[key].image && item.image) {
          acc[key].image = item.image;
        }
      }
      return acc;
    }, {} as Record<string, any>);
  }, [filteredItems]);

  const displayItems = Object.values(groupedItems) as any[];

  const handleApplyPromo = () => {
    setPromoError('');
    if (!promoCode.trim()) return;
    
    const code = discountCodes.find(c => c.code === promoCode.toUpperCase());
    if (!code) {
      setPromoError('Invalid promo code');
      return;
    }
    
    if (code.maxUses && code.currentUses >= code.maxUses) {
      setPromoError('Promo code has reached its usage limit');
      return;
    }
    
    setAppliedDiscount(code);
  };

  const handleOrder = (item: any, sizeOverride?: string) => {
    if (item.totalQuantity <= 0) return;
    
    if (shopSettings?.hasTelegramBot) {
      setIsOrdering(true);
      return;
    }

    const sizeToUse = sizeOverride || modalSize || (item.availableSizes.length === 1 ? item.availableSizes[0] : '');
    const sizesText = sizeToUse ? ` in size ${sizeToUse}` : (item.availableSizes.length > 0 ? ` in size ${item.availableSizes.join(' or ')}` : '');
    
    let priceText = `Price: ${formatETB(item.sellingPriceETB)}`;
    if (appliedDiscount) {
      const discountAmount = appliedDiscount.discountType === 'percentage' 
        ? item.sellingPriceETB * (appliedDiscount.discountValue / 100)
        : appliedDiscount.discountValue;
      const finalPrice = Math.max(0, item.sellingPriceETB - discountAmount);
      priceText = `Original Price: ${formatETB(item.sellingPriceETB)}\nPromo Code: ${appliedDiscount.code} (-${appliedDiscount.discountType === 'percentage' ? `${appliedDiscount.discountValue}%` : formatETB(appliedDiscount.discountValue)})\nFinal Price: ${formatETB(finalPrice)}`;
    }
    
    const message = `Hi, I want to buy the ${item.itemName}${sizesText}.\n\n${priceText}\nSKU: ${item.sheinSku || 'N/A'}\n\nis it available?`;
    
    const telegramUsername = shopSettings?.telegramUsername?.replace('@', '') || import.meta.env.VITE_TELEGRAM_USERNAME || 'YOUR_TELEGRAM_USERNAME';
    const telegramUrl = `https://t.me/${telegramUsername}?text=${encodeURIComponent(message)}`;
    window.open(telegramUrl, '_blank');
  };

  const submitOrder = async () => {
    if (!customerName || !customerPhone || !selectedProduct) return;
    
    const sizeToUse = modalSize || (selectedProduct.availableSizes.length === 1 ? selectedProduct.availableSizes[0] : '');
    const sizesText = sizeToUse ? ` in size ${sizeToUse}` : '';
    
    let finalPrice = selectedProduct.sellingPriceETB;
    let discountAmount = 0;
    let discountText = '';
    
    if (appliedDiscount) {
      discountAmount = appliedDiscount.discountType === 'percentage' 
        ? selectedProduct.sellingPriceETB * (appliedDiscount.discountValue / 100)
        : appliedDiscount.discountValue;
      finalPrice = Math.max(0, selectedProduct.sellingPriceETB - discountAmount);
      discountText = `\nPromo Code: ${appliedDiscount.code} (-${appliedDiscount.discountType === 'percentage' ? `${appliedDiscount.discountValue}%` : formatETB(appliedDiscount.discountValue)})`;
    }

    const orderDetails = `Item: ${selectedProduct.itemName}${sizesText}\nSKU: ${selectedProduct.sheinSku || 'N/A'}\nPrice: ${formatETB(finalPrice)}${discountText}\n\nCustomer: ${customerName}\nPhone: ${customerPhone}`;

    try {
      // 1. Send notification via API
      await fetch('/api/notify-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId, orderDetails })
      });

      // 2. Save order to database (as an inventory item with status 'ordered')
      const orderId = Math.random().toString(36).substring(2, 9);
      const { setDoc, doc, updateDoc } = await import('firebase/firestore');
      
      // Create the order item
      await setDoc(doc(db, 'inventory', orderId), {
        id: orderId,
        userId: shopId,
        itemName: selectedProduct.itemName,
        sheinSku: selectedProduct.sheinSku || 'UNKNOWN',
        category: selectedProduct.category,
        size: sizeToUse,
        quantityStocked: 1, // 1 item ordered
        buyingPriceUSD: selectedProduct.buyingPriceUSD,
        exchangeRate: selectedProduct.exchangeRate,
        shippingCostETB: selectedProduct.shippingCostETB,
        customsTaxETB: selectedProduct.customsTaxETB,
        localDeliveryFeeETB: selectedProduct.localDeliveryFeeETB,
        totalCostPriceETB: selectedProduct.totalCostPriceETB,
        sellingPriceETB: finalPrice, // Use final price after discount
        dateAdded: new Date().toISOString(),
        status: 'ordered',
        customerName,
        customerPhone,
        image: selectedProduct.image || null
      });

      // Decrement stock of the original item
      let updateData: any = {};
      if (selectedProduct.variants && sizeToUse) {
        const newVariants = selectedProduct.variants.map((v: any) => 
          v.size === sizeToUse ? { ...v, quantity: Math.max(0, v.quantity - 1) } : v
        );
        const newTotalQuantity = newVariants.reduce((sum: number, v: any) => sum + v.quantity, 0);
        updateData = { variants: newVariants, quantityStocked: newTotalQuantity };
      } else {
        const newQuantity = Math.max(0, Number(selectedProduct.quantityStocked) - 1);
        updateData = { quantityStocked: newQuantity };
      }
      await updateDoc(doc(db, 'inventory', selectedProduct.id), updateData);

      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        setIsOrdering(false);
        setSelectedProduct(null);
        setCustomerName('');
        setCustomerPhone('');
        setAppliedDiscount(null);
        setPromoCode('');
      }, 3000);
    } catch (error) {
      console.error('Failed to submit order:', error);
      alert('Failed to place order. Please try again.');
    }
  };

  useEffect(() => {
    if (shopId && shopSettings?.shopName) {
      document.title = shopSettings.shopName;
    } else if (!shopId && shops.length === 1) {
      document.title = shops[0].shopName || 'Fashion Platform';
    } else {
      document.title = 'Fashion Platform';
    }
  }, [shopId, shopSettings?.shopName, shops]);

  useEffect(() => {
    if (!shopId && shops.length === 1 && !loading && !inventoryLoading) {
      console.log('Storefront: Single shop detected, redirecting to:', shops[0].userId);
      navigate(`/shop/${shops[0].userId}`, { replace: true });
    }
  }, [shopId, shops, loading, inventoryLoading, navigate]);

  const openProductDetail = (product: any) => {
    setSelectedProduct(product);
    setModalSize(product.availableSizes.length === 1 ? product.availableSizes[0] : '');
  };

  if (loading || inventoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
          <p className="text-sm font-serif italic text-gray-500">Loading the collection...</p>
        </motion.div>
      </div>
    );
  }

  if (!shopId) {
    if (shops.length === 1) return null;

    return (
      <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900 selection:bg-black selection:text-white">
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center">
                  <Store className="h-5 w-5 text-white" />
                </div>
                <span className="text-2xl font-serif font-semibold tracking-tight text-black">Fashion Hub</span>
              </div>
              <Link to="/admin" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">
                Seller Portal
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-20"
          >
            <h1 className="text-6xl font-serif text-black mb-6 tracking-tight">Discover Curated Shops</h1>
            <p className="text-gray-500 max-w-2xl mx-auto font-light text-lg">
              Explore unique fashion pieces from independent local sellers.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {shops.length > 0 ? (
              shops.map((shop, idx) => (
                <motion.div
                  key={shop.userId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <Link 
                    to={`/shop/${shop.userId}`}
                    className="group block bg-white rounded-3xl p-10 shadow-sm hover:shadow-xl transition-all border border-gray-100 h-full"
                  >
                    <div className="h-20 w-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-8 group-hover:bg-black group-hover:rotate-6 transition-all duration-500">
                      <Store className="h-10 w-10 text-gray-400 group-hover:text-white transition-colors" />
                    </div>
                    <h2 className="text-2xl font-serif font-semibold text-gray-900 mb-4">
                      {shop.shopName || 'Untitled Shop'}
                    </h2>
                    <p className="text-gray-500 font-light leading-relaxed mb-8">
                      {shop.shopDescription || 'Welcome to my fashion store! Check out my latest collection.'}
                    </p>
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-black group-hover:gap-4 transition-all">
                      Visit Shop <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full text-center py-20">
                <Store className="h-16 w-16 text-gray-100 mx-auto mb-6" />
                <p className="text-gray-400 font-serif text-2xl italic">No shops have been set up yet.</p>
                <Link to="/admin" className="mt-6 inline-block text-sm font-bold uppercase tracking-widest text-black border-b border-black pb-1">
                  Go to Seller Portal to create your shop
                </Link>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-black selection:text-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="h-10 w-10 bg-black rounded-full flex items-center justify-center">
                <Store className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-serif font-semibold tracking-tight text-black">
                {shopSettings?.shopName || 'Fashion Platform'}
              </span>
            </Link>
            
            <div className="hidden md:flex items-center gap-8">
              <nav className="flex gap-6">
                <button onClick={() => setSelectedCategory('All')} className="text-sm font-medium text-gray-600 hover:text-black">Collection</button>
                <button className="text-sm font-medium text-gray-600 hover:text-black">About</button>
                <button className="text-sm font-medium text-gray-600 hover:text-black">Contact</button>
              </nav>
              <div className="h-4 w-[1px] bg-gray-200"></div>
              <Link to="/admin" className="text-sm font-medium text-gray-600 hover:text-black transition-colors">
                Seller Portal
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative h-[60vh] flex items-center justify-center overflow-hidden bg-gray-900">
          <div className="absolute inset-0 opacity-60">
            <img 
              src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=2000" 
              alt="Hero" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="relative z-10 text-center px-4">
            <motion.h1 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-5xl md:text-7xl font-serif text-white mb-6 tracking-tight"
            >
              {shopSettings?.shopName || 'The Collection'}
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-white/90 max-w-2xl mx-auto font-light text-lg md:text-xl mb-10"
            >
              {shopSettings?.shopDescription || 'Curated fashion pieces. Premium quality, available locally.'}
            </motion.p>
            <motion.button 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              onClick={() => document.getElementById('collection')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-white text-black px-10 py-4 text-xs font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-all duration-300"
            >
              Shop Now
            </motion.button>
          </div>
        </section>

        <div id="collection" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-16">
            {/* Category Filter */}
            <div className="flex flex-wrap gap-8">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`text-xs uppercase tracking-[0.2em] pb-2 border-b-2 transition-all duration-300 ${
                    selectedCategory === category
                      ? 'border-black text-black font-bold'
                      : 'border-transparent text-gray-400 hover:text-black'
                  }`}
                >
                  {category === 'All' ? 'All Pieces' : category}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search collection..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border-b border-gray-200 focus:border-black outline-none transition-colors bg-transparent"
                />
              </div>

              {/* Size Filter */}
              <div className="flex items-center gap-2 bg-gray-50 p-1 rounded-lg max-w-full overflow-x-auto scrollbar-none">
                {sizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-tighter rounded transition-all whitespace-nowrap ${
                      selectedSize === size
                        ? 'bg-white text-black shadow-sm'
                        : 'text-gray-400 hover:text-black'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <AnimatePresence mode="popLayout">
            {displayItems.length > 0 ? (
              <motion.div 
                layout
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16"
              >
                {displayItems.map((item, idx) => {
                  const isSoldOut = item.totalQuantity <= 0;
                  
                  return (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group cursor-pointer"
                      onClick={() => openProductDetail(item)}
                    >
                      {/* Image Container */}
                      <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 mb-6">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.itemName}
                            className={`h-full w-full object-cover object-center transition-transform duration-1000 group-hover:scale-110 ${isSoldOut ? 'opacity-60 grayscale' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-300">
                            <ShoppingBag className="h-12 w-12 opacity-20" />
                          </div>
                        )}
                        
                        {/* Quick View Overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-500 flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="bg-white text-black px-6 py-3 text-[10px] font-bold uppercase tracking-widest shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                            Quick View
                          </span>
                        </div>

                        {/* Sold Out Badge */}
                        {isSoldOut && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/30 backdrop-blur-[2px]">
                            <span className="bg-white px-6 py-2 text-xs font-bold uppercase tracking-widest text-black shadow-sm">
                              Sold Out
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Product Info */}
                      <div className="flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-sm font-serif text-black group-hover:underline underline-offset-4 decoration-gray-300">
                            {item.itemName}
                          </h3>
                          <p className="text-sm font-medium text-gray-900">{formatETB(item.sellingPriceETB)}</p>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-gray-400 uppercase tracking-widest">{item.category}</p>
                          {!isSoldOut && (
                            <div className="flex gap-1">
                              {item.availableSizes.slice(0, 3).map((s: string) => (
                                <span key={s} className="text-[9px] text-gray-400 border border-gray-200 px-1 rounded">{s}</span>
                              ))}
                              {item.availableSizes.length > 3 && <span className="text-[9px] text-gray-400">+{item.availableSizes.length - 3}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-40"
              >
                <ShoppingBag className="h-16 w-16 text-gray-100 mx-auto mb-6" />
                <p className="text-gray-400 font-serif text-2xl italic">No pieces found matching your criteria.</p>
                <button 
                  onClick={() => { setSelectedCategory('All'); setSelectedSize('All'); setSearchQuery(''); }}
                  className="mt-6 text-sm font-bold uppercase tracking-widest text-black border-b border-black pb-1"
                >
                  Clear all filters
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-8 w-8 bg-black rounded-full flex items-center justify-center">
                  <Store className="h-4 w-4 text-white" />
                </div>
                <span className="text-xl font-serif font-semibold tracking-tight text-black">
                  {shopSettings?.shopName || 'Fashion Platform'}
                </span>
              </div>
              <p className="text-gray-500 font-light max-w-sm mb-8">
                {shopSettings?.shopDescription || 'Curating the finest local fashion for the modern individual.'}
              </p>
              <div className="flex gap-4">
                <button className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-all">
                  <Instagram className="h-4 w-4" />
                </button>
                <button className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-all">
                  <Facebook className="h-4 w-4" />
                </button>
                <button className="h-10 w-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-all">
                  <Twitter className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-black mb-6">Customer Care</h4>
              <ul className="space-y-4">
                <li><button className="text-sm text-gray-500 hover:text-black transition-colors">Shipping Policy</button></li>
                <li><button className="text-sm text-gray-500 hover:text-black transition-colors">Returns & Exchanges</button></li>
                <li><button className="text-sm text-gray-500 hover:text-black transition-colors">Size Guide</button></li>
                <li><button className="text-sm text-gray-500 hover:text-black transition-colors">FAQs</button></li>
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-black mb-6">Contact Us</h4>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-sm text-gray-500">
                  <Phone className="h-4 w-4" />
                  +251 911 234 567
                </li>
                <li className="flex items-center gap-3 text-sm text-gray-500">
                  <Send className="h-4 w-4" />
                  {shopSettings?.telegramChatId || '@FashionSupport'}
                </li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-10 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-gray-400">© 2026 {shopSettings?.shopName || 'Fashion Platform'}. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/admin" className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-black">Seller Portal</Link>
              <button className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-black">Privacy Policy</button>
              <button className="text-[10px] uppercase tracking-widest text-gray-400 hover:text-black">Terms of Service</button>
            </div>
          </div>
        </div>
      </footer>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 z-10 h-10 w-10 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-black hover:text-white transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Modal Image */}
              <div className="w-full md:w-1/2 h-64 md:h-auto bg-gray-100 overflow-hidden">
                {selectedProduct.image ? (
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.itemName} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ShoppingBag className="h-20 w-20 opacity-10" />
                  </div>
                )}
              </div>

              {/* Modal Content */}
              <div className="w-full md:w-1/2 p-8 md:p-12 overflow-y-auto">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-gray-400 mb-4">{selectedProduct.category}</p>
                <h2 className="text-3xl md:text-4xl font-serif text-black mb-6 leading-tight">{selectedProduct.itemName}</h2>
                <p className="text-2xl font-medium text-black mb-8">{formatETB(selectedProduct.sellingPriceETB)}</p>
                
                <div className="space-y-8 mb-10">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4">Description</h4>
                    <p className="text-gray-500 font-light leading-relaxed">
                      This premium {selectedProduct.category.toLowerCase()} is a perfect addition to your wardrobe. 
                      Crafted with attention to detail and designed for both comfort and style.
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-black">Select Size</h4>
                      <button className="text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200">Size Guide</button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {selectedProduct.availableSizes.map((size: string) => (
                        <button
                          key={size}
                          onClick={() => setModalSize(size)}
                          className={`h-12 w-16 flex items-center justify-center text-xs font-bold border transition-all ${
                            modalSize === size
                              ? 'border-black bg-black text-white'
                              : 'border-gray-200 text-gray-600 hover:border-black'
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedProduct.sheinSku && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest">
                      <Info className="h-3 w-3" />
                      SKU: {selectedProduct.sheinSku}
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-100">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-black mb-4">Promo Code</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter code"
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value)}
                        className="flex-1 px-4 py-2 border border-gray-200 text-sm focus:border-black outline-none uppercase"
                      />
                      <button
                        onClick={handleApplyPromo}
                        className="px-6 py-2 bg-black text-white text-xs font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                    {promoError && <p className="text-red-500 text-xs mt-2">{promoError}</p>}
                    {appliedDiscount && (
                      <p className="text-green-600 text-xs mt-2 flex items-center gap-1">
                        <Tag className="h-3 w-3" />
                        Code applied: {appliedDiscount.code} (-{appliedDiscount.discountType === 'percentage' ? `${appliedDiscount.discountValue}%` : formatETB(appliedDiscount.discountValue)})
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {orderSuccess ? (
                    <div className="bg-emerald-50 text-emerald-700 p-4 rounded-lg flex items-center justify-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-medium">Order placed successfully!</span>
                    </div>
                  ) : isOrdering ? (
                    <div className="space-y-4 border-t border-gray-100 pt-4">
                      <h4 className="text-sm font-bold text-black">Contact Information</h4>
                      <div>
                        <input
                          type="text"
                          placeholder="Your Name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 text-sm focus:border-black outline-none mb-3"
                        />
                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 text-sm focus:border-black outline-none"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setIsOrdering(false)}
                          className="flex-1 py-4 text-xs font-bold uppercase tracking-widest border border-gray-200 text-gray-600 hover:border-black transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={submitOrder}
                          disabled={!customerName || !customerPhone}
                          className="flex-1 py-4 text-xs font-bold uppercase tracking-widest bg-black text-white hover:bg-gray-800 disabled:bg-gray-300 transition-colors"
                        >
                          Confirm Order
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOrder(selectedProduct)}
                      disabled={selectedProduct.totalQuantity <= 0}
                      className={`w-full flex items-center justify-center gap-3 py-5 text-xs font-bold uppercase tracking-[0.2em] transition-all ${
                        selectedProduct.totalQuantity <= 0
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-[#2AABEE] text-white hover:bg-[#229ED9] hover:shadow-xl transform hover:-translate-y-1'
                      }`}
                    >
                      <Send className="h-5 w-5" />
                      {selectedProduct.totalQuantity <= 0 ? 'Sold Out' : (shopSettings?.hasTelegramBot ? 'Place Order' : 'Order via Telegram')}
                    </button>
                  )}
                  <p className="text-[10px] text-center text-gray-400 uppercase tracking-widest">
                    Free local delivery on orders over 5,000 ETB
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
