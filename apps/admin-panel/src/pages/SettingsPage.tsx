import React from 'react';
import { Globe, KeyRound } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-1">System Settings & Integrations</h2>
        <p className="text-xs text-slate-500">
          Configure external FFXIV plugin access keys and world settings.
        </p>
      </div>

      {/* World info card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-emerald-600 font-semibold text-sm">
          <Globe className="w-4 h-4" />
          <span>Configured Universalis In-Game World</span>
        </div>
        <p className="text-xs text-slate-500">
          Prices and market listings are automatically synced for:
        </p>
        <div className="inline-block px-3 py-1 bg-slate-50 border border-slate-200 rounded-md font-mono text-sm text-emerald-600 font-bold">
          Louisoix (Chaos DC)
        </div>
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
