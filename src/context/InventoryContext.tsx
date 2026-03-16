import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { InventoryItem, Sale } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
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
  addItem: (item: Omit<InventoryItem, 'id' | 'userId' | 'dateAdded'>) => void;
  updateItem: (id: string, item: Partial<InventoryItem>) => void;
  deleteItem: (id: string) => void;
  markAsSold: (id: string, quantity: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
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

    return () => {
      unsubscribeInventory();
      unsubscribeSales();
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

  const deleteItem = async (id: string) => {
    if (!userId) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
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
    };

    try {
      await setDoc(doc(db, 'sales', saleId), newSale);
      const newQuantity = item.quantityStocked - quantity;
      await updateDoc(doc(db, 'inventory', id), { quantityStocked: newQuantity });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sales/${saleId}`);
    }
  };

  return (
    <InventoryContext.Provider
      value={{ inventory, sales, addItem, updateItem, deleteItem, markAsSold }}
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
