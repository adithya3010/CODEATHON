import { useEffect, useState } from "react";
import "./styles.css";

import {
  startInterview,
  getState,
  submitAnswer as submitAnswerApi,
  type InterviewStateResponse,
} from "./api";

const LS_SESSION = "interview.sessionId";

type ChatMsg = { role: "ai" | "user"; text: string };

export function App() {
  const [role, setRole] = useState("Frontend Developer");
  const [level, setLevel] = useState<"junior" | "mid" | "senior">("mid");

  const [sessionId, setSessionId] = useState<string>(() => localStorage.getItem(LS_SESSION) ?? "");
  const [state, setState] = useState<InterviewStateResponse | null>(null);
  const [result, setResult] = useState<any>(null);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) fetchState();
  }, [sessionId]);

  async function fetchState() {
    try {
      const s = await getState(sessionId);
      if (s) {
        setState(s);
        if (s.activeQuestion && messages.length === 0) {
          setMessages([{ role: "ai", text: s.activeQuestion.prompt }]);
        }
      }
    } catch (e: any) {
      if (e?.status === 404) {
        onClear();
      }
    }
  }

  async function onStart() {
    setError(null);
    setBusy(true);
    try {
      const params: any = { role, level };
      const s = await startInterview(params);
      localStorage.setItem(LS_SESSION, s.sessionId);
      setSessionId(s.sessionId);
      setState(s);
      if (s.activeQuestion) {
        setMessages([{ role: "ai", text: s.activeQuestion.prompt }]);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to start interview");
    } finally {
      setBusy(false);
    }
  }

  async function onSend() {
    if (!state?.activeQuestion || !input.trim()) return;
    setError(null);
    setBusy(true);
    const userMsg = input.trim();
    const previousRound = state?.currentRound;
    setMessages((prev) => [...prev, { role: "user", text: userMsg }]);
    setInput("");

    try {
      let res = await submitAnswerApi({ sessionId, answer: userMsg, questionId: state.activeQuestion.id });
      setState(res);

      // Check if we moved to a new round
      if (res.currentRound && res.currentRound !== previousRound && res.activeQuestion) {
        // New round started - add announcement and first question
        setMessages((prev) => [
          ...prev,
          { role: "ai", text: `✅ ${previousRound} completed! Moving to ${res.currentRound}...` },
          { role: "ai", text: res.activeQuestion!.prompt }
        ]);
      } else if (res.activeQuestion) {
        // Same round, next question
        setMessages((prev) => [...prev, { role: "ai", text: res.activeQuestion!.prompt }]);
      } else if (res.state === "FINAL_DECISION" || res.state === "REJECTED") {
        const finalMsg = res.state === "FINAL_DECISION"
          ? "🎉 Congratulations! You have successfully completed all rounds!"
          : "❌ Unfortunately, you did not pass this round.";
        setMessages((prev) => [...prev, { role: "ai", text: finalMsg }]);
        setResult(res);
      }
    } catch (e: any) {
      setError(e.message ?? "Failed to submit answer");
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

  const currentRound = state?.currentRound || 'SCREENING';
  const currentQuestionNum = state?.progress?.find(p => p.roundType === currentRound)?.answers ?? 0;
  const totalQuestions = state?.progress?.find(p => p.roundType === currentRound)?.questionsAsked ?? 3;

  const roundInfo: Record<string, { title: string; subtitle: string }> = {
    SCREENING: { title: 'Round 1', subtitle: 'Screening & Profiling Assessment' },
    TECHNICAL: { title: 'Round 2', subtitle: 'Technical Assessment' },
    SCENARIO: { title: 'Round 3', subtitle: 'Scenario-Based Assessment' }
  };

  const { title, subtitle } = roundInfo[currentRound] || roundInfo.SCREENING;
  const isFinished = state?.state === 'FINAL_DECISION' || state?.state === 'REJECTED';

  return (
    <div className="app-wrapper">
      <div className="main-container">
        {/* Header */}
        <header className="app-header">
          <h1 className="app-title">{sessionId ? title : 'Interview'}</h1>
          <p className="app-subtitle">{sessionId ? subtitle : 'AI-Powered Candidate Assessment'}</p>
        </header>

        {/* Progress Steps */}
        <div className="progress-steps">
          <div className={`step ${!sessionId ? 'active' : 'completed'}`}>
            <div className="step-circle">{sessionId ? '✓' : '1'}</div>
            <span className="step-label">Setup</span>
          </div>
          <div className={`step-connector ${sessionId ? 'completed' : ''}`}></div>
          <div className={`step ${currentRound === 'SCREENING' && sessionId ? 'active' : state?.progress?.find(p => p.roundType === 'SCREENING')?.verdict ? 'completed' : ''}`}>
            <div className="step-circle">{state?.progress?.find(p => p.roundType === 'SCREENING')?.verdict === 'PASS' ? '✓' : '2'}</div>
            <span className="step-label">Round 1</span>
          </div>
          <div className={`step-connector ${state?.progress?.find(p => p.roundType === 'SCREENING')?.verdict === 'PASS' ? 'completed' : ''}`}></div>
          <div className={`step ${currentRound === 'TECHNICAL' && sessionId ? 'active' : state?.progress?.find(p => p.roundType === 'TECHNICAL')?.verdict ? 'completed' : ''}`}>
            <div className="step-circle">{state?.progress?.find(p => p.roundType === 'TECHNICAL')?.verdict === 'PASS' ? '✓' : '3'}</div>
            <span className="step-label">Round 2</span>
          </div>
          <div className={`step-connector ${state?.progress?.find(p => p.roundType === 'TECHNICAL')?.verdict === 'PASS' ? 'completed' : ''}`}></div>
          <div className={`step ${currentRound === 'SCENARIO' && sessionId ? 'active' : state?.progress?.find(p => p.roundType === 'SCENARIO')?.verdict ? 'completed' : ''}`}>
            <div className="step-circle">{state?.progress?.find(p => p.roundType === 'SCENARIO')?.verdict === 'PASS' ? '✓' : '4'}</div>
            <span className="step-label">Round 3</span>
          </div>
          <div className={`step-connector ${state?.progress?.find(p => p.roundType === 'SCENARIO')?.verdict === 'PASS' ? 'completed' : ''}`}></div>
          <div className={`step ${state?.state === 'FINAL_DECISION' || state?.state === 'REJECTED' ? 'active' : ''}`}>
            <div className="step-circle">5</div>
            <span className="step-label">Results</span>
          </div>
        </div>

        {/* Setup Card - shown when no session */}
        {!sessionId && (
          <div className="card" style={{ maxWidth: 600, margin: '0 auto' }}>
            <h2 className="card-title">Configure Your Interview</h2>
            <p className="card-description">
              Answer 3 questions to help us understand your communication skills,
              problem-solving approach, and professional experience.
            </p>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target Role</label>
                <select
                  className="form-select"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Frontend Developer">Frontend Developer</option>
                  <option value="Backend Developer">Backend Developer</option>
                  <option value="Full Stack Developer">Full Stack Developer</option>
                  <option value="DevOps Engineer">DevOps Engineer</option>
                  <option value="Data Engineer">Data Engineer</option>
                  <option value="Mobile Developer">Mobile Developer (iOS/Android)</option>
                  <option value="QA Engineer">QA Engineer</option>
                  <option value="Machine Learning Engineer">Machine Learning Engineer</option>
                  <option value="Cloud Architect">Cloud Architect</option>
                  <option value="Security Engineer">Security Engineer</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Experience Level</label>
                <select
                  className="form-select"
                  value={level}
                  onChange={(e) => setLevel(e.target.value as any)}
                >
                  <option value="junior">Junior (0-2 years)</option>
                  <option value="mid">Mid-Level (2-5 years)</option>
                  <option value="senior">Senior (5+ years)</option>
                </select>
              </div>
            </div>

            <button
              className="btn btn-primary btn-full"
              onClick={onStart}
              disabled={busy}
            >
              {busy ? (
                <>
                  <span className="loading-dots">
                    <span></span><span></span><span></span>
                  </span>
                  Starting...
                </>
              ) : (
                <>🚀 Start Interview</>
              )}
            </button>

            {error && (
              <div className="error-alert">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* Interview Interface */}
        {sessionId && !isFinished && (
          <div className="chat-container">
            <div className="chat-main">
              <div className="chat-header">
                <h3 className="chat-title">Screening Interview</h3>
                <div className="question-counter">
                  <span>📝</span>
                  Question {currentQuestionNum + 1} of {totalQuestions}
                </div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div className="chat-empty">
                    <div className="chat-empty-icon">💬</div>
                    <p>Loading your first question...</p>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className={`message ${m.role}`}>
                      {m.text}
                    </div>
                  ))
                )}

                {busy && (
                  <div className="message ai" style={{ opacity: 0.7 }}>
                    <span className="loading-dots">
                      <span></span><span></span><span></span>
                    </span>
                    {' '}Analyzing your response...
                  </div>
                )}
              </div>

              <div className="chat-input-area">
                <input
                  type="text"
                  className="chat-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                  placeholder={state?.activeQuestion ? "Type your answer and press Enter..." : "Interview completed"}
                  disabled={busy || !state?.activeQuestion}
                />
                <button
                  className="btn btn-primary"
                  onClick={onSend}
                  disabled={busy || !state?.activeQuestion}
                >
                  Send
                </button>
              </div>

              {error && (
                <div className="error-alert">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="sidebar">
              {/* Profile Card */}
              {state?.profile && (
                <div className="profile-card">
                  <div className="profile-header">
                    <span>👤</span>
                    <span>Candidate Profile</span>
                  </div>
                  <div className="profile-content">{state.profile}</div>
                </div>
              )}

              {/* Progress Card */}
              <div className="sidebar-card">
                <div className="sidebar-title">Progress</div>
                {(state?.progress ?? []).map((p, i) => (
                  <div key={i} className="round-item">
                    <div className="round-header">
                      <span className="round-name">{p.roundType}</span>
                      {p.verdict && (
                        <span className={`verdict ${p.verdict.toLowerCase()}`}>
                          {p.verdict}
                        </span>
                      )}
                    </div>
                    <div className="round-stats">
                      <div>Questions: {p.answers}/{p.questionsAsked}</div>
                      <div>Score: {p.weightedScore ?? "—"}/100</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <button className="btn btn-secondary btn-full" onClick={onClear}>
                🔄 End & Start Over
              </button>
            </div>
          </div>
        )}

        {/* Results Interface */}
        {sessionId && isFinished && (
          <div className="results-container">
            <div className="results-header">
              <h1>{state?.state === 'FINAL_DECISION' ? '🎉 Selected!' : '❌ Not Selected'}</h1>
              <p>The interview process has concluded.</p>
            </div>

            <div className="results-grid">
              {(state?.progress ?? []).map((p, i) => (
                <div key={i} className={`result-card ${p.verdict === 'PASS' ? 'pass' : 'fail'}`}>
                  <h3>{p.roundType}</h3>

                  <div className="verdict-stripe">
                    <span className={`verdict-badge ${p.verdict === 'PASS' ? 'pass' : 'fail'}`}>{p.verdict}</span>
                    <span className="score-value">{p.weightedScore ?? 0}<span className="score-max">/100</span></span>
                  </div>

                  {p.feedback && (
                    <div className="round-feedback">
                      <p>"{p.feedback}"</p>
                    </div>
                  )}

                  {p.dimensions && (
                    <div className="dimensions-grid">
                      {Object.entries(p.dimensions).map(([key, val]) => (
                        <div key={key} className="dimension-item">
                          <span className="dim-label">{key}</span>
                          <div className="dim-bar">
                            <div className="dim-fill" style={{ width: `${(val / 10) * 100}%` }}></div>
                          </div>
                          <span className="dim-value">{val}/10</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="feedback-section">
              <div className="feedback-column">
                <h3>✅ Key Strengths</h3>
                <ul>
                  {(state?.memory?.strengths?.length ?? 0) > 0
                    ? state!.memory.strengths.map((s, i) => <li key={i}>{s}</li>)
                    : <li>No specific strengths noted.</li>}
                </ul>
              </div>
              <div className="feedback-column">
                <h3>💡 Areas for Improvement</h3>
                <ul>
                  {(state?.memory?.weaknesses?.length ?? 0) > 0
                    ? state!.memory.weaknesses.map((s, i) => <li key={i}>{s}</li>)
                    : <li>No specific improvements noted.</li>}
                </ul>
              </div>
            </div>

            {state?.profile && (
              <div className="profile-section">
                <h3>Candidate Profile Analysis</h3>
                <div className="profile-content">{state.profile}</div>
              </div>
            )}

            <button className="btn btn-primary btn-large" onClick={onClear}>
              Start New Interview
            </button>
          </div>
        )}

        {/* Session Badge */}
        {sessionId && (
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <span className="status-badge active">
              Session: {sessionId.slice(0, 8)}...
            </span>
          </div>
        )}
      </div>
    </div >
  );
}
