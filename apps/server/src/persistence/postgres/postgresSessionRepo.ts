import type { Pool } from "pg";

import type { InterviewRound, InterviewSession } from "../../domain/models.js";
import type { SessionRepo } from "../interfaces.js";

function toPgJson(value: unknown) {
  return JSON.stringify(value);
}

export class PostgresSessionRepo implements SessionRepo {
  constructor(private readonly pool: Pool) {}

  async getById(id: string): Promise<InterviewSession | null> {
    const sessionRes = await this.pool.query(
      `SELECT id, candidate_id, state, context, memory, audit_log, started_at, ended_at
       FROM interview_sessions
       WHERE id = $1`,
      [id]
    );

    const srow = sessionRes.rows[0];
    if (!srow) return null;

    const roundsRes = await this.pool.query(
      `SELECT round_type, started_at, ended_at, verdict, scorecard, questions, answers
       FROM interview_rounds
       WHERE session_id = $1
       ORDER BY started_at ASC`,
      [id]
    );

    const rounds: InterviewRound[] = roundsRes.rows.map((r) => {
      return {
        roundType: r.round_type,
        questions: r.questions ?? [],
        answers: r.answers ?? [],
        scorecard: r.scorecard ?? null,
        verdict: r.verdict ?? null,
        startedAt: new Date(r.started_at).toISOString(),
        endedAt: r.ended_at ? new Date(r.ended_at).toISOString() : null
      } as InterviewRound;
    });

    return {
      id: srow.id,
      candidateId: srow.candidate_id,
      state: srow.state,
      context: srow.context,
      startedAt: new Date(srow.started_at).toISOString(),
      endedAt: srow.ended_at ? new Date(srow.ended_at).toISOString() : null,
      rounds,
      memory: srow.memory,
      auditLog: srow.audit_log
    } as InterviewSession;
  }

  async upsert(session: InterviewSession): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO interview_sessions (id, candidate_id, state, context, memory, audit_log, started_at, ended_at, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::timestamptz, $8::timestamptz, now())
         ON CONFLICT (id) DO UPDATE
         SET candidate_id = EXCLUDED.candidate_id,
             state = EXCLUDED.state,
             context = EXCLUDED.context,
             memory = EXCLUDED.memory,
             audit_log = EXCLUDED.audit_log,
             started_at = EXCLUDED.started_at,
             ended_at = EXCLUDED.ended_at,
             updated_at = now()`,
        [
          session.id,
          session.candidateId,
          session.state,
          toPgJson(session.context),
          toPgJson(session.memory),
          toPgJson(session.auditLog),
          session.startedAt,
          session.endedAt
        ]
      );

      // Upsert rounds (1 row per round_type).
      for (const round of session.rounds) {
        await client.query(
          `INSERT INTO interview_rounds (
              session_id, round_type, started_at, ended_at, verdict, scorecard, questions, answers
            ) VALUES (
              $1, $2, $3::timestamptz, $4::timestamptz, $5, $6::jsonb, $7::jsonb, $8::jsonb
            )
            ON CONFLICT (session_id, round_type) DO UPDATE
            SET started_at = EXCLUDED.started_at,
                ended_at = EXCLUDED.ended_at,
                verdict = EXCLUDED.verdict,
                scorecard = EXCLUDED.scorecard,
                questions = EXCLUDED.questions,
                answers = EXCLUDED.answers`,
          [
            session.id,
            round.roundType,
            round.startedAt,
            round.endedAt,
            round.verdict,
            round.scorecard ? toPgJson(round.scorecard) : null,
            toPgJson(round.questions ?? []),
            toPgJson(round.answers ?? [])
          ]
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}
