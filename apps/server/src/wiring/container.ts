import { InMemoryCandidateRepo } from "../persistence/inMemoryCandidateRepo.js";
import { InMemorySessionRepo } from "../persistence/inMemorySessionRepo.js";
import { NoopInterviewStateStore } from "../persistence/noopInterviewStateStore.js";
import { RedisInterviewStateStore } from "../persistence/redis/redisInterviewStateStore.js";
import { createPgPool } from "../persistence/postgres/pg.js";
import { PostgresCandidateRepo } from "../persistence/postgres/postgresCandidateRepo.js";
import { PostgresSessionRepo } from "../persistence/postgres/postgresSessionRepo.js";
import { InterviewOrchestrator } from "../workflow/interviewOrchestrator.js";
import { DecisionEngine } from "../workflow/scoring/decisionEngine.js";
import { roundConfigs } from "../workflow/scoring/roundConfigs.js";
import { MockAiProvider } from "../workflow/ai/mockAiProvider.js";
import { OpenAiCompatibleProvider } from "../workflow/ai/openAiCompatibleProvider.js";
import { InterviewController } from "../workflow/http/interviewController.js";
import { buildLogger } from "../observability/logger.js";
import Redis from "ioredis";

export type Container = ReturnType<typeof buildContainer>;

export function buildContainer() {
  const logger = buildLogger();

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  const sslMode = (process.env.PGSSLMODE ?? process.env.DATABASE_SSLMODE ?? "").toLowerCase() as
    | "disable"
    | "require"
    | "prefer"
    | "allow"
    | "";
  const pgPool = databaseUrl ? createPgPool(databaseUrl, { sslMode: sslMode || undefined }) : null;

  const candidateRepo = pgPool ? new PostgresCandidateRepo(pgPool) : new InMemoryCandidateRepo();
  const sessionRepo = pgPool ? new PostgresSessionRepo(pgPool) : new InMemorySessionRepo();

  const redisUrl = process.env.REDIS_URL;
  const redis = redisUrl ? new Redis(redisUrl) : null;
  const interviewStateStore = redis ? new RedisInterviewStateStore({ redis }) : new NoopInterviewStateStore();

  const aiProvider = process.env.OPENAI_API_KEY
    ? new OpenAiCompatibleProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL
      })
    : new MockAiProvider();

  const decisionEngine = new DecisionEngine(roundConfigs);
  const orchestrator = new InterviewOrchestrator({
    candidateRepo,
    sessionRepo,
    interviewStateStore,
    aiProvider,
    decisionEngine,
    logger
  });

  const interviewController = new InterviewController(orchestrator);

  return {
    logger,
    candidateRepo,
    sessionRepo,
    interviewStateStore,
    aiProvider,
    decisionEngine,
    orchestrator,
    interviewController
  };
}
