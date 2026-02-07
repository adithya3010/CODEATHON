import type { Candidate, InterviewSession } from "../domain/models.js";

export interface CandidateRepo {
  getById(id: string): Promise<Candidate | null>;
  upsert(candidate: Candidate): Promise<void>;
}

export interface SessionRepo {
  getById(id: string): Promise<InterviewSession | null>;
  upsert(session: InterviewSession): Promise<void>;
}

export type InterviewLiveState = {
  sessionId: string;
  state: string;
  currentRound: string | null;
  questionIndex: number;
  updatedAt: string;
};

export interface InterviewStateStore {
  get(sessionId: string): Promise<InterviewLiveState | null>;
  set(state: InterviewLiveState, ttlSeconds?: number): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
