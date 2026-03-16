export function formatETB(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculateTotalCost(
  buyingPriceUSD: number,
  exchangeRate: number,
  shippingCostETB: number,
  customsTaxETB: number,
  localDeliveryFeeETB: number
): number {
  return (buyingPriceUSD * exchangeRate) + shippingCostETB + customsTaxETB + localDeliveryFeeETB;
}
