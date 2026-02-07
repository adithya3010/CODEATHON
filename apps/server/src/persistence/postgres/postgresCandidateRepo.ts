import type { Pool } from "pg";

import type { Candidate } from "../../domain/models.js";
import type { CandidateRepo } from "../interfaces.js";

export class PostgresCandidateRepo implements CandidateRepo {
  constructor(private readonly pool: Pool) {}

  async getById(id: string): Promise<Candidate | null> {
    const res = await this.pool.query(
      "SELECT id, status, current_round, created_at, updated_at FROM candidates WHERE id = $1",
      [id]
    );
    const row = res.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      status: row.status,
      currentRound: row.current_round,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString()
    } as Candidate;
  }

  async upsert(candidate: Candidate): Promise<void> {
    await this.pool.query(
      `INSERT INTO candidates (id, status, current_round, created_at, updated_at)
       VALUES ($1, $2, $3, $4::timestamptz, $5::timestamptz)
       ON CONFLICT (id) DO UPDATE
       SET status = EXCLUDED.status,
           current_round = EXCLUDED.current_round,
           updated_at = EXCLUDED.updated_at`,
      [candidate.id, candidate.status, candidate.currentRound, candidate.createdAt, candidate.updatedAt]
    );
  }
}
