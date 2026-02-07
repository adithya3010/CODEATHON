export async function startInterview(params) {
    const resp = await fetch("/interview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
    });
    if (!resp.ok)
        throw new Error(await resp.text());
    return (await resp.json());
}
export async function submitAnswer(params) {
    const resp = await fetch("/interview/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params)
    });
    if (!resp.ok)
        throw new Error(await resp.text());
    return (await resp.json());
}
export async function getState(sessionId) {
    const resp = await fetch(`/interview/state?sessionId=${encodeURIComponent(sessionId)}`);
    if (!resp.ok)
        throw new Error(await resp.text());
    return (await resp.json());
}
export async function getResult(sessionId) {
    const resp = await fetch(`/interview/result?sessionId=${encodeURIComponent(sessionId)}`);
    if (!resp.ok)
        throw new Error(await resp.text());
    return (await resp.json());
}
