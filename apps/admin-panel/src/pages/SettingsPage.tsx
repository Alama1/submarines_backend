import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Globe, KeyRound, Save, CheckCircle2 } from 'lucide-react';
import { UniversalisSettings } from '@ff14/types';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [world, setWorld] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<UniversalisSettings>({
    queryKey: ['universalis-settings'],
    queryFn: async () => (await api.get('/prices/settings')).data,
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">System Settings & Integrations</h2>
        <p className="text-xs text-slate-500">
          Configure external FFXIV plugin access keys and world settings.
        </p>
      </div>

      {/* Universalis world card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
          <Globe className="w-4 h-4" />
          <span>Universalis In-Game World</span>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Market prices are synced from this world every 5 minutes (and on manual
          "Sync Universalis"). Changing it applies from the next sync.
          {data?.source === 'default' && (
            <span className="ml-1 text-amber-600">
              Currently using the default value — no custom world saved yet.
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
            placeholder="e.g. Louisoix"
            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 disabled:opacity-50"
          />
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
                <span>{saveWorldMutation.isPending ? 'Saving...' : 'Save World'}</span>
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
