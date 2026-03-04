import { useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";

interface RepoSelectorProps {
  repo: string;
  onRepoChange: (repo: string) => void;
  loading: boolean;
}

export function RepoSelector({ repo, onRepoChange, loading }: RepoSelectorProps) {
  const [input, setInput] = useState(repo);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (trimmed && trimmed.includes("/")) {
      onRepoChange(trimmed);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <div className="flex items-center gap-2 text-zinc-400">
        <GitBranch className="w-4 h-4" />
        <span className="text-sm font-medium">Repository</span>
      </div>
      <div className="flex-1 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="owner/repo"
          className="flex-1 max-w-md px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? "Loading..." : "Load Issues"}
        </button>
      </div>
    </form>
  );
}
