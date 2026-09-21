import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatGil } from '../lib/utils';
import { Eye, X, XCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Order, OrderStatus, SubmarinePart } from '@ff14/types';

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'finished', label: 'Finished' },
  { value: 'fulfilled', label: 'Fulfilled' },
  { value: 'cancelled', label: 'Cancelled' },
];

const statusSelectClass =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-emerald-500 disabled:opacity-50';

const isActiveOrder = (status: OrderStatus) =>
  status === 'confirmed' || status === 'in_progress';

interface EditItemDraft {
  partId: string;
  quantity: number;
  buildName: string;
}

interface EditOrderDraft {
  clientName: string;
  contactInfo: string;
  isAnonymous: boolean;
  notes: string;
  fulfillmentDt: string;
  items: EditItemDraft[];
}

export const OrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [draft, setDraft] = useState<EditOrderDraft | null>(null);

  const { data, isLoading } = useQuery<{ items: Order[]; total: number }>({
    queryKey: ['orders', statusFilter],
    queryFn: async () => {
      const statusParam =
        statusFilter === 'all'
          ? ''
          : `status=${statusFilter === 'active' ? 'confirmed,in_progress' : statusFilter}&`;
      const url = `/orders?${statusParam}limit=100`;
      return (await api.get(url)).data;
    },
  });

  const { data: partsData } = useQuery<SubmarinePart[] | { parts: SubmarinePart[] }>({
    queryKey: ['recipes', 'for-orders'],
    queryFn: async () => (await api.get('/recipes')).data,
    enabled: !!draft,
  });
  const parts: SubmarinePart[] = Array.isArray(partsData)
    ? partsData
    : (partsData?.parts ?? []);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-orders'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      if (selectedOrder) setSelectedOrder(null);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditOrderDraft }) =>
      api.put(`/orders/${id}`, {
        ...payload,
        contactInfo: payload.contactInfo || undefined,
        notes: payload.notes || undefined,
        fulfillmentDt: payload.fulfillmentDt || undefined,
        items: payload.items
          .filter((i) => i.partId)
          .map((i) => ({
            partId: i.partId,
            quantity: i.quantity,
            buildName: i.buildName || undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['in-progress-orders'] });
      closeEdit();
    },
  });

  const openEdit = (order: Order) => {
    setEditingOrder(order);
    setDraft({
      clientName: order.clientName ?? '',
      contactInfo: order.contactInfo ?? '',
      isAnonymous: order.isAnonymous ?? false,
      notes: order.notes ?? '',
      fulfillmentDt: order.fulfillmentDt ?? '',
      items: (order.items ?? []).length
        ? (order.items ?? []).map((i) => ({
            partId: i.part?.id ?? '',
            quantity: i.quantity,
            buildName: i.buildName ?? '',
          }))
        : [{ partId: '', quantity: 1, buildName: '' }],
    });
  };

  const closeEdit = () => {
    setEditingOrder(null);
    setDraft(null);
    updateOrderMutation.reset();
  };

  const setDraftItem = (idx: number, patch: Partial<EditItemDraft>) => {
    if (!draft) return;
    const next = [...draft.items];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, items: next });
  };

  const partById = new Map(parts.map((p) => [p.id, p]));
  const draftSubtotal = (draft?.items ?? []).reduce(
    (acc, i) => acc + (partById.get(i.partId)?.price ?? 0) * i.quantity,
    0,
  );

  const orders = data?.items ?? [];

  // Fresh copy of the selected order so the modal reflects status changes immediately
  const modalOrder = selectedOrder
    ? orders.find((o) => o.id === selectedOrder.id) ?? selectedOrder
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-1">Customer Orders</h2>
          <p className="text-xs text-slate-500">
            View, confirm, and fulfill submarine vessel orders.
          </p>
        </div>
      </div>

      {/* Filter Tabs — pending orders are hidden until activated by code */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {['active', 'all', 'confirmed', 'in_progress', 'finished', 'fulfilled', 'cancelled'].map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
              statusFilter === tab
                ? 'bg-slate-900 text-white font-semibold'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Items</th>
                <th className="px-5 py-3">Total (Gil)</th>
                <th className="px-5 py-3">Fulfillment</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                    No orders found matching this filter.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-mono font-bold text-emerald-600">
                      {order.orderCode}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-slate-900">{order.clientName}</div>
                      {order.contactInfo && (
                        <div className="text-[11px] text-slate-400">{order.contactInfo}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {(order.items ?? []).length} parts
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-800">
                      {formatGil(order.total)}
                    </td>
                    <td className="px-5 py-3.5">
                      {order.fulfillmentDt ? (
                        <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          {order.fulfillmentDt}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          ASAP
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 transition"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {isActiveOrder(order.status) && (
                        <button
                          onClick={() => openEdit(order)}
                          className="p-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-emerald-600 transition"
                          title="Edit Order"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}

                      <select
                        value={order.status}
                        disabled={statusMutation.isPending}
                        onChange={(e) =>
                          statusMutation.mutate({ id: order.id, status: e.target.value as OrderStatus })
                        }
                        className={statusSelectClass}
                        title="Set Status"
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {(order.status === 'pending' || order.status === 'confirmed') && (
                        <button
                          onClick={() => cancelMutation.mutate(order.id)}
                          disabled={cancelMutation.isPending}
                          className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal — uses the live row from the list so status updates in place */}
      {modalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative space-y-6">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {modalOrder.orderCode}
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">
                  {modalOrder.clientName}
                </h3>
              </div>
              <StatusBadge status={modalOrder.status} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              {modalOrder.contactInfo && (
                <p>
                  Contact: <strong className="text-slate-700">{modalOrder.contactInfo}</strong>
                </p>
              )}
              <p>
                Fulfillment:{' '}
                {modalOrder.fulfillmentDt ? (
                  <strong className="text-amber-700">{modalOrder.fulfillmentDt}</strong>
                ) : (
                  <strong className="text-emerald-700">ASAP</strong>
                )}
              </p>
            </div>

            {/* Items Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Order Items & Snapshot Pricing
              </h4>
              <div className="bg-slate-50 rounded-lg border border-slate-200 divide-y divide-slate-200">
                {(modalOrder.items ?? []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-medium text-slate-800">{item.partName}</span>
                      {item.buildName && (
                        <span className="text-slate-400 ml-2">({item.buildName})</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500">
                        {item.quantity} × {formatGil(item.unitPrice)} =
                      </span>{' '}
                      <span className="font-mono font-bold text-slate-800">
                        {formatGil(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal:</span>
                <span className="font-mono">{formatGil(modalOrder.subtotal)}</span>
              </div>
              {modalOrder.discountPct > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Bulk Discount ({modalOrder.discountPct}%):</span>
                  <span className="font-mono">-{formatGil(modalOrder.discountAmt)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 border-t border-slate-200 pt-2">
                <span>Total Due:</span>
                <span className="font-mono text-emerald-600">{formatGil(modalOrder.total)}</span>
              </div>
            </div>

            {/* Status control */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              {isActiveOrder(modalOrder.status) ? (
                <button
                  onClick={() => {
                    setSelectedOrder(null);
                    openEdit(modalOrder);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50 hover:text-emerald-600 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Order
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Set Status:</span>
                <select
                  value={modalOrder.status}
                  disabled={statusMutation.isPending}
                  onChange={(e) =>
                    statusMutation.mutate({ id: modalOrder.id, status: e.target.value as OrderStatus })
                  }
                  className={`${statusSelectClass} px-3 py-2`}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal — only for active orders; totals recalculated server-side */}
      {editingOrder && draft && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              onClick={closeEdit}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                {editingOrder.orderCode}
              </span>
              <StatusBadge status={editingOrder.status} />
              <h3 className="font-bold text-slate-900 text-lg">Edit Order</h3>
            </div>

            {/* Client details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Client Name
                </span>
                <input
                  type="text"
                  value={draft.clientName}
                  onChange={(e) => setDraft({ ...draft, clientName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Contact Info
                </span>
                <input
                  type="text"
                  placeholder="Discord / character"
                  value={draft.contactInfo}
                  onChange={(e) => setDraft({ ...draft, contactInfo: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Fulfillment Date
                </span>
                <input
                  type="text"
                  placeholder="e.g. next Friday"
                  value={draft.fulfillmentDt}
                  onChange={(e) => setDraft({ ...draft, fulfillmentDt: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={draft.isAnonymous}
                  onChange={(e) => setDraft({ ...draft, isAnonymous: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                <span className="text-xs text-slate-600">Show as Anonymous publicly</span>
              </label>
            </div>

            {/* Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Order Items
                </span>
                <span className="text-[11px] text-slate-400">
                  Totals &amp; bulk discount are recalculated at current part prices on save
                </span>
              </div>
              <div className="space-y-2">
                {draft.items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={item.partId}
                      onChange={(e) => setDraftItem(idx, { partId: e.target.value })}
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
                      type="text"
                      placeholder="Build"
                      value={item.buildName}
                      onChange={(e) => setDraftItem(idx, { buildName: e.target.value })}
                      className="w-28 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        setDraftItem(idx, {
                          quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                        })
                      }
                      className="w-20 px-2 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() =>
                        setDraft({
                          ...draft,
                          items: draft.items.filter((_, i) => i !== idx),
                        })
                      }
                      className="p-2 rounded-lg bg-white border border-slate-300 text-slate-400 hover:text-rose-600 hover:border-rose-200 transition"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      items: [...draft.items, { partId: '', quantity: 1, buildName: '' }],
                    })
                  }
                  className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add item
                </button>
                <div className="text-xs text-slate-500">
                  Recalculated subtotal:{' '}
                  <span className="font-mono font-bold text-slate-800">
                    {formatGil(draftSubtotal)}
                  </span>{' '}
                  <span className="text-slate-400">(before discount)</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Notes
              </span>
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-emerald-500 resize-none"
              />
            </label>

            {updateOrderMutation.isError && (
              <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {(() => {
                  const err: any = updateOrderMutation.error;
                  const msg = err?.response?.data?.message;
                  return typeof msg === 'string'
                    ? msg
                    : Array.isArray(msg)
                      ? msg.join(', ')
                      : 'Failed to update the order.';
                })()}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                onClick={closeEdit}
                className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  updateOrderMutation.mutate({ id: editingOrder.id, payload: draft })
                }
                disabled={
                  updateOrderMutation.isPending ||
                  !draft.clientName.trim() ||
                  draft.items.filter((i) => i.partId).length === 0
                }
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition disabled:opacity-50"
              >
                {updateOrderMutation.isPending ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
