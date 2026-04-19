import { useState, useEffect } from 'react';
import * as api from '../api';
import type { Product, CreateProductPayload, UpdateProductPayload } from '../api';

interface ProductModalProps {
  product?: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductModal({ product, onClose, onSuccess }: ProductModalProps) {
  const isEditing = !!product;

  const [name,          setName]          = useState(product?.name ?? '');
  const [salePrice,     setSalePrice]     = useState(product ? String(product.salePrice) : '');
  const [purchasePrice, setPurchasePrice] = useState(product ? String(product.purchasePrice) : '');
  const [stock,         setStock]         = useState(product ? String(product.stock) : '');
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

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

    const salePriceNum     = parseFloat(salePrice);
    const purchasePriceNum = parseFloat(purchasePrice);
    const stockNum         = parseInt(stock, 10);

    if (!name.trim())                              { setError('El nombre es obligatorio'); return; }
    if (isNaN(salePriceNum) || salePriceNum < 0)   { setError('Ingresá un precio de venta válido'); return; }
    if (isNaN(purchasePriceNum) || purchasePriceNum < 0) { setError('Ingresá un precio de compra válido'); return; }
    if (isNaN(stockNum) || stockNum < 0)           { setError('Ingresá una cantidad válida'); return; }

    setSaving(true);
    try {
      if (isEditing && product) {
        const payload: UpdateProductPayload = {
          name: name.trim(),
          salePrice: salePriceNum,
          purchasePrice: purchasePriceNum,
          stock: stockNum,
        };
        await api.updateProduct(product.id, payload);
      } else {
        const payload: CreateProductPayload = {
          name: name.trim(),
          salePrice: salePriceNum,
          purchasePrice: purchasePriceNum,
          stock: stockNum,
        };
        await api.createProduct(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar el producto');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-app-surface rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-800 dark:text-app-text">
            {isEditing ? 'Editar producto' : 'Agregar producto'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-app-muted hover:text-gray-600 dark:hover:text-app-text p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-app-card transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-app-muted">Nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Pelota de pádel"
              className="border border-gray-300 dark:border-app-border dark:bg-app-card dark:text-app-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-app-muted">Precio de venta (por unidad)</label>
            <input
              type="number"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="border border-gray-300 dark:border-app-border dark:bg-app-card dark:text-app-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-app-muted">Precio de compra (costo total del stock)</label>
            <input
              type="number"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0"
              min="0"
              step="0.01"
              className="border border-gray-300 dark:border-app-border dark:bg-app-card dark:text-app-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-app-muted">Stock disponible</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className="border border-gray-300 dark:border-app-border dark:bg-app-card dark:text-app-text rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 dark:border-app-border rounded-lg py-2 text-sm text-gray-600 dark:text-app-muted hover:bg-gray-50 dark:hover:bg-app-card transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg py-2 text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
