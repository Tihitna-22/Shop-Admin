export type Category = 'Top' | 'Dress' | 'Trouser' | 'Bra';
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'One Size';

export interface ProductVariant {
  size: Size;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  userId: string;
  itemName: string;
  sheinSku: string;
  category: Category;
  size: Size; // Default or primary size
  quantityStocked: number; // Total quantity across all variants
  variants?: ProductVariant[];
  buyingPriceUSD: number;
  exchangeRate: number; // USD to ETB
  shippingCostETB: number;
  customsTaxETB: number;
  localDeliveryFeeETB: number;
  totalCostPriceETB: number; // Calculated: (buyingPriceUSD * exchangeRate) + shippingCostETB + customsTaxETB + localDeliveryFeeETB
  sellingPriceETB: number;
  dateAdded: string;
  image?: string; // Base64 compressed image
  status?: 'in_stock' | 'ordered' | 'delivered';
  customerName?: string;
  customerPhone?: string;
  customerTelegram?: string;
  prePaymentETB?: number;
}

export interface Customer {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  telegram?: string;
  telegramChatId?: string;
  totalSpend: number;
  points: number;
  vipStatus: 'none' | 'bronze' | 'silver' | 'gold';
  createdAt: string;
  updatedAt: string;
}

export interface DiscountCode {
  id: string;
  userId: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  isActive: boolean;
  maxUses?: number;
  currentUses: number;
  createdAt: string;
  expiresAt?: string;
}

export interface Sale {
  id: string;
  userId: string;
  itemId: string;
  itemName: string; // Stored for historical record in case item is deleted
  sheinSku: string;
  category: Category;
  selectedSize?: Size;
  quantitySold: number;
  sellingPriceETB: number; // Price per item at time of sale
  totalCostPriceETB: number; // Cost per item at time of sale
  dateSold: string;
  status?: 'in_stock' | 'ordered' | 'delivered';
  customerName?: string;
  customerPhone?: string;
  customerTelegram?: string;
  prePaymentETB?: number;
  customerId?: string;
  discountCodeId?: string;
  discountAmountETB?: number;
  image?: string;
}

export type ExpenseCategory = 'Rent' | 'Internet' | 'Packaging' | 'Transport' | 'Other';

export interface Expense {
  id: string;
  userId: string;
  description: string;
  amountETB: number;
  date: string;
  category: ExpenseCategory;
}

export interface StoreSettings {
  userId: string;
  shopName?: string;
  shopDescription?: string;
  shopLogo?: string;
  shopBanner?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  personalTelegramChatId?: string;
  telegramUsername?: string;
  phoneNumber?: string;
  location?: string;
  autoPostToTelegram?: boolean;
  autoPostTemplate?: string;
}

export type UserRole = 'superadmin' | 'admin' | 'editor' | 'seller';

export interface UserProfile {
  uid: string;
  phone: string;
  role: UserRole;
  displayName?: string;
  businessId?: string; // ID of the business this user belongs to
  isFirstLogin?: boolean;
}

export interface Business {
  id: string;
  name: string;
  ownerUid: string; // UID of the admin who owns this business
  createdAt: string;
  isActive: boolean;
}
