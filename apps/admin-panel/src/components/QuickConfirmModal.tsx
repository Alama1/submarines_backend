import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, X, AlertCircle, Package, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { formatGil } from '../lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import type { Order } from '@ff14/types';

interface QuickConfirmModalProps {
  onClose: () => void;
}

/** Full confirmation-code format: SUB-XXXX-XXXX-XXXX */
const FULL_CODE_RE = /^SUB-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export const QuickConfirmModal: React.FC<QuickConfirmModalProps> = ({ onClose }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<Order | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const reqIdRef = useRef(0);

  // Live preview: as soon as a complete code is entered (typed or pasted),
  // look the order up and show the parts that were ordered.
  useEffect(() => {
    const normalized = code.trim().toUpperCase();
    if (!FULL_CODE_RE.test(normalized)) {
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    setPreviewLoading(true);
    setPreviewError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await api.get(`/orders/lookup/${normalized}`);
        if (reqIdRef.current !== reqId) return;
        setPreview(res.data);
      } catch (err: any) {
        if (reqIdRef.current !== reqId) return;
        setPreview(null);
        setPreviewError(
          err.response?.status === 404
            ? 'No order found for this code.'
            : 'Failed to load order preview.'
        );
      } finally {
        if (reqIdRef.current === reqId) setPreviewLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [code]);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await api.post('/orders/confirm', { code: code.trim().toUpperCase() });
      setSuccess(`Order ${res.data.orderCode} for ${res.data.clientName} confirmed successfully!`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-orders'] });
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to confirm order. Check that code exists and is pending.');
    } finally {
      setLoading(false);
    }
  };

  const isPending = preview?.status === 'pending';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Confirm Customer Order</h3>
            <p className="text-xs text-slate-500">Activate pending order via shared code</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleConfirm} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Order Confirmation Code
            </label>
            <input
              type="text"
              placeholder="e.g. SUB-7K9P-2M4X-8QRT"
              maxLength={18}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              autoFocus
              className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-center tracking-widest text-lg placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Live order preview — shows the ordered parts as soon as the code is complete */}
          {previewLoading && !preview && (
            <div className="flex items-center justify-center gap-2 py-4 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading order details...
            </div>
          )}

          {!previewLoading && previewError && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{previewError}</span>
            </div>
          )}

          {preview && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="font-mono text-xs font-bold text-slate-700">{preview.orderCode}</span>
                  <span className="text-xs text-slate-500">for {preview.clientName}</span>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                  isPending
                    ? 'text-amber-600 bg-amber-50 border-amber-200'
                    : 'text-slate-500 bg-slate-100 border-slate-200'
                }`}>
                  {preview.status.replace('_', ' ')}
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                {(preview.items ?? []).map((item, idx) => (
                  <div key={idx} className="px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{item.partName}</p>
                      {item.buildName && (
                        <p className="text-[10px] text-slate-400 truncate">{item.buildName}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-600">
                        {item.quantity} × {formatGil(item.unitPrice)}
                      </p>
                      <p className="text-xs font-semibold text-slate-800">{formatGil(item.lineTotal)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {preview.discountAmt > 0 && (
                    <>
                      <span className="mr-2">Subtotal: {formatGil(preview.subtotal)}</span>
                      <span className="text-emerald-600">−{formatGil(preview.discountAmt)}</span>
                    </>
                  )}
                </span>
                <span className="text-sm font-bold text-slate-900">{formatGil(preview.total)}</span>
              </div>
            </div>
          )}

          {preview && !isPending && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>This order is already "{preview.status.replace('_', ' ')}" — only pending orders can be confirmed.</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? 'Confirming...' : 'Confirm Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
