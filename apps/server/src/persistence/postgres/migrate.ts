import { createPgPool } from "./pg.js";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS candidates (
  id uuid PRIMARY KEY,
  status text NOT NULL,
  current_round text NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_sessions (
  id uuid PRIMARY KEY,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  state text NOT NULL,
  context jsonb NOT NULL,
  memory jsonb NOT NULL,
  audit_log jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS interview_rounds (
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  round_type text NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NULL,
  verdict text NULL,
  scorecard jsonb NULL,
  questions jsonb NOT NULL,
  answers jsonb NOT NULL,
  PRIMARY KEY (session_id, round_type)
);

CREATE TABLE IF NOT EXISTS decision_logs (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for db:migrate");
  }

  const pool = createPgPool(databaseUrl);

  try {
    await pool.query(SCHEMA_SQL);
    // eslint-disable-next-line no-console
    console.log("db:migrate complete");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});
