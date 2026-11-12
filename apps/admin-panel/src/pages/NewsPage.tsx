import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { NewsItem } from '@ff14/types';
import { Megaphone, Plus, Pencil, Trash2, AlertCircle, X } from 'lucide-react';

interface NewsDraft {
  title: string;
  description: string;
  imageUrl: string;
  accentColor: string;
  active: boolean;
  sortOrder: number;
}

const EMPTY_DRAFT: NewsDraft = {
  title: '',
  description: '',
  imageUrl: '',
  accentColor: '',
  active: true,
  sortOrder: 0,
};

const draftOf = (n: NewsItem): NewsDraft => ({
  title: n.title,
  description: n.description,
  imageUrl: n.imageUrl ?? '',
  accentColor: n.accentColor ?? '',
  active: n.active,
  sortOrder: n.sortOrder,
});

const payloadOf = (d: NewsDraft) => ({
  title: d.title.trim(),
  description: d.description.trim(),
  imageUrl: d.imageUrl.trim() || null,
  accentColor: d.accentColor.trim() || null,
  active: d.active,
  sortOrder: d.sortOrder,
});

export const NewsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NewsDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: news, isLoading } = useQuery<NewsItem[]>({
    queryKey: ['news'],
    queryFn: async () => (await api.get('/news/all')).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['news'] });
  const onError = (fallback: string) => (err: any) => {
    setError(err.response?.data?.message || fallback);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId ? api.put(`/news/${editingId}`, payloadOf(draft)) : api.post('/news', payloadOf(draft)),
    onSuccess: () => {
      invalidate();
      setError(null);
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    },
    onError: onError(editingId ? 'Failed to update the announcement' : 'Failed to create the announcement'),
  });

  const toggleMutation = useMutation({
    mutationFn: (n: NewsItem) => api.put(`/news/${n.id}`, { active: !n.active }),
    onSuccess: invalidate,
    onError: onError('Failed to toggle the announcement'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/news/${id}`),
    onSuccess: () => {
      invalidate();
      if (editingId) setEditingId(null);
    },
    onError: onError('Failed to delete the announcement'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const newsList = Array.isArray(news) ? news : [];
  const field = 'w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-xs';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">News Banner</h2>
        <p className="text-xs text-slate-500">
          Announcements shown in the bottom-right banner on the customer site. Multiple active items
          become a carousel there; customers can dismiss an item and it never reappears for them.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Create / edit form */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3">
          <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-emerald-600" />
            <span>{editingId ? 'Edit Announcement' : 'New Announcement'}</span>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setDraft(EMPTY_DRAFT);
                }}
                className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                title="Cancel editing"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-600 mb-1">Title</label>
              <input
                type="text"
                maxLength={120}
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Summer sale — 20% off hulls"
                className={field}
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Description</label>
              <textarea
                rows={5}
                maxLength={5000}
                required
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Details shown under the title. Line breaks are kept."
                className={`${field} resize-y`}
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Image URL (optional)</label>
              <input
                type="url"
                maxLength={500}
                value={draft.imageUrl}
                onChange={(e) => setDraft({ ...draft, imageUrl: e.target.value })}
                placeholder="https://…"
                className={field}
              />
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Accent color (optional)</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(draft.accentColor) ? draft.accentColor : '#c5a059'}
                  onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
                  className="w-9 h-9 p-1 bg-white border border-slate-300 rounded-lg cursor-pointer"
                  title="Pick an accent color"
                />
                <input
                  type="text"
                  maxLength={7}
                  value={draft.accentColor}
                  onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })}
                  placeholder="#c5a059 — empty = default"
                  className={`${field} font-mono`}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div>
                <label className="block text-slate-600 mb-1">Sort order</label>
                <input
                  type="number"
                  step="1"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: parseInt(e.target.value) || 0 })}
                  className={`${field} w-24 font-mono`}
                />
              </div>
              <label className="flex items-center gap-2 text-slate-700 mt-5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600"
                />
                Active
              </label>
            </div>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Save Changes' : 'Add Announcement'}
            </button>
          </form>
        </div>

        {/* Existing announcements */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm divide-y divide-slate-200">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">Loading announcements...</div>
          ) : newsList.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              No announcements yet. The banner stays hidden for customers.
            </div>
          ) : (
            newsList.map((n) => (
              <div key={n.id} className="p-4 flex items-center gap-4">
                {n.imageUrl && (
                  <img
                    src={n.imageUrl}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover border border-slate-200 flex-shrink-0 hidden sm:block"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="font-bold text-sm truncate"
                      style={n.accentColor ? { color: n.accentColor } : { color: '#0f172a' }}
                    >
                      {n.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${
                        n.active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {n.active ? 'Live' : 'Hidden'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono flex-shrink-0">#{n.sortOrder}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-line">{n.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate(n)}
                    className="px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 text-xs font-medium transition"
                  >
                    {n.active ? 'Hide' : 'Publish'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(n.id);
                      setDraft(draftOf(n));
                      setError(null);
                    }}
                    className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition"
                    title="Edit announcement"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(n.id)}
                    className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
