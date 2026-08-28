import React from 'react';
import { Globe, KeyRound } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">System Settings & Integrations</h2>
        <p className="text-xs text-slate-400">
          Configure external FFXIV plugin access keys and world settings.
        </p>
      </div>

      {/* World info card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
          <Globe className="w-4 h-4" />
          <span>Configured Universalis In-Game World</span>
        </div>
        <p className="text-xs text-slate-400">
          Prices and market listings are automatically synced for:
        </p>
        <div className="inline-block px-3 py-1 bg-slate-950 border border-slate-800 rounded-md font-mono text-sm text-emerald-400 font-bold">
          Louisoix (Chaos DC)
        </div>
      </div>

      {/* Inventory Plugin Instructions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-sm">
          <KeyRound className="w-4 h-4" />
          <span>FFXIV Inventory Plugin Integration</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Configure your inventory sync plugin with the following target URL and API key header:
        </p>

        <div className="space-y-2 text-xs">
          <div>
            <label className="block text-slate-400 font-medium mb-1">Target Ingest Endpoint:</label>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-slate-200">
              POST https://your-subdomain.domain/api/inventory/ingest
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Required Authentication Header:</label>
            <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 font-mono text-slate-200">
              X-API-Key: &lt;your_plugin_api_key&gt;
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
