import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatNumber, sourceBadgeClass } from '../lib/utils';
import {
  Search,
  AlertTriangle,
  Wrench,
  Hammer,
  ChevronDown,
  ChevronUp,
  Layers,
  UserPlus,
  Users,
  X,
  Plus,
  Trash2,
} from 'lucide-react';
import { MaterialClaimsResponse } from '@ff14/types';
import { SubmarinePart } from '@ff14/types';

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

interface ClaimsModalProps {
  materialId: string;
  materialName: string;
  onClose: () => void;
}

/** Manage who claimed which portion of a missing material */
const ClaimsModal: React.FC<ClaimsModalProps> = ({ materialId, materialName, onClose }) => {
  const queryClient = useQueryClient();
  const [person, setPerson] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');

  const { data, isLoading } = useQuery<MaterialClaimsResponse>({
    queryKey: ['claims', materialId],
    queryFn: async () => (await api.get(`/inventory/${materialId}/claims`)).data,
  });

  const createClaimMutation = useMutation({
    mutationFn: (payload: { claimedFor: string; quantity: number }) =>
      api.post(`/inventory/${materialId}/claims`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims', materialId] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setPerson('');
      setQuantity('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to add claim.');
    },
  });

  const deleteClaimMutation = useMutation({
    mutationFn: (claimId: string) => api.delete(`/inventory/claims/${claimId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['claims', materialId] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to remove claim.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!person.trim() || quantity === '' || Number(quantity) < 1) return;
    createClaimMutation.mutate({ claimedFor: person.trim(), quantity: Number(quantity) });
  };

  const deficit = data?.deficit ?? 0;
  const remaining = data?.remaining ?? 0;
  const fullyCovered = deficit > 0 && remaining === 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{materialName}</h3>
              <p className="text-xs text-slate-500">Claims — who is delivering what</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-4 text-center">
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Needed</div>
              <div className="text-sm font-bold text-slate-900 font-mono">
                {formatNumber(data?.deficit ?? 0)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Claimed</div>
              <div className="text-sm font-bold text-cyan-600 font-mono">
                {formatNumber(data?.totalClaimed ?? 0)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Remaining</div>
              <div className={`text-sm font-bold font-mono ${fullyCovered ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatNumber(remaining)}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-slate-400">Target</div>
              <div className="text-sm font-bold text-slate-900 font-mono">
                {formatNumber(data?.material.desiredQuantity ?? 0)}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Existing claims */}
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-6 text-xs text-slate-400">Loading claims...</div>
            ) : (data?.claims.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400">
                No claims yet. Add the first person below.
              </div>
            ) : (
              data!.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-xs font-semibold text-slate-800">{claim.claimedFor}</span>
                    <span className="text-[11px] text-slate-400 ml-2">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-600 bg-white border border-slate-200 rounded px-2 py-0.5">
                      {formatNumber(claim.quantity)}
                    </span>
                    <button
                      onClick={() => deleteClaimMutation.mutate(claim.id)}
                      disabled={deleteClaimMutation.isPending}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                      title="Remove claim"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add claim form */}
          <form onSubmit={handleSubmit} className="pt-3 border-t border-slate-200 space-y-3">
            <label className="block text-xs font-semibold text-slate-700">Add a claim</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Person name"
                value={person}
                onChange={(e) => setPerson(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <input
                type="number"
                min={1}
                placeholder="Qty"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                disabled={createClaimMutation.isPending || !person.trim() || quantity === '' || Number(quantity) < 1}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{createClaimMutation.isPending ? 'Adding...' : 'Claim'}</span>
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              Claims are displayed on the public website next to what the workshop needs.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

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
  const [claimsModal, setClaimsModal] = useState<{ id: string; name: string } | null>(null);

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
    },
  });

  const recalculateTargetsMutation = useMutation({
    mutationFn: () => api.post('/recipes/recalculate-targets'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      alert('All raw material targets recalculated from submarine part goals!');
    },
  });

  const updateTargetMutation = useMutation({
    mutationFn: ({ id, desiredQuantity }: { id: string; desiredQuantity: number }) =>
      api.put(`/inventory/${id}/target`, { desiredQuantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      api.put(`/inventory/${id}/stock`, { stock }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-repair'] });
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search materials..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 w-56"
            />
          </div>

          <button
            onClick={() => setOnlyMissing(!onlyMissing)}
            className={`px-3 py-2 rounded-lg text-xs font-medium border transition flex items-center gap-1.5 ${
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

      {/* ── Submarine Crafting Goals & Fleet Target Planner ── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <button
              onClick={() => recalculateTargetsMutation.mutate()}
              disabled={recalculateTargetsMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm transition disabled:opacity-50"
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

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
                <th className="px-5 py-3 text-right">Claims</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    Loading inventory...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    No materials found.
                  </td>
                </tr>
              ) : (
                items.map((mat) => {
                  const hasDeficit = mat.currentStock < mat.desiredQuantity;
                  const isNpc = mat.whereToBuy === 'NPC';

                  return (
                    <tr
                      key={mat.id}
                      className={`hover:bg-slate-50 transition ${
                        hasDeficit ? 'bg-rose-50/50' : ''
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
                        {hasDeficit ? (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                            -{formatNumber(mat.desiredQuantity - mat.currentStock)}
                          </span>
                        ) : (
                          <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                            +OK
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                          {mat.whereToBuy}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => setClaimsModal({ id: mat.id, name: mat.name })}
                          className={`p-1.5 rounded-lg border transition ${
                            hasDeficit
                              ? 'bg-cyan-50 border-cyan-200 text-cyan-600 hover:bg-cyan-100'
                              : 'bg-white border-slate-300 text-slate-400 hover:bg-slate-50'
                          }`}
                          title="Manage Claims"
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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

        <div className="overflow-x-auto">
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
      </div>

      {/* ── Claims modal ── */}
      {claimsModal && (
        <ClaimsModal
          materialId={claimsModal.id}
          materialName={claimsModal.name}
          onClose={() => setClaimsModal(null)}
        />
      )}
    </div>
  );
};
