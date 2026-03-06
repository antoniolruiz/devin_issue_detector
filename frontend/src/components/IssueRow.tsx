import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Loader2,
  Crosshair,
} from "lucide-react";
import type { EnrichedIssue } from "../types";
import { enrichIssue } from "../services/api";

interface IssueRowProps {
  issue: EnrichedIssue;
  onUpdate: (issue: EnrichedIssue) => void;
  onScope: (issue: EnrichedIssue) => void;
}

export function IssueRow({ issue, onUpdate, onScope }: IssueRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const { enrichment } = issue;
  const hasEnrichment = enrichment.summary !== "" && !enrichment.is_fallback;

  const handleEnrich = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setEnriching(true);
    try {
      const enriched = await enrichIssue(issue.repo, issue.issue.number);
      onUpdate(enriched);
    } catch {
      // ignore
    }
    setEnriching(false);
  };

  const confidenceColor = (score: number) => {
    if (score >= 80) return "text-emerald-400";
    if (score >= 50) return "text-amber-400";
    return "text-red-400";
  };

  const statusColor = (status: string) => {
    if (status === "Open") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (status === "In Progress") return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  };

  const complexityColor = (c: string) => {
    if (c === "Easy") return "bg-emerald-500/20 text-emerald-300";
    return "bg-amber-500/20 text-amber-300";
  };

  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden transition-colors hover:border-zinc-700">
      {/* Compact row */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="text-zinc-500">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <span className="text-xs font-mono text-zinc-500 w-8">#{issue.issue.number}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 truncate">{issue.issue.title}</span>
            {issue.issue.labels.map((label) => (
              <span
                key={label.name}
                className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700"
              >
                {label.name}
              </span>
            ))}
          </div>
        </div>

        {hasEnrichment && (
          <>
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${complexityColor(enrichment.complexity)}`}>
              {enrichment.complexity}
            </span>
            <span className={`text-sm font-semibold tabular-nums w-12 text-right ${confidenceColor(enrichment.confidence_score)}`}>
              {enrichment.confidence_score}%
            </span>
          </>
        )}

        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColor(issue.status)}`}>
          {issue.status}
        </span>

        {!hasEnrichment && (
          <button
            onClick={handleEnrich}
            disabled={enriching}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 text-xs font-medium transition-colors"
          >
            {enriching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Enrich
          </button>
        )}
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-zinc-800 space-y-4">
          {hasEnrichment ? (
            <>
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Summary</h4>
                <p className="text-sm text-zinc-300 leading-relaxed">{enrichment.summary}</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Complexity</h4>
                  <span className={`text-sm font-medium px-2 py-0.5 rounded ${complexityColor(enrichment.complexity)}`}>
                    {enrichment.complexity}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Confidence</h4>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          enrichment.confidence_score >= 80 ? "bg-emerald-500" :
                          enrichment.confidence_score >= 50 ? "bg-amber-500" : "bg-red-500"
                        }`}
                        style={{ width: `${enrichment.confidence_score}%` }}
                      />
                    </div>
                    <span className={`text-sm font-semibold ${confidenceColor(enrichment.confidence_score)}`}>
                      {enrichment.confidence_score}%
                    </span>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Status</h4>
                  <span className={`text-sm px-2 py-0.5 rounded-full border ${statusColor(issue.status)}`}>
                    {issue.status}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Impact</h4>
                <p className="text-sm text-zinc-300">{enrichment.impact}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Suggested Next Steps</h4>
                <ul className="space-y-1">
                  {enrichment.suggested_next_steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="text-indigo-400 mt-0.5">•</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onScope(issue); }}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors"
                >
                  <Crosshair className="w-4 h-4" />
                  Scope with Devin
                </button>
                <a
                  href={issue.issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on GitHub
                </a>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Description</h4>
                <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {issue.issue.body || "No description provided."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEnrich}
                  disabled={enriching}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-lg text-sm font-medium transition-colors"
                >
                  {enriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Enrich with AI
                </button>
                <a
                  href={issue.issue.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View on GitHub
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
