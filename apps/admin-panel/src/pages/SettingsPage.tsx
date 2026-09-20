import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Globe, KeyRound, Save, CheckCircle2, ShieldCheck, Trash2, UserPlus, Lock } from 'lucide-react';
import { UniversalisSettings, WhitelistResponse } from '@ff14/types';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [world, setWorld] = useState('');
  const [saved, setSaved] = useState(false);

  const [newEmail, setNewEmail] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const { data, isLoading } = useQuery<UniversalisSettings>({
    queryKey: ['universalis-settings'],
    queryFn: async () => (await api.get('/prices/settings')).data,
  });

  const { data: whitelist, isLoading: whitelistLoading } = useQuery<WhitelistResponse>({
    queryKey: ['email-whitelist'],
    queryFn: async () => (await api.get('/auth/whitelist')).data,
  });

  const addWhitelistMutation = useMutation({
    mutationFn: (payload: { email: string; label?: string }) =>
      api.post('/auth/whitelist', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-whitelist'] });
      setNewEmail('');
      setNewLabel('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to add email to the whitelist.');
    },
  });

  const removeWhitelistMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-whitelist'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to remove email from the whitelist.');
    },
  });

  useEffect(() => {
    if (data?.world) setWorld(data.world);
  }, [data]);

  const saveWorldMutation = useMutation({
    mutationFn: () => api.put('/prices/settings/world', { world: world.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['universalis-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save the world setting.');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!world.trim()) return;
    saveWorldMutation.mutate();
  };

  const handleAddEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    addWhitelistMutation.mutate({
      email: newEmail.trim().toLowerCase(),
      label: newLabel.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">System Settings & Integrations</h2>
        <p className="text-xs text-slate-500">
          Configure admin panel access, external FFXIV plugin access keys and world settings.
        </p>
      </div>

      {/* Email Whitelist card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-violet-600 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Login Whitelist</span>
          </div>
          {whitelist && (
            <span className="text-[11px] text-slate-400 font-medium">
              {whitelist.total} {whitelist.total === 1 ? 'entry' : 'entries'}
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Only verified Firebase accounts on this list can sign in to the admin panel.
          Changes apply immediately (whitelist is re-read within 30 seconds).
        </p>

        {/* Add form */}
        <form onSubmit={handleAddEmail} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="email@example.com"
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-violet-500"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (optional)"
            className="sm:w-40 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500"
          />
          <button
            type="submit"
            disabled={addWhitelistMutation.isPending || !newEmail.trim()}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{addWhitelistMutation.isPending ? 'Adding...' : 'Add to Whitelist'}</span>
          </button>
        </form>

        {/* Entries */}
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {whitelistLoading ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">Loading whitelist...</div>
          ) : !whitelist || whitelist.items.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-slate-400">
              Whitelist is empty — nobody can log in until an email is added here
              (or set via the ALLOWED_EMAILS server configuration).
            </div>
          ) : (
            whitelist.items.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono font-medium text-slate-900 truncate">{entry.email}</div>
                  {entry.label && (
                    <div className="text-[11px] text-slate-400">{entry.label}</div>
                  )}
                </div>
                {entry.source === 'env' ? (
                  <span
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap"
                    title="Imported from the ALLOWED_EMAILS server environment variable — remove it there"
                  >
                    <Lock className="w-2.5 h-2.5" />
                    env
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold uppercase tracking-wide">
                    managed
                  </span>
                )}
                <button
                  onClick={() => removeWhitelistMutation.mutate(entry.id)}
                  disabled={entry.source === 'env' || removeWhitelistMutation.isPending}
                  className={entry.source === 'env'
                    ? 'p-1.5 text-slate-200 cursor-not-allowed'
                    : 'p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition'}
                  title={entry.source === 'env' ? 'Managed via server environment' : 'Remove from whitelist'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Universalis market scope card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
            <Globe className="w-4 h-4" />
            <span>Universalis Market Region</span>
          </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Synced prices are the cheapest NQ listing within this region (europe, north-america
          or japan). Prices are synced once per hour (and on manual "Sync Universalis").
          Changing it applies from the next sync.
          {data?.source === 'default' && (
            <span className="ml-1 text-amber-600">
              Currently using the default value — no custom region saved yet.
            </span>
          )}
        </p>

        <form onSubmit={handleSave} className="flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text"
            required
            disabled={isLoading}
            value={world}
            onChange={(e) => setWorld(e.target.value)}
            placeholder="europe, north-america or japan"
            list="universalis-scope-suggestions"
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
          <datalist id="universalis-scope-suggestions">
            <option value="europe">Europe</option>
            <option value="north-america">North America</option>
            <option value="japan">Japan</option>
          </datalist>
          <button
            type="submit"
            disabled={saveWorldMutation.isPending || !world.trim() || world.trim() === data?.world}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50"
          >
            {saved ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>{saveWorldMutation.isPending ? 'Saving...' : 'Save Region'}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Inventory Plugin Instructions */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-cyan-600 font-semibold text-sm">
          <KeyRound className="w-4 h-4" />
          <span>FFXIV Inventory Plugin Integration</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Configure your inventory sync plugin with the following target URL and API key header:
        </p>

        <div className="space-y-2 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Target Ingest Endpoint:</label>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-slate-700">
              POST https://your-subdomain.domain/api/inventory/ingest
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-medium mb-1">Required Authentication Header:</label>
            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-slate-700">
              X-API-Key: &lt;your_plugin_api_key&gt;
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
