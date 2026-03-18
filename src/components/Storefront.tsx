import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryItem } from '../types';
import { formatETB } from '../lib/formatters';
import { ShoppingBag, Send } from 'lucide-react';

export function Storefront() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSize, setSelectedSize] = useState<string>('All');

  useEffect(() => {
    const fetchItems = async () => {
      try {
        // Fetch all items, including sold out ones
        const q = query(collection(db, 'inventory'));
        const snapshot = await getDocs(q);
        const fetchedItems: InventoryItem[] = [];
        snapshot.forEach((doc) => {
          fetchedItems.push({ id: doc.id, ...doc.data() } as InventoryItem);
        });
        setItems(fetchedItems);
      } catch (error) {
        console.error('Error fetching inventory:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  const categories = ['All', 'Top', 'Dress', 'Trouser', 'Bra'];
  const sizes = ['All', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];

  const filteredItems = items.filter(item => {
    const isAvailable = !item.status || item.status === 'in_stock';
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSize = selectedSize === 'All' || item.size === selectedSize;
    return isAvailable && matchesCategory && matchesSize;
  });

  // Group items by SKU
  const groupedItems = filteredItems.reduce((acc, item) => {
    const key = item.sheinSku || item.itemName;
    if (!acc[key]) {
      acc[key] = {
        ...item,
        availableSizes: item.quantityStocked > 0 ? [item.size] : [],
        totalQuantity: item.quantityStocked
      };
    } else {
      if (item.quantityStocked > 0 && !acc[key].availableSizes.includes(item.size)) {
        acc[key].availableSizes.push(item.size);
      }
      acc[key].totalQuantity += item.quantityStocked;
      if (!acc[key].image && item.image) {
        acc[key].image = item.image;
      }
    }
    return acc;
  }, {} as Record<string, any>);

  const displayItems = Object.values(groupedItems);

  const handleOrder = (item: any) => {
    if (item.totalQuantity <= 0) return;
    
    const sizesText = item.availableSizes.length > 0 ? ` in size ${item.availableSizes.join(' or ')}` : '';
    const message = `Hi, I want to buy the ${item.itemName}${sizesText}. is it available?`;
    
    const telegramUsername = import.meta.env.VITE_TELEGRAM_USERNAME || 'YOUR_TELEGRAM_USERNAME';
    const telegramUrl = `https://t.me/${telegramUsername}?text=${encodeURIComponent(message)}`;
    window.open(telegramUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans text-gray-900 selection:bg-black selection:text-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Mira Fashion Logo" className="h-10 w-10 object-cover rounded-full" />
              <span className="text-2xl font-serif font-semibold tracking-tight text-black">Mira Fashion</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-serif text-black mb-4">
            The Collection
          </h1>
          <p className="text-gray-500 max-w-2xl mx-auto font-light">
            Curated fashion pieces direct from Mira Fashion. Premium quality, available locally.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col items-center gap-8 mb-16">
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-6">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`text-sm uppercase tracking-widest pb-1 border-b-2 transition-colors ${
                  selectedCategory === category
                    ? 'border-black text-black font-medium'
                    : 'border-transparent text-gray-400 hover:text-black'
                }`}
              >
                {category === 'All' ? 'All Pieces' : category + (category === 'Dress' ? 'es' : 's')}
              </button>
            ))}
          </div>

          {/* Size Filter */}
          <div className="flex flex-wrap justify-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest mr-3 self-center">Size:</span>
            {sizes.map(size => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`px-4 py-1.5 text-xs font-medium border transition-colors ${
                  selectedSize === size
                    ? 'border-black bg-black text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-900'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        {displayItems.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 sm:gap-x-6 lg:gap-x-8">
            {displayItems.map((item) => {
              const isSoldOut = item.totalQuantity <= 0;
              
              return (
                <div key={item.id} className="group flex flex-col">
                  {/* Image Container */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-gray-100 mb-5">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.itemName}
                        className={`h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105 ${isSoldOut ? 'opacity-60 grayscale' : ''}`}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-300">
                        <ShoppingBag className="h-12 w-12 opacity-20" />
                      </div>
                    )}
                    
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
                  <div className="flex flex-col flex-1">
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">{item.category}</p>
                    <h3 className="text-sm font-serif text-black line-clamp-2 mb-3 leading-snug">
                      {item.itemName}
                    </h3>
                    
                    <div className="mt-auto flex flex-col gap-4">
                      <div className="flex justify-between items-end">
                        <p className="text-base font-medium text-black">{formatETB(item.sellingPriceETB)}</p>
                        <p className="text-xs text-gray-500">
                          {isSoldOut ? (
                            <span className="font-medium text-red-500">Out of stock</span>
                          ) : (
                            <>Available: <span className="font-medium text-black">{item.availableSizes.join(', ')}</span></>
                          )}
                        </p>
                      </div>
                      
                      {/* Telegram Order Button */}
                      <button
                        onClick={() => handleOrder(item)}
                        disabled={isSoldOut}
                        className={`w-full flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                          isSoldOut 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-[#2AABEE] text-white hover:bg-[#229ED9] hover:shadow-md'
                        }`}
                      >
                        <Send className="h-4 w-4" />
                        {isSoldOut ? 'Sold Out' : 'Order on Telegram'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-32">
            <p className="text-gray-400 font-serif text-2xl italic">No pieces found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
}
