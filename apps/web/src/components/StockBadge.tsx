import { getStockStatus } from '../lib/stockStatus';

interface StockBadgeProps {
  stock: number;
}

export default function StockBadge({ stock }: StockBadgeProps) {
  const status = getStockStatus(stock);
  if (status === 'normal') return null;

  if (status === 'out') {
    return (
      <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
        Sin stock
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
      Stock bajo
    </span>
  );
}
