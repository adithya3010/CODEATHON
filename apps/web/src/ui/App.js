import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { getResult, getState, startInterview, submitAnswer } from "./api";
const LS_SESSION = "interview.sessionId";
export function App() {
    const [role, setRole] = useState("backend");
    const [level, setLevel] = useState("mid");
    const [sessionId, setSessionId] = useState(() => localStorage.getItem(LS_SESSION) ?? "");
    const [state, setState] = useState(null);
    const [result, setResult] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        (async () => {
            if (!sessionId)
                return;
            try {
                setBusy(true);
                setError(null);
                const s = await getState(sessionId);
                setState(s);
                if (s.activeQuestion)
                    setMessages([{ role: "ai", text: s.activeQuestion.prompt }]);
                if (s.state === "FINAL_DECISION" || s.state === "REJECTED") {
                    const r = await getResult(s.sessionId);
                    setResult(r);
                }
            }
            catch (e) {
                setError(String(e?.message ?? e));
            }
            finally {
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
            if (s.activeQuestion)
                setMessages([{ role: "ai", text: s.activeQuestion.prompt }]);
        }
        catch (e) {
            setError(String(e?.message ?? e));
        }
        finally {
            setBusy(false);
        }
    }
    async function onSend() {
        if (!state?.activeQuestion)
            return;
        const answer = input.trim();
        if (!answer)
            return;
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
            if (s.activeQuestion)
                setMessages((m) => [...m, { role: "ai", text: s.activeQuestion.prompt }]);
            if (s.state === "FINAL_DECISION" || s.state === "REJECTED") {
                const r = await getResult(s.sessionId);
                setResult(r);
            }
        }
        catch (e) {
            setError(String(e?.message ?? e));
        }
        finally {
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
    return (_jsxs("div", { className: "container", children: [_jsxs("div", { className: "header", children: [_jsxs("div", { children: [_jsx("div", { style: { color: "#e5e7eb", fontWeight: 700, fontSize: 18 }, children: "Multi-Round Interview Orchestrator" }), _jsx("div", { className: "small", children: "Deterministic flow + explainable scoring (AI only for language/eval JSON)." })] }), _jsxs("span", { className: "badge", children: ["Session: ", sessionId ? sessionId.slice(0, 8) : "none"] })] }), _jsxs("div", { className: "grid", children: [_jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }, children: [_jsx("input", { className: "input", value: role, onChange: (e) => setRole(e.target.value), placeholder: "role" }), _jsxs("select", { className: "input", value: level, onChange: (e) => setLevel(e.target.value), children: [_jsx("option", { value: "junior", children: "junior" }), _jsx("option", { value: "mid", children: "mid" }), _jsx("option", { value: "senior", children: "senior" })] }), _jsx("button", { className: "button primary", onClick: onStart, disabled: busy, children: "Start" }), _jsx("button", { className: "button", onClick: onClear, disabled: busy, children: "Clear" })] }), _jsxs("div", { className: "chat", "aria-label": "chat", children: [messages.length === 0 && !state?.activeQuestion && (_jsx("div", { className: "small", children: "Click Start to begin (or resume via stored session)." })), messages.map((m, idx) => (_jsx("div", { className: `msg ${m.role}`, children: m.text }, idx)))] }), _jsx("div", { style: { height: 10 } }), _jsxs("div", { className: "row", children: [_jsx("input", { className: "input", value: input, onChange: (e) => setInput(e.target.value), onKeyDown: (e) => {
                                            if (e.key === "Enter")
                                                onSend();
                                        }, placeholder: state?.activeQuestion ? "Type your answer" : "Start an interview first", disabled: busy || !state?.activeQuestion }), _jsx("button", { className: "button primary", onClick: onSend, disabled: busy || !state?.activeQuestion, children: "Send" })] }), error && (_jsx("div", { className: "small", style: { color: "#fca5a5", marginTop: 10 }, children: error }))] }), _jsxs("div", { className: "card", children: [_jsx("div", { style: { color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }, children: "State" }), _jsxs("div", { className: "kv", children: [_jsx("div", { className: "small", children: "state" }), _jsx("div", { children: state?.state ?? "—" }), _jsx("div", { className: "small", children: "round" }), _jsx("div", { children: state?.currentRound ?? "—" })] }), _jsx("hr", {}), _jsx("div", { style: { color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }, children: "Progress" }), _jsx("div", { className: "small", children: (state?.progress ?? []).map((p, i) => (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsx("div", { style: { fontWeight: 600 }, children: p.roundType }), _jsxs("div", { children: ["answers: ", p.answers, " / asked: ", p.questionsAsked] }), _jsxs("div", { children: ["verdict: ", p.verdict ?? "—", " | score: ", p.weightedScore ?? "—"] })] }, i))) }), _jsx("hr", {}), _jsx("div", { style: { color: "#e5e7eb", fontWeight: 700, marginBottom: 8 }, children: "Result" }), !result && _jsx("div", { className: "small", children: "Complete the interview to see final decision." }), result && _jsx("pre", { className: "small", style: { whiteSpace: "pre-wrap" }, children: JSON.stringify(result, null, 2) })] })] })] }));
}
