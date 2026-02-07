# Deterministic Scoring

The backend applies a deterministic scoring engine per round.

Each answer is evaluated by AI into dimension scores (0-10). For a round, the engine:

1. Validates each evaluation payload contains required dimensions
2. Aggregates per dimension using mean (rounded)
3. Converts to a weighted 0-100 score
4. Compares to threshold for PASS/FAIL

Weights and thresholds are defined in apps/server/src/workflow/scoring/roundConfigs.ts.
