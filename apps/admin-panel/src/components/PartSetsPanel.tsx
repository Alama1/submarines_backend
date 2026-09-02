import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatGil, formatNumber } from '../lib/utils';
import { Plus, Trash2, Edit2, Save, X, Package, TrendingUp, Loader2 } from 'lucide-react';
import { PartSetProfit } from '@ff14/types';

interface DraftItem {
  partId: string;
  quantity: number;
}

interface PartOption {
  id: string;
  name: string;
  price: number;
  partType: string;
  isModified: boolean;
}

const emptyDraft: DraftItem[] = [{ partId: '', quantity: 1 }];

export const PartSetsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>(emptyDraft);

  const { data: setData, isLoading } = useQuery<{ items: PartSetProfit[]; total: number }>({
    queryKey: ['part-sets'],
    queryFn: async () => (await api.get('/prices/sets')).data,
  });

  const { data: partsData } = useQuery<PartOption[] | { parts: PartOption[] }>({
    queryKey: ['recipes', 'for-sets'],
    queryFn: async () => (await api.get('/recipes')).data,
  });
  const parts: PartOption[] = Array.isArray(partsData)
    ? partsData
    : (partsData?.parts ?? []);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['part-sets'] });

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName('');
    setDraftItems(emptyDraft);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/prices/sets', {
        name,
        items: draftItems.filter((i) => i.partId),
      }),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      api.put(`/prices/sets/${editingId}`, {
        name,
        items: draftItems.filter((i) => i.partId),
      }),
    onSuccess: () => {
      invalidate();
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/prices/sets/${id}`),
    onSuccess: invalidate,
  });

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (set: PartSetProfit) => {
    setEditingId(set.id);
    setName(set.name);
    setDraftItems(
      set.items.map((i) => ({ partId: i.partId ?? '', quantity: i.quantity })),
    );
    setFormOpen(true);
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const sets = setData?.items ?? [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-slate-900 text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            Set Profitability
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Save recurring bundles (e.g. a full shark build) and track their profit.
            Always priced against the live market values below.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition"
        >
          <Plus className="w-3.5 h-3.5" />
          New Set
        </button>
      </div>

      {formOpen && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              {editingId ? 'Edit Set' : 'New Set'}
            </span>
            <button
              onClick={resetForm}
              className="p-1 rounded text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Set name (e.g. Full Shark Set)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
          />

          <div className="space-y-2">
            {draftItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={item.partId}
                  onChange={(e) => {
                    const next = [...draftItems];
                    next[idx] = { ...next[idx], partId: e.target.value };
                    setDraftItems(next);
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                >
                  <option value="">Select a part…</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatGil(p.price)})
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => {
                    const next = [...draftItems];
                    next[idx] = {
                      ...next[idx],
                      quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                    };
                    setDraftItems(next);
                  }}
                  className="w-20 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() =>
                    setDraftItems(draftItems.filter((_, i) => i !== idx))
                  }
                  disabled={draftItems.length === 1}
                  className="p-2 rounded-lg bg-white border border-slate-300 text-slate-400 hover:text-rose-600 hover:border-rose-200 disabled:opacity-30 disabled:hover:text-slate-400 disabled:hover:border-slate-300"
                  title="Remove part"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setDraftItems([...draftItems, { partId: '', quantity: 1 }])}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              Add part
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  editingId ? updateMutation.mutate() : createMutation.mutate()
                }
                disabled={!name.trim() || saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {editingId ? 'Save Changes' : 'Create Set'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          Loading sets...
        </div>
      ) : sets.length === 0 ? (
        <div className="text-center py-8 text-slate-400 space-y-1">
          <Package className="w-7 h-7 mx-auto text-slate-300" />
          <p className="text-sm">No sets saved yet.</p>
          <p className="text-xs text-slate-400">
            Create one to keep a persistent profitability indicator, e.g. a full
            shark build (hull + stern + bow + bridge).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {sets.map((set) => {
            const profitable = set.totalProfit >= 0;
            return (
              <div
                key={set.id}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-slate-300 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm">
                      {set.name}
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      {set.items.length} part line{set.items.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(set)}
                      className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition"
                      title="Edit set"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(set.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition"
                      title="Delete set"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {set.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="text-slate-700 font-medium truncate">
                        {item.partId ? (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 inline-block mr-1.5" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 inline-block mr-1.5" />
                        )}
                        {item.partName}
                        <span className="text-slate-400"> × {item.quantity}</span>
                      </span>
                      <span className="font-mono text-[11px] whitespace-nowrap flex items-center gap-2">
                        <span className="text-slate-500">
                          {formatGil(item.saleTotal)}
                        </span>
                        <span className="text-slate-400">−</span>
                        <span className="text-slate-500">
                          {formatGil(item.materialCostTotal)}
                        </span>
                        <span
                          className={`font-bold ${
                            item.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          = {formatGil(item.profit)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-200 pt-2.5 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 font-mono">
                    Sale {formatGil(set.totalSale)} · Cost{' '}
                    {formatGil(set.totalMaterialCost)} · Margin{' '}
                    {set.profitMarginPct}%
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded border ${
                      profitable
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                        : 'text-rose-700 bg-rose-50 border-rose-200'
                    }`}
                  >
                    {profitable ? '+' : ''}
                    {formatGil(set.totalProfit)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
