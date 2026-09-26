import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatGil, formatNumber, sourceBadgeClass } from '../lib/utils';
import {
  Hammer,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Boxes,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  SubmarinePart,
  BaseMaterial,
  MaterialSource,
  MaterialCategory,
  MATERIAL_SOURCES,
} from '@ff14/types';

export const RecipesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'parts' | 'materials'>('parts');

  // ── Submarine Part Form State ───────────────────────────────────────────
  const [isEditingPart, setIsEditingPart] = useState(false);
  const [selectedPart, setSelectedPart] = useState<SubmarinePart | null>(null);
  const [partId, setPartId] = useState('');
  const [partName, setPartName] = useState('');
  const [partItemId, setPartItemId] = useState<number | ''>('');
  const [partType, setPartType] = useState('hull');
  const [className, setClassName] = useState('Shark');
  const [classKey, setClassKey] = useState('shark');
  const [price, setPrice] = useState(1000000);
  const [desiredStock, setDesiredStock] = useState(0);
  const [isModified, setIsModified] = useState(false);
  const [partMaterials, setPartMaterials] = useState<Array<{ materialId: string; quantity: number }>>([]);
  const [partError, setPartError] = useState<string | null>(null);
  const [partSuccess, setPartSuccess] = useState<string | null>(null);

  // ── Material Form State ─────────────────────────────────────────────────
  const [isEditingMat, setIsEditingMat] = useState(false);
  const [selectedMat, setSelectedMat] = useState<any | null>(null);
  const [matName, setMatName] = useState('');
  const [matItemId, setMatItemId] = useState<number | ''>('');
  const [desiredQuantity, setDesiredQuantity] = useState(1000);
  const [myPrice, setMyPrice] = useState<number | ''>('');
  const [npcPrice, setNpcPrice] = useState<number | ''>('');
  const [whereToBuy, setWhereToBuy] = useState<MaterialSource>('Market');
  const [matCategory, setMatCategory] = useState<MaterialCategory>('crafting');
  const [matIngredients, setMatIngredients] = useState<
    Array<{ ingredientMaterialId: string; quantity: number }>
  >([]);
  const [matError, setMatError] = useState<string | null>(null);
  const [matSuccess, setMatSuccess] = useState<string | null>(null);

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: parts, isLoading: partsLoading } = useQuery<SubmarinePart[]>({
    queryKey: ['recipes'],
    queryFn: async () => (await api.get('/recipes')).data,
  });

  const { data: materialsData, isLoading: matsLoading } = useQuery<{
    items: BaseMaterial[];
    total: number;
  }>({
    queryKey: ['materials'],
    queryFn: async () => (await api.get('/materials?limit=300')).data,
  });

  const allMaterials = materialsData?.items ?? [];
  const partsList = Array.isArray(parts) ? parts : [];

  // ── Mutations ───────────────────────────────────────────────────────────
  const savePartMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (selectedPart) {
        return (await api.put(`/recipes/${selectedPart.id}`, payload)).data;
      }
      return (await api.post('/recipes', payload)).data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      setPartSuccess(`Saved part "${saved.name}" successfully!`);
      setPartError(null);
      setTimeout(() => {
        setIsEditingPart(false);
        setPartSuccess(null);
      }, 1500);
    },
    onError: (err: any) => {
      setPartError(err.response?.data?.message || 'Failed to save submarine part.');
    },
  });

  const deletePartMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/recipes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      if (selectedPart) setSelectedPart(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Cannot delete part referenced in active orders.');
    },
  });

  const saveMatMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (selectedMat) {
        return (await api.put(`/materials/${selectedMat.id}`, payload)).data;
      }
      return (await api.post('/materials', payload)).data;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['price-anomalies'] });
      setMatSuccess(`Saved material "${saved?.name ?? matName}" successfully!`);
      setMatError(null);
      setTimeout(() => {
        setIsEditingMat(false);
        setMatSuccess(null);
      }, 1500);
    },
    onError: (err: any) => {
      setMatError(err.response?.data?.message || 'Failed to save material.');
    },
  });

  const deleteMatMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      if (selectedMat) setSelectedMat(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Cannot delete material used in existing recipes.');
    },
  });

  const recalculateTargetsMutation = useMutation({
    mutationFn: () => api.post('/recipes/recalculate-targets'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      alert('All raw material stock targets recalculated successfully!');
    },
  });

  const resolveIdsMutation = useMutation({
    // Long timeout: each missing ID requires a XIVAPI round-trip (~120ms apart)
    mutationFn: () =>
      api.post('/xivapi/resolve-missing-ids', null, { timeout: 300_000 }),
    onSuccess: (res) => {
      const { materials, parts } = res.data;
      const notFound: string[] = [...materials.notFound, ...parts.notFound];
      let msg =
        `Item ID auto-fill complete!\n\n` +
        `Materials: ${materials.updated} of ${materials.scanned} filled\n` +
        `Submarine parts: ${parts.updated} of ${parts.scanned} filled`;
      if (notFound.length > 0) {
        msg += `\n\nNot found on XIVAPI:\n- ${notFound.join('\n- ')}`;
      }
      alert(msg);
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to auto-fill item IDs.');
    },
  });

  // ── Helpers ─────────────────────────────────────────────────────────────
  const openNewPart = () => {
    setSelectedPart(null);
    setPartId('');
    setPartName('');
    setPartItemId('');
    setPartType('hull');
    setClassName('Shark');
    setClassKey('shark');
    setPrice(1000000);
    setDesiredStock(0);
    setIsModified(false);
    setPartMaterials([]);
    setPartError(null);
    setPartSuccess(null);
    setIsEditingPart(true);
  };

  const openEditPart = (part: SubmarinePart) => {
    setSelectedPart(part);
    setPartId(part.id);
    setPartName(part.name);
    setPartItemId(part.itemId ?? '');
    setPartType(part.partType);
    setClassName(part.className);
    setClassKey(part.classKey);
    setPrice(part.price);
    setDesiredStock(part.desiredStock ?? 0);
    setIsModified(part.isModified);
    setPartMaterials(
      (part.materials ?? []).map((pm) => ({
        materialId: pm.material.id,
        quantity: pm.quantity,
      }))
    );
    setPartError(null);
    setPartSuccess(null);
    setIsEditingPart(true);
  };

  const addPartMaterialRow = () => {
    if (allMaterials.length > 0) {
      setPartMaterials([...partMaterials, { materialId: allMaterials[0].id, quantity: 10 }]);
    }
  };

  const removePartMaterialRow = (idx: number) => {
    setPartMaterials(partMaterials.filter((_, i) => i !== idx));
  };

  const addMatIngredientRow = () => {
    const first = allMaterials.find((m) => m.id !== selectedMat?.id);
    if (first) {
      setMatIngredients([...matIngredients, { ingredientMaterialId: first.id, quantity: 1 }]);
    }
  };

  const removeMatIngredientRow = (idx: number) => {
    setMatIngredients(matIngredients.filter((_, i) => i !== idx));
  };

  const handlePartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPartError(null);
    savePartMutation.mutate({
      id: partId.trim(),
      name: partName.trim(),
      itemId: partItemId !== '' ? Number(partItemId) : undefined,
      partType,
      className,
      classKey: classKey || className.toLowerCase(),
      price: Number(price),
      desiredStock: Number(desiredStock),
      isModified,
      materials: partMaterials.map((pm) => ({
        materialId: pm.materialId,
        quantity: Number(pm.quantity),
      })),
    });
  };

  const openNewMat = () => {
    setSelectedMat(null);
    setMatName('');
    setMatItemId('');
    setDesiredQuantity(1000);
    setMyPrice('');
    setNpcPrice('');
    setWhereToBuy('Market');
    setMatCategory('crafting');
    setMatIngredients([]);
    setMatError(null);
    setMatSuccess(null);
    setIsEditingMat(true);
  };

  const openEditMat = (mat: any) => {
    setSelectedMat(mat);
    setMatName(mat.name);
    setMatItemId(mat.itemId ?? '');
    setDesiredQuantity(mat.desiredQuantity ?? 1000);
    setMyPrice(mat.myPrice ?? '');
    setNpcPrice(mat.npcPrice ?? '');
    setWhereToBuy(mat.whereToBuy || 'Market');
    setMatCategory(mat.category || 'crafting');
    setMatIngredients(
      (mat.recipe ?? []).map((ri: any) => ({
        ingredientMaterialId: ri.ingredientMaterialId,
        quantity: ri.quantity,
      }))
    );
    setMatError(null);
    setMatSuccess(null);
    setIsEditingMat(true);
  };

  const handleMatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMatError(null);
    // Strip nullish optional fields so @IsOptional() validators pass (they reject explicit null)
    const payload: Record<string, unknown> = {
      name: matName.trim(),
      desiredQuantity: Number(desiredQuantity),
      whereToBuy,
      category: matCategory,
      ingredients: matIngredients.map((ri) => ({
        ingredientMaterialId: ri.ingredientMaterialId,
        quantity: Number(ri.quantity),
      })),
    };
    if (matItemId !== '') payload.itemId = Number(matItemId);
    if (myPrice !== '') payload.myPrice = Number(myPrice);
    if (npcPrice !== '') payload.npcPrice = Number(npcPrice);
    saveMatMutation.mutate(payload);
  };

  // Approximate craft cost from current buy prices (flat, one level deep)
  const craftPreviewCost = matIngredients.reduce((sum, ri) => {
    const ing = allMaterials.find((m) => m.id === ri.ingredientMaterialId);
    const unit = ing ? (ing.myPrice ?? ing.marketPrice ?? ing.npcPrice ?? 0) : 0;
    return sum + unit * (Number(ri.quantity) || 0);
  }, 0);

  const craftIngredientOptions = allMaterials.filter((m) => m.id !== selectedMat?.id);

  return (
    <div className="space-y-6">
      {/* Top Header & Tab switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Crafting Recipes & Materials</h2>
          <p className="text-xs text-slate-500">
            Define submarine components, material ingredients, and FF14 item IDs for live inventory sync.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition flex-1 sm:flex-none whitespace-nowrap ${
                activeTab === 'parts'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              <span>Submarine Parts ({partsList.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition flex-1 sm:flex-none whitespace-nowrap ${
                activeTab === 'materials'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Raw Base Materials ({allMaterials.length})</span>
            </button>
          </div>

          <button
            onClick={() => resolveIdsMutation.mutate()}
            disabled={resolveIdsMutation.isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-300 transition disabled:opacity-50"
            title="Look up missing FF14 item IDs from XIVAPI (never overwrites existing IDs)"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${resolveIdsMutation.isPending ? 'animate-pulse' : ''}`} />
            <span>{resolveIdsMutation.isPending ? 'Resolving IDs...' : 'Auto-fill Item IDs'}</span>
          </button>
        </div>
      </div>

      {/* ──────────────── TAB 1: SUBMARINE PARTS ──────────────── */}
      {activeTab === 'parts' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Showing {partsList.length} component blueprints
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => recalculateTargetsMutation.mutate()}
                  disabled={recalculateTargetsMutation.isPending}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-300 transition flex-1 sm:flex-none"
                  title="Recalculate Raw Material Target Stock from Part Goals"
                >
                  <Hammer className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{recalculateTargetsMutation.isPending ? 'Recalculating...' : 'Sync Raw Material Targets'}</span>
                </button>
                <button
                  onClick={openNewPart}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition flex-1 sm:flex-none"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Submarine Part</span>
                </button>
              </div>
            </div>

            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Part Name</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Target Goal</th>
                      <th className="px-4 py-3">In Retainers</th>
                      <th className="px-4 py-3">Recipe Items</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {partsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Loading submarine parts...
                        </td>
                      </tr>
                    ) : partsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No submarine parts added yet. Click "Add Submarine Part" to create your first component.
                        </td>
                      </tr>
                    ) : (
                      partsList.map((part) => (
                        <tr key={part.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{part.name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Slug: {part.id} {part.itemId ? `(FF14: #${part.itemId})` : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3 uppercase text-slate-600 font-mono">
                            {part.partType}
                          </td>
                          <td className="px-4 py-3 font-mono text-cyan-600 font-bold text-center">
                            {part.desiredStock ?? 0}
                          </td>
                          <td className="px-4 py-3 font-mono text-emerald-600 font-bold">
                            {part.stock} ready
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            <div>{(part.materials ?? []).length} materials</div>
                            {(part.expandedMaterials?.length ?? 0) > (part.materials ?? []).length && (
                              <div
                                className="text-[11px] text-slate-400"
                                title={(part.expandedMaterials ?? [])
                                  .map((m) => `${m.name} x${m.quantity}`)
                                  .join(', ')}
                              >
                                + {(part.expandedMaterials ?? []).length} raw (full chain)
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {formatGil(part.price)}
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            <button
                              onClick={() => openEditPart(part)}
                              className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 transition"
                              title="Edit Part"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deletePartMutation.mutate(part.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              title="Delete Part"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submarine parts — mobile cards */}
            <div className="md:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-200">
              {partsLoading ? (
                <div className="px-4 py-8 text-center text-slate-400 text-xs">
                  Loading submarine parts...
                </div>
              ) : partsList.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-xs">
                  No submarine parts added yet. Click "Add Submarine Part" to create your first
                  component.
                </div>
              ) : (
                partsList.map((part) => (
                  <div key={part.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm break-words">
                          {part.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono break-all">
                          {part.id}
                          {part.itemId ? ` (FF14: #${part.itemId})` : ''}
                        </div>
                      </div>
                      <span className="uppercase text-slate-600 font-mono text-[10px] px-2 py-0.5 rounded bg-slate-100 border border-slate-200 flex-shrink-0">
                        {part.partType}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">
                          Target
                        </div>
                        <div className="font-mono text-cyan-600 font-bold text-xs">
                          {part.desiredStock ?? 0}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">
                          Retainers
                        </div>
                        <div className="font-mono text-emerald-600 font-bold text-xs">
                          {part.stock}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">
                          Price
                        </div>
                        <div className="font-mono text-slate-700 font-bold text-xs">
                          {formatNumber(part.price)}
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500">
                      {(part.materials ?? []).length} materials
                      {(part.expandedMaterials?.length ?? 0) > (part.materials ?? []).length && (
                        <span className="text-slate-400">
                          {' '}
                          · + {(part.expandedMaterials ?? []).length} raw (full chain)
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => openEditPart(part)}
                        className="flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => deletePartMutation.mutate(part.id)}
                        className="flex items-center justify-center gap-1.5 flex-1 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-medium transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Part Editor Drawer / Form — sticks while the table scrolls */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">
                {isEditingPart ? (selectedPart ? 'Edit Component' : 'New Component') : 'Component Inspector'}
              </h3>
              {isEditingPart && (
                <button onClick={() => setIsEditingPart(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {partError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{partError}</span>
              </div>
            )}

            {partSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{partSuccess}</span>
              </div>
            )}

            {isEditingPart ? (
              <form onSubmit={handlePartSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">Unique Slug ID (e.g. shark_hull)</label>
                  <input
                    type="text"
                    required
                    disabled={!!selectedPart}
                    value={partId}
                    onChange={(e) => setPartId(e.target.value)}
                    placeholder="shark_hull"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono placeholder:text-slate-400 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Component Display Name</label>
                  <input
                    type="text"
                    required
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    placeholder="Shark-class Pressure Hull"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">FF14 Item ID (for retainer sync)</label>
                  <input
                    type="number"
                    placeholder="e.g. 26509"
                    value={partItemId}
                    onChange={(e) => setPartItemId(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-1">Part Type</label>
                    <select
                      value={partType}
                      onChange={(e) => setPartType(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    >
                      <option value="hull">Hull</option>
                      <option value="stern">Stern</option>
                      <option value="bow">Bow</option>
                      <option value="bridge">Bridge</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Class Name</label>
                    <input
                      type="text"
                      value={className}
                      onChange={(e) => setClassName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-600 mb-1">Sale Price (Gil)</label>
                    <input
                      type="number"
                      required
                      value={price}
                      onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">
                      <span>Target Goal Stock</span>
                      <span className="text-[10px] text-cyan-600 font-mono ml-1">(units)</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={desiredStock}
                      onChange={(e) => setDesiredStock(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isModified"
                    checked={isModified}
                    onChange={(e) => setIsModified(e.target.checked)}
                    className="rounded bg-white border-slate-300 text-emerald-600 focus:ring-0"
                  />
                  <label htmlFor="isModified" className="text-slate-700">
                    Modified (Mk. II version)
                  </label>
                </div>

                {/* Recipe Materials Requirements */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 font-semibold">Required Raw Materials</label>
                    <button
                      type="button"
                      onClick={addPartMaterialRow}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {partMaterials.map((pm, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <select
                          value={pm.materialId}
                          onChange={(e) => {
                            const updated = [...partMaterials];
                            updated[idx].materialId = e.target.value;
                            setPartMaterials(updated);
                          }}
                          className="w-full sm:flex-1 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                        >
                          {allMaterials.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={pm.quantity}
                            onChange={(e) => {
                              const updated = [...partMaterials];
                              updated[idx].quantity = parseInt(e.target.value) || 1;
                              setPartMaterials(updated);
                            }}
                            className="w-16 flex-shrink-0 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removePartMaterialRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {partMaterials.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic">No materials assigned to this recipe.</p>
                    )}
                  </div>

                  {selectedPart && (selectedPart.expandedMaterials?.length ?? 0) > partMaterials.length && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-[11px] text-slate-600 font-semibold mb-1">
                        Full crafting chain (incl. base part materials):
                      </p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {(selectedPart.expandedMaterials ?? [])
                          .map((m) => `${m.name} x${m.quantity}`)
                          .join(', ')}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={savePartMutation.isPending}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    {savePartMutation.isPending ? 'Saving...' : 'Save Part Recipe'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                Select a submarine part from the table or click "Add Submarine Part" to create a new blueprint.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: RAW BASE MATERIALS ──────────────── */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">
                Showing {allMaterials.length} materials in database
              </span>
              <button
                onClick={openNewMat}
                className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Base Material</span>
              </button>
            </div>

            <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Material Name</th>
                      <th className="px-4 py-3">FF14 Item ID</th>
                      <th className="px-4 py-3">Target Stock</th>
                      <th className="px-4 py-3">My Price</th>
                      <th className="px-4 py-3">NPC Price</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {matsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          Loading materials...
                        </td>
                      </tr>
                    ) : allMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                          No materials registered yet. Click "Add Base Material" to start building your catalogue.
                        </td>
                      </tr>
                    ) : (
                      allMaterials.map((mat) => (
                        <tr key={mat.id} className="hover:bg-slate-50 transition">
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            <div className="flex items-center gap-2">
                              {mat.name}
                              {mat.category === 'repair' && (
                                <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-semibold uppercase tracking-wide">
                                  Repair
                                </span>
                              )}
                              {(mat.recipe?.length ?? 0) > 0 && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-0.5"
                                  title={`Crafted from ${(mat.recipe ?? [])
                                    .map((ri: any) => `${ri.ingredient?.name ?? '?'} x${ri.quantity}`)
                                    .join(', ')}`}
                                >
                                  <Hammer className="w-2.5 h-2.5" />
                                  Craft
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-400">
                            {mat.itemId || '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {formatNumber(mat.desiredQuantity)}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {mat.myPrice != null ? (
                              <span className="text-amber-600 font-semibold">{formatGil(mat.myPrice)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {mat.npcPrice != null ? formatGil(mat.npcPrice) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                              {mat.whereToBuy}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right space-x-1.5">
                            <button
                              onClick={() => openEditMat(mat)}
                              className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 transition"
                              title="Edit Material"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteMatMutation.mutate(mat.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                              title="Delete Material"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Raw materials — mobile cards */}
            <div className="md:hidden bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-200">
              {matsLoading ? (
                <div className="px-4 py-8 text-center text-slate-400 text-xs">
                  Loading materials...
                </div>
              ) : allMaterials.length === 0 ? (
                <div className="px-4 py-8 text-center text-slate-400 text-xs">
                  No materials registered yet. Click "Add Base Material" to start building your
                  catalogue.
                </div>
              ) : (
                allMaterials.map((mat) => (
                  <div key={mat.id} className="p-4 space-y-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-slate-900 text-sm break-words">
                          {mat.name}
                        </span>
                        {mat.category === 'repair' && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-200 text-violet-700 text-[10px] font-semibold uppercase tracking-wide">
                            Repair
                          </span>
                        )}
                        {(mat.recipe?.length ?? 0) > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold uppercase tracking-wide flex items-center gap-0.5">
                            <Hammer className="w-2.5 h-2.5" />
                            Craft
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        ID: {mat.itemId || '—'}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">
                          Target
                        </div>
                        <div className="font-mono text-slate-700 font-bold text-xs">
                          {formatNumber(mat.desiredQuantity)}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">
                          My Price
                        </div>
                        <div className="font-mono text-xs font-bold text-amber-600">
                          {mat.myPrice != null ? formatNumber(mat.myPrice) : '—'}
                        </div>
                      </div>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wide text-slate-400">
                          NPC
                        </div>
                        <div className="font-mono text-xs font-bold text-slate-500">
                          {mat.npcPrice != null ? formatNumber(mat.npcPrice) : '—'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceBadgeClass(mat.whereToBuy)}`}>
                        {mat.whereToBuy}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditMat(mat)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 text-xs font-medium transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMatMutation.mutate(mat.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-medium transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          {/* Material Editor Panel — sticks while the table scrolls */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="font-semibold text-slate-900 text-sm">
                {isEditingMat ? (selectedMat ? 'Edit Material' : 'New Base Material') : 'Material Inspector'}
              </h3>
              {isEditingMat && (
                <button onClick={() => setIsEditingMat(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {matError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{matError}</span>
              </div>
            )}

            {matSuccess && (
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{matSuccess}</span>
              </div>
            )}

            {isEditingMat ? (
              <form onSubmit={handleMatSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 mb-1">In-Game Material Name</label>
                  <input
                    type="text"
                    required
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    placeholder="e.g. Darksteel Ingot"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Universalis / FF14 Item ID</label>
                  <input
                    type="number"
                    placeholder="e.g. 5060"
                    value={matItemId}
                    onChange={(e) => setMatItemId(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Desired Target Stock</label>
                  <input
                    type="number"
                    required
                    value={desiredQuantity}
                    onChange={(e) => setDesiredQuantity(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    <span>My Price Override (Gil)</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">(Custom valuation)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 450"
                    value={myPrice}
                    onChange={(e) => setMyPrice(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">
                    <span>NPC Vendor Buy Price (Gil)</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">(Nullable)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="Leave empty if vendor unavailable"
                    value={npcPrice}
                    onChange={(e) => setNpcPrice(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Primary Acquisition Source</label>
                  <select
                    value={whereToBuy}
                    onChange={(e) => setWhereToBuy(e.target.value as MaterialSource)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    {MATERIAL_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {whereToBuy === 'NPC' && (
                    <p className="mt-1 text-[10px] text-violet-600">
                      NPC-sourced items are always stocked to the max.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-slate-600 mb-1">Inventory Category</label>
                  <select
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value as MaterialCategory)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="crafting">Crafting Material</option>
                    <option value="repair">Repair Supply (separate section)</option>
                  </select>
                </div>

                {/* Crafting Recipe (optional) */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-700 font-semibold">
                      Crafting Recipe
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                        (ingredients per 1 crafted)
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={addMatIngredientRow}
                      disabled={craftIngredientOptions.length === 0}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-40"
                    >
                      + Add Ingredient
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {matIngredients.map((ri, idx) => (
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <select
                          value={ri.ingredientMaterialId}
                          onChange={(e) => {
                            const updated = [...matIngredients];
                            updated[idx].ingredientMaterialId = e.target.value;
                            setMatIngredients(updated);
                          }}
                          className="w-full sm:flex-1 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900"
                        >
                          {craftIngredientOptions.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={ri.quantity}
                            onChange={(e) => {
                              const updated = [...matIngredients];
                              updated[idx].quantity = parseInt(e.target.value) || 1;
                              setMatIngredients(updated);
                            }}
                            className="w-16 flex-shrink-0 px-2 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-900 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => removeMatIngredientRow(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {matIngredients.length === 0 && (
                      <p className="text-[11px] text-slate-400 italic">
                        Not crafted. Add ingredients (raw mats &amp; crystals) to define a craft recipe.
                      </p>
                    )}
                  </div>

                  {matIngredients.length > 0 && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                      <p className="text-[11px] text-slate-600">
                        Approx. craft cost (buy prices):{' '}
                        <span className="font-mono font-bold text-emerald-600">
                          {formatGil(craftPreviewCost)}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Full multi-tier costing is validated in Price Management → Price Anomalies.
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={saveMatMutation.isPending}
                    className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm disabled:opacity-50"
                  >
                    {saveMatMutation.isPending ? 'Saving...' : 'Save Base Material'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                Select a material from the table or click "Add Base Material" to register a new raw item into the database.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
