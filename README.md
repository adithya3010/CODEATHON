# Multi-Round Interview Orchestrator (Workflow Engine)

This repo implements a **deterministic, explainable** multi-round interview workflow:

`SCREENING (with Resume) → TECHNICAL → SCENARIO → FINAL_DECISION` (or `REJECTED`).

## Round 1: SCREENING
- **Resume Upload**: Candidates upload their resume (optional but recommended)
- **Resume Analysis**: AI extracts experience, skills, and education
- **Communication Check**: Questions focus on:
  - How candidates communicate their technical achievements
  - Ability to explain complex concepts clearly
  - Presentation of relevant experience
- **Scoring Dimensions**: communication (40%), relevance (35%), presentation (25%)

AI is used **only** for:
- analyzing resume content (SCREENING round)
- generating the next question text
- evaluating a given answer into **strict JSON** scores

AI **never**:
- decides pass/fail
- controls transitions
- stores state

## Monorepo layout

- apps/server: Node.js + Express + TypeScript backend (state machine, scoring engine, AI adapters)
- apps/web: React + Vite frontend (UI only)

## Run locally

Prereqs: Node 18+.

```bash
npm install
npm run dev:all
```

- Backend: http://localhost:3001/healthz
- Frontend: http://localhost:5173

### AI provider

By default the backend runs with a deterministic `MockAiProvider` (good for demos and tests).

To enable an OpenAI-compatible endpoint:

- copy apps/server/.env.example → apps/server/.env
- set `OPENAI_API_KEY`

## Backend: deterministic flow

The backend persists interview state via:
- **PostgreSQL** (source of truth) when `DATABASE_URL` (or `SUPABASE_DB_URL`) is set; otherwise falls back to in-memory.
- **Redis** (live interview state) when `REDIS_URL` is set; otherwise no-op.

Key modules:
- apps/server/src/workflow/interviewOrchestrator.ts: orchestration + state machine transitions
- apps/server/src/workflow/scoring/decisionEngine.ts: deterministic scoring & verdicts
- apps/server/src/workflow/ai/*: AI providers (mock + OpenAI-compatible)

## REST API

### POST /interview/start

```bash
curl -s -X POST http://localhost:3001/interview/start \
  -H "content-type: application/json" \
  -d '{"role":"backend","level":"mid","resumeText":"John Doe...","resumeFileName":"resume.txt"}' | jq
```

Note: `resumeText` and `resumeFileName` are optional. When provided, the resume will be analyzed during the SCREENING round.

### POST /interview/answer

```bash
curl -s -X POST http://localhost:3001/interview/answer \
  -H "content-type: application/json" \
  -d '{"sessionId":"<SESSION_ID>","questionId":"<QUESTION_ID>","answer":"My answer..."}' | jq
```

### GET /interview/state

```bash
curl -s "http://localhost:3001/interview/state?sessionId=<SESSION_ID>" | jq
```

### GET /interview/result

```bash
curl -s "http://localhost:3001/interview/result?sessionId=<SESSION_ID>" | jq
```

## Notes

- Decisions are deterministic and explainable: the backend computes weighted scores and thresholds.
- Resume is supported via `sessionId` (client can persist it and call `/interview/state`).
- Audit events are appended to each session for traceability.
