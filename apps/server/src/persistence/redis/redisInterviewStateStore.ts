import Redis from "ioredis";

import type { InterviewLiveState, InterviewStateStore } from "../interfaces.js";

export class RedisInterviewStateStore implements InterviewStateStore {
  constructor(
    private readonly deps: {
      redis: Redis;
      keyPrefix?: string;
      defaultTtlSeconds?: number;
    }
  ) {}

  private key(sessionId: string) {
    const prefix = this.deps.keyPrefix ?? "interview";
    return `${prefix}:session:${sessionId}:state`;
  }

  async get(sessionId: string): Promise<InterviewLiveState | null> {
    const data = await this.deps.redis.hgetall(this.key(sessionId));
    if (!data || Object.keys(data).length === 0) return null;

    const questionIndex = Number(data.questionIndex ?? "0");

    return {
      sessionId,
      state: data.state ?? "",
      currentRound: data.currentRound ? data.currentRound : null,
      questionIndex: Number.isFinite(questionIndex) ? questionIndex : 0,
      updatedAt: data.updatedAt ?? new Date().toISOString()
    };
  }

  async set(state: InterviewLiveState, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.deps.defaultTtlSeconds ?? 2 * 60 * 60;
    const key = this.key(state.sessionId);

    await this.deps.redis
      .multi()
      .hset(key, {
        state: state.state,
        currentRound: state.currentRound ?? "",
        questionIndex: String(state.questionIndex),
        updatedAt: state.updatedAt
      })
      .expire(key, ttl)
      .exec();
  }

  async clear(sessionId: string): Promise<void> {
    await this.deps.redis.del(this.key(sessionId));
  }
}
