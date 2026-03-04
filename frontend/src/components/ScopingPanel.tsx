import { useState, useEffect, useCallback } from "react";
import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  MessageSquare,
  FileCode,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import type { EnrichedIssue, ScopingSession, ScopingAction } from "../types";
import { startScoping, getScopingSession, sendScopingFeedback } from "../services/api";

interface ScopingPanelProps {
  issue: EnrichedIssue;
  onClose: () => void;
  onApproved: (session: ScopingSession) => void;
}

export function ScopingPanel({ issue, onClose, onApproved }: ScopingPanelProps) {
  const [session, setSession] = useState<ScopingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackAction, setFeedbackAction] = useState<ScopingAction | null>(null);
  const [sending, setSending] = useState(false);

  const startSession = useCallback(async () => {
    setLoading(true);
    try {
      const s = await startScoping(issue.repo, issue.issue.number);
      setSession(s);
    } catch {
      // ignore
    }
    setLoading(false);
  }, [issue.repo, issue.issue.number]);

  useEffect(() => {
    startSession();
  }, [startSession]);

  // Poll for session updates when running
  useEffect(() => {
    if (!session || session.status !== "running") return;
    const interval = setInterval(async () => {
      try {
        const updated = await getScopingSession(session.session_id);
        setSession(updated);
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [session]);

  const handleAction = async (action: ScopingAction) => {
    if (!session) return;
    if ((action === "challenge" || action === "modify") && !feedbackText.trim()) {
      setFeedbackAction(action);
      return;
    }

    setSending(true);
    try {
      const updated = await sendScopingFeedback(
        session.session_id,
        action,
        feedbackText
      );
      setSession(updated);
      setFeedbackText("");
      setFeedbackAction(null);

      if (action === "approve") {
        onApproved(updated);
      }
    } catch {
      // ignore
    }
    setSending(false);
  };

  const sendFeedback = async () => {
    if (!feedbackAction || !feedbackText.trim()) return;
    await handleAction(feedbackAction);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl mb-16">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Scoping: #{issue.issue.number}
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">{issue.issue.title}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {loading && (
            <div className="flex items-center gap-3 justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-zinc-400">Starting Devin scoping session...</span>
            </div>
          )}

          {session && !loading && (
            <>
              {/* Session status */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-zinc-400">Session:</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  session.status === "completed" || session.status === "approved"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : session.status === "running"
                    ? "bg-blue-500/20 text-blue-300"
                    : session.status === "error" || session.status === "rejected"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-zinc-700 text-zinc-400"
                }`}>
                  {session.status}
                </span>
                {session.devin_session_url && (
                  <a
                    href={session.devin_session_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View in Devin
                  </a>
                )}
              </div>

              {/* Plan display */}
              {session.plan && (
                <div className="space-y-4">
                  <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <FileCode className="w-3.5 h-3.5" />
                        Affected Files
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {session.plan.affected_files.map((f, i) => (
                          <span key={i} className="px-2 py-0.5 bg-zinc-700 rounded text-xs font-mono text-zinc-300">{f}</span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <ArrowRight className="w-3.5 h-3.5" />
                        Step-by-Step Plan
                      </h4>
                      <ol className="space-y-1.5">
                        {session.plan.step_by_step_plan.map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                            <span className="text-indigo-400 font-mono text-xs mt-0.5 shrink-0">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                        Files to Modify/Create
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {session.plan.files_to_modify.map((f, i) => (
                          <span key={i} className="px-2 py-0.5 bg-zinc-700 rounded text-xs font-mono text-zinc-300">{f}</span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Confidence</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-indigo-400">{session.plan.confidence_score}%</span>
                          <span className="text-xs text-zinc-400">{session.plan.confidence_rationale}</span>
                        </div>
                      </div>
                    </div>

                    {session.plan.risks_and_assumptions.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          Risks & Assumptions
                        </h4>
                        <ul className="space-y-1">
                          {session.plan.risks_and_assumptions.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-amber-200">
                              <span className="text-amber-400 mt-0.5">•</span>
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Conversation thread */}
              {session.conversation.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Conversation
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {session.conversation.map((msg, i) => (
                      <div
                        key={i}
                        className={`px-3 py-2 rounded-lg text-sm ${
                          msg.role === "user"
                            ? "bg-indigo-600/20 text-indigo-200 ml-8"
                            : msg.role === "error"
                            ? "bg-red-600/20 text-red-200"
                            : msg.role === "system"
                            ? "bg-zinc-800 text-zinc-400"
                            : "bg-zinc-800/50 text-zinc-300 mr-8"
                        }`}
                      >
                        <span className="text-xs font-medium opacity-60 uppercase">{msg.role}</span>
                        <p className="mt-0.5">{msg.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Feedback input (for challenge/modify) */}
              {feedbackAction && (
                <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-zinc-300">
                    {feedbackAction === "challenge"
                      ? "Flag a specific step you want to challenge:"
                      : "Describe the scope change you want:"}
                  </p>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Enter your feedback..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={sendFeedback}
                      disabled={sending || !feedbackText.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
                    >
                      {sending ? "Sending..." : "Send Feedback"}
                    </button>
                    <button
                      onClick={() => { setFeedbackAction(null); setFeedbackText(""); }}
                      className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {session.status !== "approved" && session.status !== "rejected" && !feedbackAction && (
                <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => handleAction("approve")}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => setFeedbackAction("challenge")}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    Challenge
                  </button>
                  <button
                    onClick={() => setFeedbackAction("modify")}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Modify
                  </button>
                  <button
                    onClick={() => handleAction("reject")}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                </div>
              )}

              {session.status === "approved" && (
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-4 py-3 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Plan approved. Ready for execution.</span>
                </div>
              )}

              {session.status === "rejected" && (
                <div className="flex items-center gap-2 text-red-400 bg-red-500/10 px-4 py-3 rounded-lg">
                  <XCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Plan rejected. No code changes will be made.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
