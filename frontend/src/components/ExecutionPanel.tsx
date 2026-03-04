import { useState, useEffect } from "react";
import {
  X,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  GitPullRequest,
  MessageSquare,
  AlertTriangle,
  Play,
} from "lucide-react";
import type { ScopingSession, ExecutionSession, PRAction } from "../types";
import { startExecution, getExecutionSession, sendPRAction } from "../services/api";

interface ExecutionPanelProps {
  scopingSession: ScopingSession;
  onClose: () => void;
}

export function ExecutionPanel({ scopingSession, onClose }: ExecutionPanelProps) {
  const [session, setSession] = useState<ExecutionSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [sending, setSending] = useState(false);
  const [started, setStarted] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    setStarted(true);
    try {
      const s = await startExecution(scopingSession.session_id);
      setSession(s);
    } catch {
      // ignore
    }
    setLoading(false);
  };

  // Poll for session updates when running
  useEffect(() => {
    if (!session || (session.status !== "Running" && session.status !== "Pending")) return;
    const interval = setInterval(async () => {
      try {
        const updated = await getExecutionSession(session.session_id);
        setSession(updated);
      } catch {
        // ignore
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [session]);

  const handlePRAction = async (action: PRAction) => {
    if (!session) return;
    if (action === "request_changes" && !feedbackText.trim()) {
      setShowFeedback(true);
      return;
    }

    setSending(true);
    try {
      const updated = await sendPRAction(session.session_id, action, feedbackText);
      setSession(updated);
      setFeedbackText("");
      setShowFeedback(false);
    } catch {
      // ignore
    }
    setSending(false);
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "Success": return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "Failed": return <XCircle className="w-5 h-5 text-red-400" />;
      case "Running": return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case "Partial": return <AlertTriangle className="w-5 h-5 text-amber-400" />;
      default: return <Loader2 className="w-5 h-5 text-zinc-400" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "Success": return "bg-emerald-500/20 text-emerald-300";
      case "Failed": return "bg-red-500/20 text-red-300";
      case "Running": return "bg-blue-500/20 text-blue-300";
      case "Partial": return "bg-amber-500/20 text-amber-300";
      default: return "bg-zinc-700 text-zinc-400";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl mb-16">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-indigo-400" />
              Execution: #{scopingSession.issue_number}
            </h2>
            <p className="text-sm text-zinc-400 mt-0.5">{scopingSession.repo}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {!started && (
            <div className="text-center py-8 space-y-4">
              <p className="text-sm text-zinc-400">
                The scoping plan has been approved. Start execution to implement the changes and create a PR.
              </p>
              <button
                onClick={handleStart}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-medium text-white transition-colors"
              >
                <Play className="w-4 h-4" />
                Start Execution
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-3 justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-zinc-400">Starting Devin execution session...</span>
            </div>
          )}

          {session && !loading && (
            <>
              {/* Status */}
              <div className="flex items-center gap-3">
                {statusIcon(session.status)}
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColor(session.status)}`}>
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

              {/* PR info */}
              {session.pr_url && (
                <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GitPullRequest className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-medium text-zinc-200">Pull Request</span>
                    <a
                      href={session.pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      #{session.pr_number}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Diff summary */}
                  {session.diff_summary && (
                    <div>
                      <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Diff Summary</h4>
                      <pre className="text-xs text-zinc-300 bg-zinc-900 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto font-mono whitespace-pre">
                        {session.diff_summary}
                      </pre>
                    </div>
                  )}

                  {/* Deviations */}
                  {session.deviations.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Deviations from Plan
                      </h4>
                      <ul className="space-y-1">
                        {session.deviations.map((d, i) => (
                          <li key={i} className="text-sm text-amber-200 flex items-start gap-2">
                            <span className="text-amber-400 mt-0.5">•</span>
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Conversation thread */}
              {session.conversation.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Activity
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

              {/* Feedback for request changes */}
              {showFeedback && (
                <div className="bg-zinc-800/50 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-zinc-300">Describe what changes you want:</p>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="Enter your feedback..."
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 resize-none"
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePRAction("request_changes")}
                      disabled={sending || !feedbackText.trim()}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded-lg text-sm font-medium text-white"
                    >
                      {sending ? "Sending..." : "Send Feedback"}
                    </button>
                    <button
                      onClick={() => { setShowFeedback(false); setFeedbackText(""); }}
                      className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* PR action buttons */}
              {session.pr_url && session.status !== "Failed" && !showFeedback && (
                <div className="flex items-center gap-3 pt-2 border-t border-zinc-800">
                  <button
                    onClick={() => handlePRAction("accept")}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium text-white transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Accept & Merge
                  </button>
                  <button
                    onClick={() => setShowFeedback(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Request Changes
                  </button>
                  <button
                    onClick={() => handlePRAction("reject")}
                    disabled={sending}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject PR
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
