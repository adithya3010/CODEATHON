import type { Candidate } from "../domain/models.js";
import type { CandidateRepo } from "./interfaces.js";

export class InMemoryCandidateRepo implements CandidateRepo {
  private readonly byId = new Map<string, Candidate>();

  async getById(id: string): Promise<Candidate | null> {
    return this.byId.get(id) ?? null;
  }

  async upsert(candidate: Candidate): Promise<void> {
    this.byId.set(candidate.id, candidate);
  }
}
