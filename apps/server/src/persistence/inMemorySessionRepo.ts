import type { InterviewSession } from "../domain/models.js";
import type { SessionRepo } from "./interfaces.js";

export class InMemorySessionRepo implements SessionRepo {
  private readonly byId = new Map<string, InterviewSession>();

  async getById(id: string): Promise<InterviewSession | null> {
    return this.byId.get(id) ?? null;
  }

  async upsert(session: InterviewSession): Promise<void> {
    this.byId.set(session.id, session);
  }
}
