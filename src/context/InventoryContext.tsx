import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { InventoryItem, Sale, Expense, StoreSettings } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface InventoryContextType {
  inventory: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
  settings: StoreSettings | null;
  addItem: (item: Omit<InventoryItem, 'id' | 'userId' | 'dateAdded'>) => Promise<void>;
  updateItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  markAsSold: (id: string, quantity: number) => Promise<void>;
  updateItemStatus: (id: string, status: 'in_stock' | 'ordered') => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'userId' | 'date'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user ? user.uid : null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) {
      setInventory([]);
      setSales([]);
      setExpenses([]);
      setSettings(null);
      return;
    }

    const inventoryQuery = query(collection(db, 'inventory'), where('userId', '==', userId));
    const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    const salesQuery = query(collection(db, 'sales'), where('userId', '==', userId));
    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      const s: Sale[] = [];
      snapshot.forEach((doc) => {
        s.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setSales(s);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    const expensesQuery = query(collection(db, 'expenses'), where('userId', '==', userId));
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const e: Expense[] = [];
      snapshot.forEach((doc) => {
        e.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(e);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    const settingsDoc = doc(db, 'settings', userId);
    const unsubscribeSettings = onSnapshot(settingsDoc, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as StoreSettings);
      } else {
        setSettings({ userId });
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `settings/${userId}`);
    });

    return () => {
      unsubscribeInventory();
      unsubscribeSales();
      unsubscribeExpenses();
      unsubscribeSettings();
    };
  }, [userId]);

  const addItem = async (itemData: Omit<InventoryItem, 'id' | 'userId' | 'dateAdded'>) => {
    if (!userId) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newItem: InventoryItem = {
      ...itemData,
      id,
      userId,
      dateAdded: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'inventory', id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `inventory/${id}`);
    }
  };

  const updateItem = async (id: string, itemData: Partial<InventoryItem>) => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'inventory', id), itemData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const updateItemStatus = async (id: string, status: 'in_stock' | 'ordered') => {
    if (!userId) return;
    try {
      await updateDoc(doc(db, 'inventory', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const deleteItem = async (id: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      
      // Delete all related sales
      const salesQuery = query(collection(db, 'sales'), where('itemId', '==', id));
      const salesSnapshot = await getDocs(salesQuery);
      const deletePromises = salesSnapshot.docs.map(saleDoc => deleteDoc(saleDoc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const deleteSale = async (id: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sales/${id}`);
    }
  };

  const markAsSold = async (id: string, quantity: number) => {
    if (!userId) return;
    const item = inventory.find((i) => i.id === id);
    if (!item) return;

    if (item.quantityStocked < quantity) {
      console.error('Not enough stock!');
      return;
    }

    const saleId = Math.random().toString(36).substring(2, 9);
    const newSale: Sale = {
      id: saleId,
      userId,
      itemId: item.id,
      itemName: item.itemName,
      sheinSku: item.sheinSku,
      category: item.category,
      quantitySold: quantity,
      sellingPriceETB: item.sellingPriceETB,
      totalCostPriceETB: item.totalCostPriceETB,
      dateSold: new Date().toISOString(),
      status: item.status || 'in_stock',
      ...(item.customerName && { customerName: item.customerName }),
      ...(item.customerPhone && { customerPhone: item.customerPhone }),
      ...(item.customerTelegram && { customerTelegram: item.customerTelegram }),
    };

    try {
      await setDoc(doc(db, 'sales', saleId), newSale);
      const newQuantity = item.quantityStocked - quantity;
      await updateDoc(doc(db, 'inventory', id), { quantityStocked: newQuantity });

      // Post to Telegram if item is out of stock and it wasn't an ordered item
      if (newQuantity === 0 && item.status !== 'ordered' && settings?.telegramBotToken && settings?.telegramChatId) {
        try {
          const caption = `❌Sold out`;
          const tgFormData = new FormData();
          tgFormData.append('chat_id', settings.telegramChatId);
          tgFormData.append('caption', caption);

          if (item.image) {
            const res = await fetch(item.image);
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
          console.error('Failed to post sold out to Telegram:', tgError);
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sales/${saleId}`);
    }
  };

  const addExpense = async (expenseData: Omit<Expense, 'id' | 'userId' | 'date'>) => {
    if (!userId) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newExpense: Expense = {
      ...expenseData,
      id,
      userId,
      date: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'expenses', id), newExpense);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `expenses/${id}`);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'settings', userId), { ...settings, ...newSettings, userId }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `settings/${userId}`);
    }
  };

  return (
    <InventoryContext.Provider
      value={{ inventory, sales, expenses, settings, addItem, updateItem, deleteItem, deleteSale, markAsSold, updateItemStatus, addExpense, deleteExpense, updateSettings }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
}
