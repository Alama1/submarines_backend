import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber, formatGil, sourceBadgeClass } from '../lib/utils';
import {
  Search,
  AlertTriangle,
  Wrench,
  Hammer,
  ChevronDown,
  ChevronUp,
  Layers,
  Coins,
  Wallet,
} from 'lucide-react';
import { NetWorthResponse } from '@ff14/types';
import { SubmarinePart } from '@ff14/types';
import { CraftClaimsPanel } from '../components/CraftClaimsPanel';

/**
 * Number input that keeps a local draft and commits the parsed value
 * when it loses focus (or Enter is pressed).
 */
const BlurInput: React.FC<{
  value: number;
  onCommit: (value: number) => void;
  className?: string;
  disabled?: boolean;
}> = ({ value, onCommit, className, disabled }) => {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed) && parsed >= 0 && parsed !== value) {
      onCommit(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <input
      type="number"
      min={0}
      disabled={disabled}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
};

const inlineInputClass =
  'w-20 px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-900 font-mono focus:outline-none focus:border-emerald-500';

const fullWidthInputClass =
  'w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-mono text-center focus:outline-none focus:border-emerald-500';

const PLANNER_STORAGE_KEY = 'inventory.showPlanner';

const readPlannerVisibility = (): boolean => {
  try {
    const stored = localStorage.getItem(PLANNER_STORAGE_KEY);
    return stored === null ? true : stored === 'true';
  } catch {
    return true;
  }
};

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [showPlanner, setShowPlanner] = useState<boolean>(readPlannerVisibility);

  const togglePlanner = () => {
    setShowPlanner((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(PLANNER_STORAGE_KEY, String(next));
      } catch {
        // storage unavailable — state still toggles for this session
      }
      return next;
    });
  };

  // Materials query
  const { data, isLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['inventory', search, onlyMissing],
    queryFn: async () => {
      const endpoint = onlyMissing ? '/inventory/missing' : '/inventory';
      const url = search ? `${endpoint}?search=${encodeURIComponent(search)}&limit=200` : `${endpoint}?limit=200`;
      return (await api.get(url)).data;
    },
  });

  // Repair/utility supplies (tracked separately, e.g. Magitek Repair Materials)
  const { data: repairData, isLoading: repairLoading } = useQuery<{ items: any[]; total: number }>({
    queryKey: ['inventory-repair', search],
    queryFn: async () => {
      const url = search
        ? `/inventory/repair?search=${encodeURIComponent(search)}&limit=100`
        : '/inventory/repair?limit=100';
      return (await api.get(url)).data;
    },
  });

  // Submarine parts for the Fleet Target Planner
  const { data: parts, isLoading: partsLoading } = useQuery<SubmarinePart[]>({
    queryKey: ['recipes'],
    queryFn: async () => (await api.get('/recipes')).data,
  });

  // Net worth of the current stock (universalis + custom prices)
  const { data: netWorth } = useQuery<NetWorthResponse>({
    queryKey: ['net-worth'],
    queryFn: async () => (await api.get('/inventory/net-worth')).data,
  });

  const partsList = Array.isArray(parts) ? parts : [];
  const totalTargetedParts = partsList.reduce((acc, p) => acc + (p.desiredStock || 0), 0);

  const updatePartTargetMutation = useMutation({
    mutationFn: ({ id, desiredStock }: { id: string; desiredStock: number }) =>
      api.put(`/recipes/${id}/target`, { desiredStock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    },
  });

  const recalculateTargetsMutation = useMutation({
    mutationFn: () => api.post('/recipes/recalculate-targets'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
      alert('All raw material targets recalculated from submarine part goals!');
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: ({ id, desiredQuantity }: { id: string; desiredQuantity: number }) =>
      api.put(`/inventory/${id}/target`, { desiredQuantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      api.put(`/inventory/${id}/stock`, { stock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
      queryClient.invalidateQueries({ queryKey: ['net-worth'] });
    },
  });

  const items = data?.items ?? [];
  const repairItems = repairData?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Inventory & Stock Control</h2>
          <p className="text-xs text-slate-500">
            Raw material stock targets are calculated automatically from your Submarine Crafting Goals.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex items-center justify-center gap-1.5 flex-shrink-0 ${
              onlyMissing
                ? 'bg-rose-50 border-rose-200 text-rose-700'
                : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Deficits Only</span>
          </button>
        </div>
      </div>

      {/* ── Net Worth (current stock valued at universalis + custom prices) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 flex-shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Net Worth @ Universalis
            </div>
            <div className="text-xl font-bold font-mono text-sky-700 truncate">
              {formatGil(netWorth?.marketNetWorth ?? 0)}
            </div>
            <p className="text-[11px] text-slate-500">
              Current stock valued at Universalis medium market prices.
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Net Worth @ My Prices
            </div>
            <div className="text-xl font-bold font-mono text-emerald-700 truncate">
              {formatGil(netWorth?.myNetWorth ?? 0)}
            </div>
            <p className="text-[11px] text-slate-500">
              Current stock valued at your custom prices (market/NPC as fallback).
              {(netWorth?.unpricedCount ?? 0) > 0 &&
                ` ${netWorth!.unpricedCount} materials have no price source yet.`}
            </p>
          </div>
        </div>
      </div>

      {/* ── Craft Claims (code-based requests from crafters) ── */}
      <CraftClaimsPanel />

      {/* ── Submarine Crafting Goals & Fleet Target Planner ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 flex-shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-slate-900 text-xs">Submarine Crafting Goals & Target Planner</h3>
                <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-[10px] font-semibold">
                  {totalTargetedParts} Total Parts Targeted
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Adjust desired quantities of submarine parts to automatically calculate all required raw materials.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => recalculateTargetsMutation.mutate()}
              disabled={recalculateTargetsMutation.isPending}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50 flex-1 sm:flex-none"
              title="Recalculate and update material targets"
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>{recalculateTargetsMutation.isPending ? 'Recalculating...' : 'Sync Material Targets'}</span>
            </button>
            <button
              onClick={togglePlanner}
              className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 transition"
              title="Toggle Planner"
            >
              {showPlanner ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showPlanner && (
          <div className="p-4 bg-slate-50/50">
            {partsLoading ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading submarine parts...</div>
            ) : partsList.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                No submarine parts configured yet. Go to <a href="/recipes" className="text-emerald-600 underline">Recipes</a> to add component blueprints.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {partsList.map((part) => (
                  <div
                    key={part.id}
                    className={`p-3 rounded-lg border bg-white transition ${
                      (part.desiredStock || 0) > 0
                        ? 'border-cyan-300 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-semibold text-slate-900 text-xs truncate max-w-[150px]" title={part.name}>
                          {part.name}
                        </div>
                        <div className="text-[10px] text-slate-400 uppercase font-mono">
                          {part.partType} • {part.className}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {part.stock} ready
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <span className="text-[11px] text-slate-500">Target Goal:</span>
                      <BlurInput
                        value={part.desiredStock ?? 0}
                        onCommit={(v) => updatePartTargetMutation.mutate({ id: part.id, desiredStock: v })}
                        className={`${inlineInputClass} text-center text-cyan-600 font-bold`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Inventory Table — desktop */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Material Name</th>
                <th className="px-5 py-3">FF14 Item ID</th>
                <th className="px-5 py-3">Current Stock</th>
                <th className="px-5 py-3">
                  <span>Desired Target</span>
                  <span className="text-[10px] text-cyan-600 font-normal lowercase block font-sans">(derived from parts)</span>
                </th>
                <th className="px-5 py-3">Deficit / Surplus</th>
                <th className="px-5 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    No materials found.
                  </td>
                </tr>
              ) : (
                items.map((mat) => {
                  const hasDeficit = mat.currentStock < mat.desiredQuantity;
                  const hasOrderDemand = (mat.orderMissing ?? 0) > 0;
                  const isNpc = mat.whereToBuy === 'NPC';

                  return (
                    <tr
                      key={mat.id}
                      className={`hover:bg-slate-50 transition ${
                        hasDeficit || hasOrderDemand ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {mat.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">
                        {mat.itemId || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {isNpc ? (
                          <span
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 font-semibold"
                            title="NPC-sourced — stock is always maxed out"
                          >
                            MAX
                          </span>
                        ) : (
                          <BlurInput
                            value={mat.currentStock}
                            onCommit={(v) => updateStockMutation.mutate({ id: mat.id, stock: v })}
                            className={`${inlineInputClass} ${
                              hasDeficit ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'
                            }`}
                          />
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <BlurInput
                          value={mat.desiredQuantity}
                          onCommit={(v) => updateTargetMutation.mutate({ id: mat.id, desiredQuantity: v })}
                          className={`${inlineInputClass} text-slate-700`}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {hasDeficit ? (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                              -{formatNumber(mat.desiredQuantity - mat.currentStock)}
                            </span>
                          ) : (
                            <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                              +OK
                            </span>
                          )}
                          {hasOrderDemand && (
                            <span
                              className="font-mono text-xs px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 font-semibold"
                              title="Shortfall for in-progress orders, after current stock"
                            >
                              +{formatNumber(mat.orderMissing)} orders
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                          {mat.whereToBuy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory — mobile cards */}
      <div className="md:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-200">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-slate-400 text-xs">Loading inventory...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-8 text-center text-slate-400 text-xs">No materials found.</div>
        ) : (
          items.map((mat) => {
            const hasDeficit = mat.currentStock < mat.desiredQuantity;
            const hasOrderDemand = (mat.orderMissing ?? 0) > 0;
            const isNpc = mat.whereToBuy === 'NPC';

            return (
              <div key={mat.id} className={`p-4 space-y-3 ${hasDeficit || hasOrderDemand ? 'bg-rose-50/50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 break-words">
                      {mat.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      ID: {mat.itemId || '—'}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      {hasDeficit ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                          -{formatNumber(mat.desiredQuantity - mat.currentStock)}
                        </span>
                      ) : (
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                          +OK
                        </span>
                      )}
                      {hasOrderDemand && (
                        <span
                          className="font-mono text-xs px-2 py-0.5 rounded bg-orange-50 border border-orange-200 text-orange-700 font-semibold"
                          title="Shortfall for in-progress orders, after current stock"
                        >
                          +{formatNumber(mat.orderMissing)} orders
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                      Current Stock
                    </span>
                    {isNpc ? (
                      <span
                        className="block w-full text-center font-mono text-[10px] px-2 py-1.5 rounded bg-violet-50 border border-violet-200 text-violet-700 font-semibold"
                        title="NPC-sourced — stock is always maxed out"
                      >
                        MAX
                      </span>
                    ) : (
                      <BlurInput
                        value={mat.currentStock}
                        onCommit={(v) => updateStockMutation.mutate({ id: mat.id, stock: v })}
                        className={`${fullWidthInputClass} ${
                          hasDeficit ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'
                        }`}
                      />
                    )}
                  </label>
                  <label className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-cyan-600 font-semibold block">
                      Desired Target
                    </span>
                    <BlurInput
                      value={mat.desiredQuantity}
                      onCommit={(v) => updateTargetMutation.mutate({ id: mat.id, desiredQuantity: v })}
                      className={`${fullWidthInputClass} text-slate-700`}
                    />
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                    {mat.whereToBuy}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Repair & Utility Materials (kept out of crafting inventory) ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Repair Materials</h3>
            <p className="text-[11px] text-slate-500">
              Utility supplies tracked separately from the crafting inventory (e.g. Magitek Repair Materials).
            </p>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Material Name</th>
                <th className="px-5 py-3">FF14 Item ID</th>
                <th className="px-5 py-3">Current Stock</th>
                <th className="px-5 py-3">Desired Target</th>
                <th className="px-5 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {repairLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    Loading repair materials...
                  </td>
                </tr>
              ) : repairItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No repair materials registered. Set a material's category to "Repair Supply" in the Recipes page to move it here.
                  </td>
                </tr>
              ) : (
                repairItems.map((mat) => {
                  const isNpc = mat.whereToBuy === 'NPC';

                  return (
                    <tr key={mat.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-3.5 font-medium text-slate-900">
                        {mat.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-400">
                        {mat.itemId || '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono">
                        {isNpc ? (
                          <span
                            className="font-mono text-[10px] px-2 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 font-semibold"
                            title="NPC-sourced — stock is always maxed out"
                          >
                            MAX
                          </span>
                        ) : (
                          <BlurInput
                            value={mat.currentStock}
                            onCommit={(v) => updateStockMutation.mutate({ id: mat.id, stock: v })}
                            className={`${inlineInputClass} text-emerald-600 font-bold`}
                          />
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <BlurInput
                          value={mat.desiredQuantity}
                          onCommit={(v) => updateTargetMutation.mutate({ id: mat.id, desiredQuantity: v })}
                          className={`${inlineInputClass} text-slate-700`}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                          {mat.whereToBuy}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Repair materials — mobile cards */}
        <div className="md:hidden divide-y divide-slate-200 border-t border-slate-200">
          {repairLoading ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              Loading repair materials...
            </div>
          ) : repairItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              No repair materials registered. Set a material's category to "Repair Supply" in the
              Recipes page to move it here.
            </div>
          ) : (
            repairItems.map((mat) => {
              const isNpc = mat.whereToBuy === 'NPC';

              return (
                <div key={mat.id} className="p-4 space-y-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 break-words">
                      {mat.name}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      ID: {mat.itemId || '—'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                        Current Stock
                      </span>
                      {isNpc ? (
                        <span
                          className="block w-full text-center font-mono text-[10px] px-2 py-1.5 rounded bg-violet-50 border border-violet-200 text-violet-700 font-semibold"
                          title="NPC-sourced — stock is always maxed out"
                        >
                          MAX
                        </span>
                      ) : (
                        <BlurInput
                          value={mat.currentStock}
                          onCommit={(v) => updateStockMutation.mutate({ id: mat.id, stock: v })}
                          className={`${fullWidthInputClass} text-emerald-600 font-bold`}
                        />
                      )}
                    </label>
                    <label className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                        Desired Target
                      </span>
                      <BlurInput
                        value={mat.desiredQuantity}
                        onCommit={(v) => updateTargetMutation.mutate({ id: mat.id, desiredQuantity: v })}
                        className={`${fullWidthInputClass} text-slate-700`}
                      />
                    </label>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                      {mat.whereToBuy}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
