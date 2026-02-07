# AI Prompt Contract

The AI layer is constrained:

- Generates a question (plain text)
- Evaluates a single answer and returns **STRICT JSON only**

The backend:
- validates JSON
- aggregates per-answer evaluations deterministically
- applies weights and thresholds to compute verdicts

## Evaluation JSON

Backend expects dimensions by round:

- SCREENING: clarity, confidence, completeness
- TECHNICAL: accuracy, completeness, clarity
- SCENARIO: reasoning, tradeoffs, communication

Scores must be integers 0-10.

Example:

```json
{
  "clarity": 7,
  "confidence": 6,
  "completeness": 8,
  "summary": "Well-structured, but missed concrete examples"
}
```

Rules:
- No markdown
- No extra text outside JSON
- Do NOT decide pass/fail
