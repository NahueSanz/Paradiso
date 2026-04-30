import { useEffect, useState } from 'react';
import { useClub } from '../context/ClubContext';
import * as api from '../api';
import type { Product } from '../api';

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

interface ProductRowProps {
  product: Product;
  qty: number;
  onQtyChange: (productId: number, qty: number) => void;
}

function ProductRow({ product, qty, onQtyChange }: ProductRowProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-b border-border last:border-0 ${
      product.stock === 0 ? 'opacity-50' : ''
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-foreground text-sm">{product.name}</span>
          {product.stock === 0 && (
            <span className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">Sin stock</span>
          )}
          {product.stock > 0 && product.stock < 5 && (
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">Stock bajo</span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-muted-foreground">{fmtMoney(product.salePrice)} c/u</span>
          <span className="text-xs text-muted-foreground">Stock: {product.stock}</span>
        </div>
      </div>

      {qty > 0 && (
        <div className="text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg px-3 py-1.5 text-center font-medium">
          {fmtMoney(Number(product.salePrice) * qty)}
        </div>
      )}

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onQtyChange(product.id, Math.max(0, qty - 1))}
          disabled={qty <= 0 || product.stock === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-input text-muted-foreground
                     hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold"
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-foreground">{qty}</span>
        <button
          onClick={() => onQtyChange(product.id, Math.min(product.stock, qty + 1))}
          disabled={qty >= product.stock || product.stock === 0}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-input text-muted-foreground
                     hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SellPage() {
  const { selectedClubId } = useClub();
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [cart, setCart]             = useState<Record<number, number>>({});
  const [paymentMethod, setPayment] = useState<'cash' | 'mercadopago'>('cash');
  const [selling, setSelling]       = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  function fetchProducts() {
    if (!selectedClubId) return;
    setLoading(true);
    api.getProducts(selectedClubId)
      .then(setProducts)
      .catch((e: any) => setError(e.message ?? 'Error al cargar productos'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchProducts(); }, [selectedClubId]);

  function handleQtyChange(productId: number, qty: number) {
    setCart((prev) => {
      if (qty === 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: qty };
    });
  }

  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ productId: Number(id), quantity: qty }))
    .filter((item) => item.quantity > 0);

  const total = cartItems.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId);
    return sum + (product ? Number(product.salePrice) * item.quantity : 0);
  }, 0);

  async function handleSell() {
    if (cartItems.length === 0) return;
    setSelling(true);
    setError('');

    const errors: string[] = [];
    for (const item of cartItems) {
      try {
        await api.createSaleMovement({ ...item, paymentMethod });
      } catch (e: any) {
        const product = products.find((p) => p.id === item.productId);
        const label   = product?.name ?? `Producto ${item.productId}`;
        errors.push(`${label}: ${e.message ?? 'Error desconocido'}`);
      }
    }

    fetchProducts();

    if (errors.length) {
      setError(errors.join('\n'));
    } else {
      setCart({});
      setSuccessMsg('¡Venta registrada!');
      setTimeout(() => setSuccessMsg(''), 3000);
    }

    setSelling(false);
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Scrollable product list */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vender productos</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Seleccioná la cantidad de cada producto y presioná Vender</p>
          </div>

          {!selectedClubId && (
            <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
              <p className="text-lg font-semibold text-foreground">Seleccioná un club</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-xl px-4 py-3 text-sm font-medium">
              {successMsg}
            </div>
          )}

          {selectedClubId && (
            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              {loading ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">Cargando…</div>
              ) : products.length === 0 ? (
                <div className="px-6 py-8 text-center text-muted-foreground text-sm">
                  No hay productos. Agregá productos desde Stock.
                </div>
              ) : (
                products.map((p) => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    qty={cart[p.id] ?? 0}
                    onQtyChange={handleQtyChange}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Checkout bar — pinned at bottom via flex, no fixed positioning */}
      {selectedClubId && (
        <div className="shrink-0 bg-card border-t border-border shadow-lg px-6 py-4">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center gap-4">
            <div className="flex-1 text-center sm:text-left">
              <span className="text-xs text-muted-foreground uppercase tracking-wide">Total</span>
              <p className="text-2xl font-bold text-foreground">{fmtMoney(total)}</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-muted-foreground">Medio de pago:</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPayment(e.target.value as 'cash' | 'mercadopago')}
                className="border border-input bg-background text-foreground rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="cash">Efectivo</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
            <button
              onClick={handleSell}
              disabled={cartItems.length === 0 || selling}
              className="px-6 py-2.5 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white
                         rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selling ? 'Vendiendo…' : 'Vender productos'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
