import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { InventoryItem, Sale, Expense, StoreSettings, Size, UserProfile, UserRole, Customer, DiscountCode, Business } from '../types';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';

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
  const errMessage = error instanceof Error ? error.message : String(error);
  
  // Ignore benign connection errors that are common in idle streams or network switches
  if (
    errMessage.includes('Disconnecting idle stream') || 
    errMessage.includes('CANCELLED') ||
    errMessage.includes('Timed out waiting for new targets')
  ) {
    console.warn(`Firestore ${operationType} warning (benign):`, errMessage, path ? `at ${path}` : '');
    return;
  }

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
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
  customers: Customer[];
  discountCodes: DiscountCode[];
  businesses: Business[];
  staff: UserProfile[];
  addItem: (item: Omit<InventoryItem, 'id' | 'userId' | 'dateAdded'>) => Promise<void>;
  updateItem: (id: string, item: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  markAsSold: (id: string, quantity: number, selectedSize?: Size, customerId?: string, discountCodeId?: string, discountAmountETB?: number) => Promise<void>;
  updateItemStatus: (id: string, status: 'in_stock' | 'ordered') => Promise<void>;
  addExpense: (expense: Omit<Expense, 'id' | 'userId' | 'date'>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'totalSpend' | 'points' | 'vipStatus'>) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  addDiscountCode: (code: Omit<DiscountCode, 'id' | 'userId' | 'createdAt' | 'currentUses'>) => Promise<void>;
  updateDiscountCode: (id: string, code: Partial<DiscountCode>) => Promise<void>;
  createBusiness: (name: string, adminEmail: string, adminName: string) => Promise<void>;
  createStaff: (email: string, name: string, role: 'editor' | 'seller') => Promise<void>;
  updateStaffRole: (uid: string, role: UserRole) => Promise<void>;
  deleteStaff: (uid: string) => Promise<void>;
  userProfile: UserProfile | null;
  switchRole: (role: UserRole) => void;
  userId: string | null;
  businessId: string | null;
  loading: boolean;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [staff, setStaff] = useState<UserProfile[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('InventoryContext: Auth state changed. User:', user?.uid || 'null');
      const currentUid = user ? user.uid : null;
      setUserId(currentUid);
      if (!user) {
        setUserProfile(null);
        setBusinessId(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(doc(db, 'users', userId), (docSnap) => {
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        setUserProfile(profile);
        setBusinessId(profile.businessId || null);
        setLoading(false);
      } else {
        // Check for placeholder profile by email
        const userEmail = auth.currentUser?.email;
        if (userEmail) {
          const staffId = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
          getDocs(query(collection(db, 'users'), where('email', '==', userEmail))).then((querySnap) => {
            if (!querySnap.empty) {
              const placeholderDoc = querySnap.docs[0];
              const placeholderData = placeholderDoc.data() as UserProfile;
              
              const finalProfile: UserProfile = {
                ...placeholderData,
                uid: userId, // Use real UID now
              };
              
              setUserProfile(finalProfile);
              setBusinessId(finalProfile.businessId || null);
              
              // Save real profile and delete placeholder
              setDoc(doc(db, 'users', userId), finalProfile).then(() => {
                if (placeholderDoc.id !== userId) {
                  deleteDoc(doc(db, 'users', placeholderDoc.id));
                }
              });
              setLoading(false);
            } else {
              // Check if this is the first user (default admin)
              const isDefaultAdmin = userEmail === "tihitna222sisay@gmail.com";
              const defaultProfile: UserProfile = {
                uid: userId,
                phone: userEmail.split('@')[0],
                role: isDefaultAdmin ? 'superadmin' : 'admin',
                displayName: auth.currentUser?.displayName || '',
                isFirstLogin: false
              };
              if (!isDefaultAdmin) {
                defaultProfile.businessId = userId;
              }
              
              setUserProfile(defaultProfile);
              setBusinessId(defaultProfile.businessId || null);
              setDoc(doc(db, 'users', userId), defaultProfile, { merge: true });
              setLoading(false);
            }
          }).catch((error) => {
            handleFirestoreError(error, OperationType.LIST, 'users');
            setLoading(false);
          });
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const switchRole = (role: UserRole) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, role });
    }
  };

  useEffect(() => {
    // If superadmin, fetch all businesses
    if (userProfile?.role === 'superadmin') {
      const unsubscribe = onSnapshot(collection(db, 'businesses'), (snapshot) => {
        const b: Business[] = [];
        snapshot.forEach((doc) => b.push({ id: doc.id, ...doc.data() } as Business));
        setBusinesses(b);
      });
      return () => unsubscribe();
    }
  }, [userProfile?.role]);

  useEffect(() => {
    // If admin, fetch staff for this business
    if (userProfile?.role === 'admin' && businessId) {
      const q = query(collection(db, 'users'), where('businessId', '==', businessId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const s: UserProfile[] = [];
        snapshot.forEach((doc) => s.push({ uid: doc.id, ...doc.data() } as UserProfile));
        setStaff(s.filter(u => u.uid !== userId)); // Don't include self in staff list
      });
      return () => unsubscribe();
    }
  }, [userProfile?.role, businessId, userId]);

  useEffect(() => {
    if (!businessId && userProfile?.role !== 'superadmin') {
      setInventory([]);
      setSales([]);
      setExpenses([]);
      setSettings(null);
      return;
    }

    // Data isolation based on businessId
    const filterId = businessId || userId; // Fallback to userId for safety if businessId not set
    if (!filterId && userProfile?.role !== 'superadmin') return;

    const inventoryQuery = userProfile?.role === 'superadmin'
      ? query(collection(db, 'inventory'))
      : query(collection(db, 'inventory'), where('userId', '==', filterId));
      
    const unsubscribeInventory = onSnapshot(inventoryQuery, (snapshot) => {
      const items: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory');
    });

    const salesQuery = userProfile?.role === 'superadmin'
      ? query(collection(db, 'sales'))
      : query(collection(db, 'sales'), where('userId', '==', filterId));
      
    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      const s: Sale[] = [];
      snapshot.forEach((doc) => {
        s.push({ id: doc.id, ...doc.data() } as Sale);
      });
      setSales(s);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    const expensesQuery = userProfile?.role === 'superadmin'
      ? query(collection(db, 'expenses'))
      : query(collection(db, 'expenses'), where('userId', '==', filterId));
      
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const e: Expense[] = [];
      snapshot.forEach((doc) => {
        e.push({ id: doc.id, ...doc.data() } as Expense);
      });
      setExpenses(e);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });

    const settingsRef = userProfile?.role === 'superadmin'
      ? collection(db, 'settings')
      : doc(db, 'settings', filterId!);

    let unsubscribeSettings: () => void;
    
    if (userProfile?.role === 'superadmin') {
      unsubscribeSettings = onSnapshot(query(settingsRef as any), (snapshot) => {
        if (!snapshot.empty) {
          setSettings(snapshot.docs[0].data() as StoreSettings);
        }
      });
    } else {
      unsubscribeSettings = onSnapshot(settingsRef as any, (docSnap: any) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as StoreSettings);
        } else {
          setSettings({ userId: filterId! });
        }
      }, (error: any) => {
        handleFirestoreError(error, OperationType.GET, `settings/${filterId}`);
      });
    }

    const customersQuery = userProfile?.role === 'superadmin'
      ? query(collection(db, 'customers'))
      : query(collection(db, 'customers'), where('userId', '==', filterId));
      
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const c: Customer[] = [];
      snapshot.forEach((doc) => {
        c.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(c);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    const discountCodesQuery = userProfile?.role === 'superadmin'
      ? query(collection(db, 'discount_codes'))
      : query(collection(db, 'discount_codes'), where('userId', '==', filterId));
      
    const unsubscribeDiscountCodes = onSnapshot(discountCodesQuery, (snapshot) => {
      const dc: DiscountCode[] = [];
      snapshot.forEach((doc) => {
        dc.push({ id: doc.id, ...doc.data() } as DiscountCode);
      });
      setDiscountCodes(dc);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'discount_codes');
    });

    return () => {
      unsubscribeInventory();
      unsubscribeSales();
      unsubscribeExpenses();
      unsubscribeSettings();
      unsubscribeCustomers();
      unsubscribeDiscountCodes();
    };
  }, [userId, businessId, userProfile?.role]);

  const createBusiness = async (name: string, adminPhone: string, adminName: string) => {
    if (userProfile?.role !== 'superadmin') return;
    
    const bId = Math.random().toString(36).substring(2, 9);
    const newBusiness: Business = {
      id: bId,
      name,
      ownerUid: '', // Will be updated when admin logs in
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    const newAdmin: UserProfile = {
      uid: `pending_admin_${bId}`,
      phone: adminPhone,
      displayName: adminName,
      role: 'admin',
      businessId: bId
    };
    
    try {
      await setDoc(doc(db, 'businesses', bId), newBusiness);
      const adminId = adminPhone.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'users', adminId), newAdmin);
      console.log(`Business ${name} created. Admin ${adminPhone} should sign up.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `businesses/${bId}`);
    }
  };

  const createStaff = async (phone: string, name: string, role: 'editor' | 'seller', password: string) => {
    if (userProfile?.role !== 'admin' || !businessId) return;
    
    try {
      // Create Auth user with fake email
      const fakeEmail = `${phone.replace(/[^a-zA-Z0-9]/g, '')}@myapp.com`;
      const userCredential = await createUserWithEmailAndPassword(auth, fakeEmail, password);
      
      const newStaff: UserProfile = {
        uid: userCredential.user.uid,
        phone,
        displayName: name,
        role,
        businessId,
        isFirstLogin: true
      };
      
      await setDoc(doc(db, 'users', userCredential.user.uid), newStaff);
      console.log(`Staff ${name} (${role}) created. They should sign in with ${phone}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${phone}`);
    }
  };

  const updateStaffRole = async (uid: string, role: UserRole) => {
    if (userProfile?.role !== 'admin') return;
    try {
      await updateDoc(doc(db, 'users', uid), { role });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const deleteStaff = async (uid: string) => {
    if (userProfile?.role !== 'admin') return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  const addItem = async (itemData: Omit<InventoryItem, 'id' | 'userId' | 'dateAdded'>) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newItem: InventoryItem = {
      ...itemData,
      id,
      userId: filterId,
      dateAdded: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'inventory', id), newItem);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `inventory/${id}`);
    }
  };

  const updateItem = async (id: string, itemData: Partial<InventoryItem>) => {
    if (!userId && !businessId) return;
    try {
      await updateDoc(doc(db, 'inventory', id), itemData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const updateItemStatus = async (id: string, status: 'in_stock' | 'ordered') => {
    if (!userId && !businessId) return;
    try {
      await updateDoc(doc(db, 'inventory', id), { status });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `inventory/${id}`);
    }
  };

  const deleteItem = async (id: string) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      
      // Delete all related sales
      const salesQuery = query(collection(db, 'sales'), where('itemId', '==', id), where('userId', '==', filterId));
      const salesSnapshot = await getDocs(salesQuery);
      const deletePromises = salesSnapshot.docs.map(saleDoc => deleteDoc(saleDoc.ref));
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory/${id}`);
    }
  };

  const deleteSale = async (id: string) => {
    if (!userId && !businessId) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `sales/${id}`);
    }
  };

  const markAsSold = async (id: string, quantity: number, selectedSize?: any, customerId?: string, discountCodeId?: string, discountAmountETB?: number) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    const item = inventory.find((i) => i.id === id);
    if (!item) return;

    const isOrder = item.status === 'ordered';
    const numQuantity = Number(quantity) || 1;
    
    // Check stock for specific variant if applicable
    if (!isOrder && item.variants && selectedSize) {
      const variant = item.variants.find(v => v.size === selectedSize);
      if (!variant || variant.quantity < numQuantity) {
        console.error('Not enough stock for this size!');
        return;
      }
    } else if (!isOrder && Number(item.quantityStocked) < numQuantity) {
      console.error('Not enough stock!');
      return;
    }

    const saleId = Math.random().toString(36).substring(2, 9);
    const newSale: Sale = {
      id: saleId,
      userId: filterId,
      itemId: item.id,
      itemName: item.itemName || 'Unknown Item',
      sheinSku: item.sheinSku || 'UNKNOWN',
      category: item.category || 'Top',
      selectedSize: selectedSize || item.size,
      quantitySold: numQuantity,
      sellingPriceETB: Number(item.sellingPriceETB) || 0,
      totalCostPriceETB: Number(item.totalCostPriceETB) || 0,
      dateSold: new Date().toISOString(),
      status: isOrder ? 'delivered' : 'in_stock',
      ...(item.customerName && { customerName: item.customerName }),
      ...(item.customerPhone && { customerPhone: item.customerPhone }),
      ...(item.customerTelegram && { customerTelegram: item.customerTelegram }),
      ...(item.prePaymentETB && { prePaymentETB: Number(item.prePaymentETB) || 0 }),
      ...(customerId && { customerId }),
      ...(discountCodeId && { discountCodeId }),
      ...(discountAmountETB && { discountAmountETB }),
      ...(item.image && { image: item.image }),
    };

    try {
      await setDoc(doc(db, 'sales', saleId), newSale);
      
      let updateData: any = {};
      
      if (item.variants && selectedSize) {
        const newVariants = item.variants.map(v => 
          v.size === selectedSize ? { ...v, quantity: Math.max(0, v.quantity - numQuantity) } : v
        );
        const newTotalQuantity = newVariants.reduce((sum, v) => sum + v.quantity, 0);
        updateData = { variants: newVariants, quantityStocked: newTotalQuantity };
      } else {
        const newQuantity = Math.max(0, Number(item.quantityStocked) - numQuantity);
        updateData = { quantityStocked: newQuantity };
      }

      const finalQuantity = updateData.quantityStocked;
      
      if (isOrder && finalQuantity === 0) {
        await deleteDoc(doc(db, 'inventory', id));
      } else {
        await updateDoc(doc(db, 'inventory', id), updateData);
      }

      // Update customer if provided
      if (customerId) {
        const customer = customers.find(c => c.id === customerId);
        if (customer) {
          const spendAmount = (newSale.sellingPriceETB * newSale.quantitySold) - (newSale.discountAmountETB || 0);
          const newTotalSpend = customer.totalSpend + spendAmount;
          // Simple points logic: 1 point per 100 ETB spent
          const newPoints = customer.points + Math.floor(spendAmount / 100);
          
          let newVipStatus = customer.vipStatus;
          if (newTotalSpend >= 10000) newVipStatus = 'gold';
          else if (newTotalSpend >= 5000) newVipStatus = 'silver';
          else if (newTotalSpend >= 2000) newVipStatus = 'bronze';

          await updateDoc(doc(db, 'customers', customerId), {
            totalSpend: newTotalSpend,
            points: newPoints,
            vipStatus: newVipStatus,
            updatedAt: new Date().toISOString()
          });
        }
      }

      // Update discount code if provided
      if (discountCodeId) {
        const discountCode = discountCodes.find(d => d.id === discountCodeId);
        if (discountCode) {
          await updateDoc(doc(db, 'discount_codes', discountCodeId), {
            currentUses: discountCode.currentUses + 1
          });
        }
      }

      // Post to Telegram if item is out of stock and it wasn't an ordered item
      if (finalQuantity === 0 && !isOrder && settings?.telegramBotToken && settings?.telegramChatId) {
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

  const addCustomer = async (customerData: Omit<Customer, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'totalSpend' | 'points' | 'vipStatus'>) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newCustomer: Customer = {
      ...customerData,
      id,
      userId: filterId,
      totalSpend: 0,
      points: 0,
      vipStatus: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'customers', id), newCustomer);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${id}`);
    }
  };

  const updateCustomer = async (id: string, customerData: Partial<Customer>) => {
    if (!userId && !businessId) return;
    try {
      await updateDoc(doc(db, 'customers', id), {
        ...customerData,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/${id}`);
    }
  };

  const addDiscountCode = async (codeData: Omit<DiscountCode, 'id' | 'userId' | 'createdAt' | 'currentUses'>) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newCode: DiscountCode = {
      ...codeData,
      id,
      userId: filterId,
      currentUses: 0,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'discount_codes', id), newCode);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `discount_codes/${id}`);
    }
  };

  const updateDiscountCode = async (id: string, codeData: Partial<DiscountCode>) => {
    if (!userId && !businessId) return;
    try {
      await updateDoc(doc(db, 'discount_codes', id), codeData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `discount_codes/${id}`);
    }
  };

  const addExpense = async (expenseData: Omit<Expense, 'id' | 'userId' | 'date'>) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    const id = Math.random().toString(36).substring(2, 9);
    const newExpense: Expense = {
      ...expenseData,
      id,
      userId: filterId,
      date: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'expenses', id), newExpense);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `expenses/${id}`);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!userId && !businessId) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const updateSettings = async (newSettings: Partial<StoreSettings>) => {
    const filterId = businessId || userId;
    if (!filterId) return;
    try {
      await setDoc(doc(db, 'settings', filterId), { ...settings, ...newSettings, userId: filterId }, { merge: true });
      
      const publicProfile = {
        userId: filterId,
        shopName: newSettings.shopName !== undefined ? newSettings.shopName : (settings?.shopName || ''),
        shopDescription: newSettings.shopDescription !== undefined ? newSettings.shopDescription : (settings?.shopDescription || ''),
        shopLogo: newSettings.shopLogo !== undefined ? newSettings.shopLogo : (settings?.shopLogo || ''),
        shopBanner: newSettings.shopBanner !== undefined ? newSettings.shopBanner : (settings?.shopBanner || ''),
        telegramUsername: newSettings.telegramUsername !== undefined ? newSettings.telegramUsername : (settings?.telegramUsername || ''),
        phoneNumber: newSettings.phoneNumber !== undefined ? newSettings.phoneNumber : (settings?.phoneNumber || ''),
        location: newSettings.location !== undefined ? newSettings.location : (settings?.location || ''),
        hasTelegramBot: !!(newSettings.telegramBotToken !== undefined ? newSettings.telegramBotToken : settings?.telegramBotToken),
        updatedAt: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'public_profiles', filterId), publicProfile, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `settings/${filterId}`);
    }
  };

  return (
    <InventoryContext.Provider
      value={{ 
        inventory, 
        sales, 
        expenses, 
        settings, 
        addItem, 
        updateItem, 
        deleteItem, 
        deleteSale, 
        markAsSold, 
        updateItemStatus, 
        addExpense, 
        deleteExpense, 
        updateSettings,
        userProfile,
        switchRole,
        userId,
        businessId,
        loading,
        customers,
        discountCodes,
        businesses,
        staff,
        addCustomer,
        updateCustomer,
        addDiscountCode,
        updateDiscountCode,
        createBusiness,
        createStaff,
        updateStaffRole,
        deleteStaff,
      }}
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
