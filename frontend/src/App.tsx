import { useState, useCallback, useMemo } from "react";
import { Sparkles, Loader2, Bug } from "lucide-react";
import { ConfigPanel } from "./components/ConfigPanel";
import { RepoSelector } from "./components/RepoSelector";
import { IssueFilters } from "./components/IssueFilters";
import { IssueRow } from "./components/IssueRow";
import { ScopingPanel } from "./components/ScopingPanel";
import { ExecutionPanel } from "./components/ExecutionPanel";
import { fetchIssues, enrichAllIssues } from "./services/api";
import type {
  EnrichedIssue,
  FilterState,
  SortField,
  SortDirection,
  ScopingSession,
} from "./types";

function App() {
  const [repo, setRepo] = useState("antoniolruiz/devin_demo_v2");
  const [issues, setIssues] = useState<EnrichedIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState("");

  const [filters, setFilters] = useState<FilterState>({
    category: "",
    complexity: "",
    confidenceMin: 0,
    confidenceMax: 100,
    status: "",
    search: "",
  });
  const [sortField, setSortField] = useState<SortField>("number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Scoping & execution state
  const [scopingIssue, setScopingIssue] = useState<EnrichedIssue | null>(null);
  const [approvedSession, setApprovedSession] = useState<ScopingSession | null>(null);

  const handleRepoChange = useCallback(async (newRepo: string) => {
    setRepo(newRepo);
    setIssues([]);
    setError("");
    setLoading(true);
    try {
      const fetched = await fetchIssues(newRepo);
      setIssues(fetched);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch issues");
    }
    setLoading(false);
  }, []);

  const handleEnrichAll = async () => {
    setEnriching(true);
    try {
      const enriched = await enrichAllIssues(repo);
      setIssues(enriched);
    } catch {
      // ignore
    }
    setEnriching(false);
  };

  const handleIssueUpdate = (updated: EnrichedIssue) => {
    setIssues((prev) =>
      prev.map((i) =>
        i.issue.number === updated.issue.number ? updated : i
      )
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  // Extract unique categories from labels
  const categories = useMemo(() => {
    const cats = new Set<string>();
    issues.forEach((i) => i.issue.labels.forEach((l) => cats.add(l.name)));
    return Array.from(cats).sort();
  }, [issues]);

  // Filter and sort issues
  const filteredIssues = useMemo(() => {
    let result = [...issues];

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (i) =>
          i.issue.title.toLowerCase().includes(q) ||
          i.issue.body.toLowerCase().includes(q) ||
          i.enrichment.summary.toLowerCase().includes(q)
      );
    }
    if (filters.category) {
      result = result.filter((i) =>
        i.issue.labels.some((l) => l.name === filters.category)
      );
    }
    if (filters.complexity) {
      result = result.filter((i) => i.enrichment.complexity === filters.complexity);
    }
    if (filters.status) {
      result = result.filter((i) => i.status === filters.status);
    }
    result = result.filter(
      (i) =>
        i.enrichment.confidence_score >= filters.confidenceMin &&
        i.enrichment.confidence_score <= filters.confidenceMax
    );

    const dir = sortDirection === "asc" ? 1 : -1;
    result.sort((a, b) => {
      switch (sortField) {
        case "confidence":
          return (a.enrichment.confidence_score - b.enrichment.confidence_score) * dir;
        case "complexity":
          return (a.enrichment.complexity === b.enrichment.complexity ? 0 : a.enrichment.complexity === "Easy" ? -1 : 1) * dir;
        case "impact":
          return a.enrichment.impact.localeCompare(b.enrichment.impact) * dir;
        case "number":
        default:
          return (a.issue.number - b.issue.number) * dir;
      }
    });

    return result;
  }, [issues, filters, sortField, sortDirection]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Bug className="w-6 h-6 text-indigo-400" />
              <h1 className="text-xl font-bold text-zinc-100">Issue Dashboard</h1>
              <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                Powered by Devin
              </span>
            </div>
            <ConfigPanel />
          </div>
          <RepoSelector repo={repo} onRepoChange={handleRepoChange} loading={loading} />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {issues.length > 0 && (
          <>
            {/* Stats bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm text-zinc-400">
                  {filteredIssues.length} of {issues.length} issues
                </span>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                    {issues.filter((i) => i.status === "Open").length} Open
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    {issues.filter((i) => i.status === "In Progress").length} In Progress
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {issues.filter((i) => i.status === "Resolved").length} Resolved
                  </span>
                </div>
              </div>
              <button
                onClick={handleEnrichAll}
                disabled={enriching}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-lg text-sm font-medium transition-colors"
              >
                {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {enriching ? "Enriching..." : "Enrich All with AI"}
              </button>
            </div>

            {/* Filters */}
            <IssueFilters
              filters={filters}
              onFilterChange={setFilters}
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={handleSort}
              categories={categories}
            />

            {/* Issue list */}
            <div className="space-y-2">
              {filteredIssues.map((issue) => (
                <IssueRow
                  key={issue.issue.number}
                  issue={issue}
                  onUpdate={handleIssueUpdate}
                  onScope={setScopingIssue}
                />
              ))}
            </div>

            {filteredIssues.length === 0 && (
              <div className="text-center py-12 text-zinc-500">
                No issues match the current filters.
              </div>
            )}
          </>
        )}

        {!loading && issues.length === 0 && !error && (
          <div className="text-center py-24 space-y-4">
            <Bug className="w-12 h-12 text-zinc-700 mx-auto" />
            <h2 className="text-lg font-medium text-zinc-400">No issues loaded</h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto">
              Enter a GitHub repository above and click &quot;Load Issues&quot; to fetch and display issues.
              The default repository is <code className="text-indigo-400">antoniolruiz/devin_demo_v2</code>.
            </p>
          </div>
        )}
      </main>

      {/* Scoping panel */}
      {scopingIssue && !approvedSession && (
        <ScopingPanel
          issue={scopingIssue}
          onClose={() => setScopingIssue(null)}
          onApproved={(session) => setApprovedSession(session)}
        />
      )}

      {/* Execution panel */}
      {approvedSession && (
        <ExecutionPanel
          scopingSession={approvedSession}
          onClose={() => {
            setApprovedSession(null);
            setScopingIssue(null);
          }}
        />
      )}
    </div>
  );
}

export default App
