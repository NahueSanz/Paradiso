import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClub } from '../context/ClubContext';
import * as api from '../api';
import type { Product } from '../api';
import ProductModal from '../components/ProductModal';

function fmtMoney(n: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
  }).format(n);
}

export default function StockPage() {
  const [searchParams] = useSearchParams();
  const { selectedClubId } = useClub();

  const highlightProductId = searchParams.get('productId') ? Number(searchParams.get('productId')) : null;

  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);

  const [productModal, setProductModal] = useState<{ open: boolean; product: Product | null }>({ open: false, product: null });

  function fetchProducts() {
    if (!selectedClubId) return;
    setLoading(true);
    setError('');
    api.getProducts(selectedClubId)
      .then(setProducts)
      .catch((e: any) => setError(e.message ?? 'Error al cargar los productos'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchProducts();
  }, [selectedClubId]);

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este producto?')) return;
    setDeleting(id);
    try {
      await api.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      setError(e.message ?? 'Error al eliminar el producto');
    } finally {
      setDeleting(null);
    }
  }

  const totalItems    = products.length;
  const totalValue    = products.reduce((s, p) => s + Number(p.salePrice) * Number(p.stock), 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock < 5).length;

  return (
    <div className="bg-background">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">Stock</h1>
          <p className="text-xs text-muted-foreground">Gestión de productos y stock</p>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto space-y-6">

        {!selectedClubId && (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <p className="text-lg font-semibold text-foreground">Seleccioná un club para ver el stock</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {selectedClubId && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">Productos</p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{loading ? '—' : totalItems}</p>
              </div>
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">Valor total del stock</p>
                <p className="text-2xl font-bold text-emerald-600">{loading ? '—' : fmtMoney(totalValue)}</p>
              </div>
              <div className="bg-card rounded-2xl shadow-sm border border-border p-5 flex flex-col gap-1">
                <p className="text-sm font-medium text-muted-foreground">Stock bajo (&lt;5 unidades)</p>
                <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                  {loading ? '—' : lowStockCount}
                </p>
              </div>
            </div>

            <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Productos</h2>
                <button
                  onClick={() => setProductModal({ open: true, product: null })}
                  disabled={!selectedClubId}
                  className="flex items-center gap-1.5 text-sm font-medium text-white bg-indigo-600
                             hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Agregar producto
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground uppercase tracking-wide bg-muted/50">
                      <th className="px-6 py-3 text-left font-medium">Nombre</th>
                      <th className="px-6 py-3 text-right font-medium">Precio venta</th>
                      <th className="px-6 py-3 text-right font-medium">Stock</th>
                      <th className="px-6 py-3 text-right font-medium">Precio compra</th>
                      <th className="px-6 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Cargando…</td>
                      </tr>
                    ) : products.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                          No hay productos. Agregá uno para comenzar.
                        </td>
                      </tr>
                    ) : (
                      products.map((p) => (
                        <tr key={p.id} className={`hover:bg-muted/50 transition-colors ${highlightProductId === p.id ? 'bg-violet-50 dark:bg-violet-900/20 ring-1 ring-inset ring-violet-200 dark:ring-violet-700' : ''}`}>
                          <td className="px-6 py-3 text-foreground">
                            <span>{p.name}</span>
                            {p.stock === 0 && (
                              <span className="ml-2 text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded-full">
                                Sin stock
                              </span>
                            )}
                            {p.stock > 0 && p.stock < 5 && (
                              <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
                                Stock bajo
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right text-foreground font-medium">
                            {fmtMoney(p.salePrice)}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <span className={`font-semibold ${
                              p.stock === 0
                                ? 'text-red-500'
                                : p.stock < 5
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-foreground'
                            }`}>
                              {p.stock}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-muted-foreground">
                            {fmtMoney(p.purchasePrice)}
                          </td>
                          <td className="px-6 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setProductModal({ open: true, product: p })}
                                className="text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50
                                           px-2.5 py-1 rounded-lg transition-colors"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                disabled={deleting === p.id}
                                className="text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30
                                           px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                              >
                                {deleting === p.id ? '…' : 'Eliminar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {productModal.open && (
        <ProductModal
          product={productModal.product}
          onClose={() => setProductModal({ open: false, product: null })}
          onSuccess={fetchProducts}
        />
      )}

    </div>
  );
}
