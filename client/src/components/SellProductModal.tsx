import { useState, useEffect } from 'react';
import * as api from '../api';
import type { Product, SellProductPayload } from '../api';

interface SellProductModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

const PAYMENT_METHODS: { value: SellProductPayload['paymentMethod']; label: string }[] = [
  { value: 'cash',     label: 'Efectivo' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'card',     label: 'Tarjeta' },
];

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

export default function SellProductModal({ product, onClose, onSuccess }: SellProductModalProps) {
  const [quantity,      setQuantity]      = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<SellProductPayload['paymentMethod']>('cash');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  const qtyNum = parseInt(quantity, 10);
  const price  = Number(product.salePrice);
  const total  = !isNaN(qtyNum) && qtyNum > 0 ? price * qtyNum : 0;
  console.log({ price, qtyNum, subtotal: price * qtyNum });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (isNaN(qtyNum) || qtyNum <= 0) {
      setError('La cantidad debe ser mayor a 0');
      return;
    }
    if (qtyNum > product.stock) {
      setError(`Stock insuficiente. Disponible: ${product.stock}`);
      return;
    }

    setSaving(true);
    try {
      await api.sellProduct({ productId: product.id, quantity: qtyNum, paymentMethod });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al registrar la venta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold">Vender producto</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Product info */}
        <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-indigo-500 dark:text-indigo-400 font-medium mb-0.5">Producto</p>
          <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-200">{product.name}</p>
          <div className="flex items-center gap-4 mt-1">
            <span className="text-xs text-indigo-600 dark:text-indigo-300">{fmtMoney(product.salePrice)} / unidad</span>
            <span className="text-xs text-indigo-600 dark:text-indigo-300">Stock: {product.stock}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Cantidad a vender</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              min="1"
              max={product.stock}
              step="1"
              className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Método de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as SellProductPayload['paymentMethod'])}
              className="border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Total preview */}
          {total > 0 && (
            <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-3 border border-border">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{fmtMoney(total)}</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border rounded-lg py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Registrando…' : 'Confirmar venta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
