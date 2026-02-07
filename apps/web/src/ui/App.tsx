import React, { useEffect, useState } from "react";

import { getResult, getState, startInterview, submitAnswer, type InterviewStateResponse } from "./api";

type ChatMsg = { role: "ai" | "user"; text: string };

const LS_SESSION = "interview.sessionId";

export function App() {
  const [role, setRole] = useState("backend");
  const [level, setLevel] = useState<"junior" | "mid" | "senior">("mid");

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
      const s = await startInterview({ role, level });
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
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div style={{ color: "#e5e7eb", fontWeight: 700, fontSize: 18 }}>Multi-Round Interview Orchestrator</div>
          <div className="small">Deterministic flow + explainable scoring (AI only for language/eval JSON).</div>
        </div>
        <span className="badge">Session: {sessionId ? sessionId.slice(0, 8) : "none"}</span>
      </div>

      <div className="grid">
        <div className="card">
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <input className="input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="role" />
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value as any)}>
              <option value="junior">junior</option>
              <option value="mid">mid</option>
              <option value="senior">senior</option>
            </select>
            <button className="button primary" onClick={onStart} disabled={busy}>
              Start
            </button>
            <button className="button" onClick={onClear} disabled={busy}>
              Clear
            </button>
          </div>

          <div className="chat" aria-label="chat">
            {messages.length === 0 && !state?.activeQuestion && (
              <div className="small">Click Start to begin (or resume via stored session).</div>
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
                if (e.key === "Enter") onSend();
              }}
              placeholder={state?.activeQuestion ? "Type your answer" : "Start an interview first"}
              disabled={busy || !state?.activeQuestion}
            />
            <button className="button primary" onClick={onSend} disabled={busy || !state?.activeQuestion}>
              Send
            </button>
          </div>
          {error && (
            <div className="small" style={{ color: "#fca5a5", marginTop: 10 }}>
              {error}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }}>State</div>
          <div className="kv">
            <div className="small">state</div>
            <div>{state?.state ?? "—"}</div>
            <div className="small">round</div>
            <div>{state?.currentRound ?? "—"}</div>
          </div>

          <hr />
          <div style={{ color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }}>Progress</div>
          <div className="small">
            {(state?.progress ?? []).map((p, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600 }}>{p.roundType}</div>
                <div>
                  answers: {p.answers} / asked: {p.questionsAsked}
                </div>
                <div>
                  verdict: {p.verdict ?? "—"} | score: {p.weightedScore ?? "—"}
                </div>
              </div>
            ))}
          </div>

          <hr />
          <div style={{ color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }}>Result</div>
          {!result && <div className="small">Complete the interview to see final decision.</div>}
          {result && <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(result, null, 2)}</pre>}
        </div>
      </div>
    </div>
  );
}
