import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber } from '../lib/utils';
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  Edit2,
  Save,
  X,
  Hammer,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { BaseMaterial, SubmarinePart } from '@ff14/types';

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showPlanner, setShowPlanner] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);

  // Materials query
  const { data, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['inventory', search, onlyMissing],
    queryFn: async () => {
      const endpoint = onlyMissing ? '/inventory/missing' : '/inventory';
      const url = search ? `${endpoint}?search=${encodeURIComponent(search)}&limit=200` : `${endpoint}?limit=200`;
      return (await api.get(url)).data;
    },
  });

  // Submarine parts for the Fleet Target Planner
  const { data: parts, isLoading: partsLoading } = useQuery<SubmarinePart[]>({
    queryKey: ['recipes'],
    queryFn: async () => (await api.get('/recipes')).data,
  });

  const partsList = Array.isArray(parts) ? parts : [];
  const totalTargetedParts = partsList.reduce((acc, p) => acc + (p.desiredStock || 0), 0);

  const updatePartTargetMutation = useMutation({
    mutationFn: ({ id, desiredStock }: { id: string; desiredStock: number }) =>
      api.put(`/recipes/${id}/target`, { desiredStock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
    },
  });

  const recalculateTargetsMutation = useMutation({
    mutationFn: () => api.post('/recipes/recalculate-targets'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      alert('All raw material targets recalculated from submarine part goals!');
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: ({ id, desiredQuantity }: { id: string; desiredQuantity: number }) =>
      api.put(`/inventory/${id}/target`, { desiredQuantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setEditingId(null);
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      api.put(`/inventory/${id}/stock`, { stock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setEditingId(null);
    },
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditTarget(item.desiredQuantity);
    setEditStock(item.currentStock);
  };

  const saveEdit = (id: string) => {
    updateTargetMutation.mutate({ id, desiredQuantity: editTarget });
    updateStockMutation.mutate({ id, stock: editStock });
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Inventory & Stock Control</h2>
          <p className="text-xs text-slate-400">
            Raw material stock targets are calculated automatically from your Submarine Crafting Goals.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 w-56"
            />
          </div>

          <button
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
              onlyMissing
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Deficits Only</span>
          </button>
        </div>
      </div>

      {/* ── Submarine Crafting Goals & Fleet Target Planner ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-xs">Submarine Crafting Goals & Target Planner</h3>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[10px] font-semibold">
                  {totalTargetedParts} Total Parts Targeted
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Adjust desired quantities of submarine parts to automatically calculate all required raw materials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => recalculateTargetsMutation.mutate()}
              disabled={recalculateTargetsMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
              title="Recalculate and update material targets"
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>{recalculateTargetsMutation.isPending ? 'Recalculating...' : 'Sync Material Targets'}</span>
            </button>
            <button
              onClick={() => setShowPlanner(!showPlanner)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
              title="Toggle Planner"
            >
              {showPlanner ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showPlanner && (
          <div className="p-4 bg-slate-900/60">
            {partsLoading ? (
              <div className="text-center py-4 text-xs text-slate-500">Loading submarine parts...</div>
            ) : partsList.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-500">
                No submarine parts configured yet. Go to <a href="/recipes" className="text-emerald-400 underline">Recipes</a> to add component blueprints.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {partsList.map((part) => (
                  <div
                    key={part.id}
                    className={`p-3 rounded-lg border transition ${
                      (part.desiredStock || 0) > 0
                        ? 'bg-slate-950 border-cyan-500/40 shadow-sm'
                        : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-white text-xs truncate max-w-[150px]" title={part.name}>
                          {part.name}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                          {part.partType} • {part.className}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        {part.stock} ready
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
                      <span className="text-[11px] text-slate-400">Target Goal:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            updatePartTargetMutation.mutate({
                              id: part.id,
                              desiredStock: Math.max(0, (part.desiredStock || 0) - 1),
                            })
                          }
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs"
                          title="Decrease Goal"
                        >
                          -
                        </button>
                        <span className="font-mono text-cyan-400 font-bold px-2 text-xs min-w-[24px] text-center">
                          {part.desiredStock ?? 0}
                        </span>
                        <button
                          onClick={() =>
                            updatePartTargetMutation.mutate({
                              id: part.id,
                              desiredStock: (part.desiredStock || 0) + 1,
                            })
                          }
                          className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs"
                          title="Increase Goal"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Material Name</th>
                <th className="px-5 py-3">FF14 Item ID</th>
                <th className="px-5 py-3">Current Stock</th>
                <th className="px-5 py-3">
                  <span>Desired Target</span>
                  <span className="text-[10px] text-cyan-400 font-normal lowercase block font-sans">(derived from parts)</span>
                </th>
                <th className="px-5 py-3">Deficit / Surplus</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No materials found.
                  </td>
                </tr>
              ) : (
                items.map((mat) => {
                  const isEditing = editingId === mat.id;
                  const hasDeficit = mat.currentStock < mat.desiredQuantity;

                  return (
                    <tr
                      key={mat.id}
                      className={`hover:bg-slate-800/40 transition ${
                        hasDeficit ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 font-medium text-white">
                        {mat.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">
                        {mat.itemId || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editStock}
                            onChange={(e) => setEditStock(parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                          />
                        ) : (
                          <span
                            className={
                              hasDeficit
                                ? 'text-rose-400 font-bold'
                                : 'text-emerald-400 font-bold'
                            }
                          >
                            {formatNumber(mat.currentStock)}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-300">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editTarget}
                            onChange={(e) => setEditTarget(parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                          />
                        ) : (
                          formatNumber(mat.desiredQuantity)
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {hasDeficit ? (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold">
                            -{formatNumber(mat.desiredQuantity - mat.currentStock)}
                          </span>
                        ) : (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            +OK
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-400">{mat.whereToBuy}</td>
                      <td className="px-5 py-3.5 text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => saveEdit(mat.id)}
                              className="p-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                              title="Save"
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEdit(mat)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                            title="Edit Stock/Target"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
