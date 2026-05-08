export type StockStatus = 'normal' | 'low' | 'out';

export const LOW_STOCK_THRESHOLD = 5;

/**
 * Returns the canonical stock status for a product.
 *
 * 'out'    stock <= 0
 * 'low'    0 < stock < LOW_STOCK_THRESHOLD
 * 'normal' stock >= LOW_STOCK_THRESHOLD
 *
 * Using <= 0 instead of === 0 to handle any unexpected negative values
 * produced by concurrent writes before the backend guard runs.
 */
export function getStockStatus(stock: number): StockStatus {
  if (stock <= 0) return 'out';
  if (stock < LOW_STOCK_THRESHOLD) return 'low';
  return 'normal';
}

export function stockCountClass(stock: number): string {
  const s = getStockStatus(stock);
  if (s === 'out') return 'text-red-500';
  if (s === 'low') return 'text-amber-600 dark:text-amber-400';
  return 'text-foreground';
}
