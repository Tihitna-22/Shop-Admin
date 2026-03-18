export type Category = 'Top' | 'Dress' | 'Trouser' | 'Bra';
export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | 'One Size';

export interface InventoryItem {
  id: string;
  userId: string;
  itemName: string;
  sheinSku: string;
  category: Category;
  size: Size;
  quantityStocked: number;
  buyingPriceUSD: number;
  exchangeRate: number; // USD to ETB
  shippingCostETB: number;
  customsTaxETB: number;
  localDeliveryFeeETB: number;
  totalCostPriceETB: number; // Calculated: (buyingPriceUSD * exchangeRate) + shippingCostETB + customsTaxETB + localDeliveryFeeETB
  sellingPriceETB: number;
  dateAdded: string;
  image?: string; // Base64 compressed image
  status?: 'in_stock' | 'ordered';
  customerName?: string;
  customerPhone?: string;
  customerTelegram?: string;
}

export interface Sale {
  id: string;
  userId: string;
  itemId: string;
  itemName: string; // Stored for historical record in case item is deleted
  sheinSku: string;
  category: Category;
  quantitySold: number;
  sellingPriceETB: number; // Price per item at time of sale
  totalCostPriceETB: number; // Cost per item at time of sale
  dateSold: string;
  status?: 'in_stock' | 'ordered';
  customerName?: string;
  customerPhone?: string;
  customerTelegram?: string;
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
  telegramBotToken?: string;
  telegramChatId?: string;
  autoPostToTelegram?: boolean;
}
