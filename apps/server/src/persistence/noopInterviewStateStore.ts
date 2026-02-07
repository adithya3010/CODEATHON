import type { InterviewStateStore, InterviewLiveState } from "./interfaces.js";

export class NoopInterviewStateStore implements InterviewStateStore {
  async get(_sessionId: string): Promise<InterviewLiveState | null> {
    return null;
  }

  async set(_state: InterviewLiveState, _ttlSeconds?: number): Promise<void> {
    // no-op
  }

  async clear(_sessionId: string): Promise<void> {
    // no-op
  }
}
