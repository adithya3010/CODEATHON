export type InterviewStateResponse = {
  sessionId: string;
  candidateId: string;
  state: string;
  currentRound: string | null;
  activeQuestion: { id: string; prompt: string; roundType: string } | null;
  progress: Array<{
    roundType: string;
    answers: number;
    questionsAsked: number;
    verdict: string | null;
    weightedScore: number | null;
  }>;
  memory: { strengths: string[]; weaknesses: string[]; notes: string[] };
};

export async function startInterview(params: { role: string; level: "junior" | "mid" | "senior" }) {
  const resp = await fetch("/interview/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()) as InterviewStateResponse;
}

export async function submitAnswer(params: { sessionId: string; answer: string; questionId?: string }) {
  const resp = await fetch("/interview/answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()) as InterviewStateResponse;
}

export async function getState(sessionId: string) {
  const resp = await fetch(`/interview/state?sessionId=${encodeURIComponent(sessionId)}`);
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()) as InterviewStateResponse;
}

export async function getResult(sessionId: string) {
  const resp = await fetch(`/interview/result?sessionId=${encodeURIComponent(sessionId)}`);
  if (!resp.ok) throw new Error(await resp.text());
  return (await resp.json()) as any;
}
