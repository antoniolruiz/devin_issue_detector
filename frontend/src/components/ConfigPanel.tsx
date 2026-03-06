import { useState, useEffect } from "react";
import { Settings, Check, X, Eye, EyeOff } from "lucide-react";
import type { ConfigStatus } from "../types";
import { getConfigStatus, updateConfig } from "../services/api";

export function ConfigPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [githubToken, setGithubToken] = useState("");
  const [devinToken, setDevinToken] = useState("");
  const [devinOrgId, setDevinOrgId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    getConfigStatus().then(setStatus).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig({
        github_token: githubToken || undefined,
        devin_api_token: devinToken || undefined,
        devin_org_id: devinOrgId || undefined,
      });
      const newStatus = await getConfigStatus();
      setStatus(newStatus);
      setGithubToken("");
      setDevinToken("");
      setDevinOrgId("");
    } catch {
      // ignore
    }
    setSaving(false);
  };

  const StatusDot = ({ configured }: { configured: boolean }) => (
    <span className={`inline-flex items-center gap-1 text-xs ${configured ? "text-emerald-400" : "text-zinc-500"}`}>
      {configured ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {configured ? "Connected" : "Not set"}
    </span>
  );

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-300 transition-colors"
      >
        <Settings className="w-4 h-4" />
        API Keys
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 w-96 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-zinc-200">API Configuration</h3>
            <button onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-400">GitHub Token</label>
                {status && <StatusDot configured={status.github_configured} />}
              </div>
              <input
                type={showTokens ? "text" : "password"}
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-400">Devin API Token</label>
                {status && <StatusDot configured={status.devin_configured} />}
              </div>
              <input
                type={showTokens ? "text" : "password"}
                value={devinToken}
                onChange={(e) => setDevinToken(e.target.value)}
                placeholder="cog_..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-400">Devin Org ID</label>
              </div>
              <input
                type={showTokens ? "text" : "password"}
                value={devinOrgId}
                onChange={(e) => setDevinOrgId(e.target.value)}
                placeholder="org_..."
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setShowTokens(!showTokens)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300"
              >
                {showTokens ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showTokens ? "Hide" : "Show"} values
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
