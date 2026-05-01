import { useRef, useState } from 'react';
import * as api from '../api';
import type { CreateCashMovementPayload } from '../api';

const PAYMENT_METHODS = [
  'Efectivo',
  'Transferencia',
  'Tarjeta de débito',
  'MercadoPago',
];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddMovementModal({ onClose, onSuccess }: Props) {
  const [concept, setConcept]               = useState('');
  const [type, setType]                     = useState<'income' | 'expense'>('income');
  const [amount, setAmount]                 = useState('');
  const [paymentMethod, setPaymentMethod]   = useState(PAYMENT_METHODS[0]);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const conceptRef                          = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!concept.trim()) { setError('El concepto es requerido.'); return; }
    const parsedAmount = parseFloat(amount);
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload: CreateCashMovementPayload = {
        concept: concept.trim(),
        type,
        amount: parsedAmount,
        paymentMethod,
      };
      await api.createCashMovement(payload);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Error al guardar el movimiento.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h2 className="text-lg font-bold mb-5">Agregar movimiento</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Concept */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Concepto</label>
            <input
              ref={conceptRef}
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Ej: Powerade"
              className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'income' | 'expense')}
              className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-ring"
            >
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Monto</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1">Método de pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-input bg-background text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none
                         focus:ring-2 focus:ring-ring"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground
                         hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white font-medium
                         hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
