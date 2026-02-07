import React, { useEffect, useState } from "react";
import { extractResumeText } from "../lib/fileParsing";

import { getResult, getState, startInterview, submitAnswer, type InterviewStateResponse } from "./api";

type ChatMsg = { role: "ai" | "user"; text: string };

const LS_SESSION = "interview.sessionId";

export function App() {
  const [role, setRole] = useState("backend");
  const [level, setLevel] = useState<"junior" | "mid" | "senior">("mid");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string>("");

  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem(LS_SESSION) ?? "");
  const [state, setState] = useState<InterviewStateResponse | null>(null);
  const [result, setResult] = useState<any>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        setBusy(true);
        setError(null);
        const s = await getState(sessionId);
        setState(s);
        if (s.activeQuestion) setMessages([{ role: "ai", text: s.activeQuestion.prompt }]);
        if (s.state === "FINAL_DECISION" || s.state === "REJECTED") {
          const r = await getResult(s.sessionId);
          setResult(r);
        }
      } catch (e: any) {
        setError(String(e?.message ?? e));
      } finally {
        setBusy(false);
      }
    })();
  }, [sessionId]);

  async function onStart() {
    setError(null);
    setResult(null);
    setMessages([]);
    setBusy(true);
    try {
      const params: any = { role, level };

      // Include resume if uploaded
      if (resumeFile && resumeText) {
        params.resumeText = resumeText;
        params.resumeFileName = resumeFile.name;
      }

      const s = await startInterview(params);
      setState(s);
      setSessionId(s.sessionId);
      localStorage.setItem(LS_SESSION, s.sessionId);
      if (s.activeQuestion) setMessages([{ role: "ai", text: s.activeQuestion.prompt }]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setError(null);
    setBusy(true); // Show busy state while parsing

    try {
      const text = await extractResumeText(file);
      setResumeText(text);
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
      setResumeFile(null);
      setResumeText("");
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!state?.activeQuestion) return;
    const answer = input.trim();
    if (!answer) return;

    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text: answer }]);
    setBusy(true);

    try {
      const s = await submitAnswer({
        sessionId: state.sessionId,
        questionId: state.activeQuestion.id,
        answer
      });
      setState(s);
      if (s.activeQuestion) setMessages((m) => [...m, { role: "ai", text: s.activeQuestion!.prompt }]);

      if (s.state === "FINAL_DECISION" || s.state === "REJECTED") {
        const r = await getResult(s.sessionId);
        setResult(r);
      }
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function onClear() {
    localStorage.removeItem(LS_SESSION);
    setSessionId("");
    setState(null);
    setResult(null);
    setMessages([]);
    setError(null);
    setInput("");
    setResumeFile(null);
    setResumeText("");
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 20 }}>Multi-Round Interview Orchestrator</div>
          <div className="small">Round 1: Resume + Communication | Round 2: Technical | Round 3: Scenario</div>
        </div>
        <span className="badge">Session: {sessionId ? sessionId.slice(0, 8) : "none"}</span>
      </div>

      {!sessionId && (
        <div className="info-banner">
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>📋 Round 1: SCREENING</div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Upload your resume (optional) for AI-powered analysis. We'll assess your <strong>communication skills</strong>,
            <strong> experience relevance</strong>, and <strong>professional presentation</strong>.
          </div>
        </div>
      )}

      <div className="grid">
        <div className="card">
          {!sessionId && (
            <>
              <div className="resume-upload-section">
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 18 }}>📄</span>
                  <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>
                    Step 1: Upload Your Resume {" "}
                    <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 13 }}>(Optional)</span>
                  </div>
                </div>

                <div className="file-upload-wrapper">
                  <input
                    type="file"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={onFileChange}
                    disabled={busy}
                    id="resume-input"
                    style={{ display: "none" }}
                  />
                  <label htmlFor="resume-input" className="file-upload-label">
                    <span style={{ fontSize: 24, marginBottom: 8 }}>📎</span>
                    <span style={{ fontWeight: 500 }}>
                      {resumeFile ? resumeFile.name : "Click to upload or drag & drop"}
                    </span>
                    <span className="small" style={{ opacity: 0.7 }}>
                      Supports: .txt, .pdf, .doc, .docx
                    </span>
                  </label>
                </div>

                {resumeFile && (
                  <div className="resume-success">
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div>
                        <div style={{ fontWeight: 500, color: "#10b981" }}>
                          {resumeFile.name} loaded successfully
                        </div>
                        <div className="small" style={{ marginTop: 2 }}>
                          Size: {(resumeText.length / 1024).toFixed(1)} KB • Will be analyzed for SCREENING round
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height: 20 }} />

              <div style={{ marginBottom: 16 }}>
                <div style={{ color: "#e5e7eb", fontWeight: 600, marginBottom: 10, fontSize: 15 }}>
                  Step 2: Configure Interview
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <label className="small" style={{ display: "block", marginBottom: 4 }}>Target Role</label>
                    <input
                      className="input"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g., backend, frontend, fullstack"
                    />
                  </div>
                  <div style={{ flex: "1 1 150px" }}>
                    <label className="small" style={{ display: "block", marginBottom: 4 }}>Experience Level</label>
                    <select className="input" value={level} onChange={(e) => setLevel(e.target.value as any)}>
                      <option value="junior">Junior</option>
                      <option value="mid">Mid-Level</option>
                      <option value="senior">Senior</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <button className="button primary" onClick={onStart} disabled={busy} style={{ flex: 1 }}>
                  {busy ? "Starting..." : "🚀 Start Interview"}
                </button>
                <button className="button" onClick={onClear} disabled={busy}>
                  Clear
                </button>
              </div>
            </>
          )}

          {sessionId && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ color: "#e5e7eb", fontWeight: 600, fontSize: 15 }}>
                    Interview in Progress
                  </div>
                  <div className="small">
                    Current: <strong>{state?.currentRound || "—"}</strong> | State: <strong>{state?.state || "—"}</strong>
                  </div>
                </div>
                <button className="button" onClick={onClear} disabled={busy} style={{ fontSize: 12 }}>
                  End & Clear
                </button>
              </div>
            </>
          )}

          <div className="chat" aria-label="chat">
            {messages.length === 0 && !state?.activeQuestion && (
              <div style={{ textAlign: "center", padding: "40px 20px", opacity: 0.6 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
                <div className="small">
                  {sessionId ? "Loading interview state..." : "Configure your interview settings and click Start"}
                </div>
              </div>
            )}
            {messages.map((m, idx) => (
              <div key={idx} className={`msg ${m.role}`}>
                {m.text}
              </div>
            ))}
          </div>

          <div style={{ height: 10 }} />
          <div className="row">
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSend();
                }
              }}
              placeholder={state?.activeQuestion ? "Type your answer and press Enter..." : "Start an interview first"}
              disabled={busy || !state?.activeQuestion}
            />
            <button className="button primary" onClick={onSend} disabled={busy || !state?.activeQuestion}>
              {busy ? "..." : "Send"}
            </button>
          </div>
          {error && (
            <div className="error-message">
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ color: "#e5e7eb", fontWeight: 700, marginBottom: 12, fontSize: 16 }}>Interview Progress</div>

          {state && (
            <>
              <div className="progress-section">
                <div className="small" style={{ marginBottom: 8, opacity: 0.8 }}>ROUNDS</div>
                {(state?.progress ?? []).map((p, i) => (
                  <div key={i} className="round-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{p.roundType}</div>
                      {p.verdict && (
                        <span className={`verdict-badge ${p.verdict.toLowerCase()}`}>
                          {p.verdict}
                        </span>
                      )}
                    </div>
                    <div className="small" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
                      <div>Questions: {p.answers}/{p.questionsAsked}</div>
                      <div>Score: {p.weightedScore ?? "—"}/100</div>
                    </div>
                  </div>
                ))}
              </div>

              {state.memory && (state.memory.strengths.length > 0 || state.memory.weaknesses.length > 0) && (
                <>
                  <hr />
                  <div className="progress-section">
                    <div className="small" style={{ marginBottom: 8, opacity: 0.8 }}>INSIGHTS</div>
                    {state.memory.strengths.length > 0 && (
                      <div className="insight-card strength">
                        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>💪 Strengths</div>
                        {state.memory.strengths.slice(0, 3).map((s, i) => (
                          <div key={i} className="small" style={{ marginLeft: 12, marginTop: 2 }}>• {s}</div>
                        ))}
                      </div>
                    )}
                    {state.memory.weaknesses.length > 0 && (
                      <div className="insight-card weakness">
                        <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 4 }}>🎯 Areas to Improve</div>
                        {state.memory.weaknesses.slice(0, 3).map((w, i) => (
                          <div key={i} className="small" style={{ marginLeft: 12, marginTop: 2 }}>• {w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {!state && (
            <div style={{ textAlign: "center", padding: "20px", opacity: 0.5 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div className="small">Progress will appear here once you start</div>
            </div>
          )}

          <hr />
          <div style={{ color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }}>Final Result</div>
          {!result && <div className="small" style={{ opacity: 0.7 }}>Complete all rounds to see your final decision.</div>}
          {result && (
            <div className="result-card">
              <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
