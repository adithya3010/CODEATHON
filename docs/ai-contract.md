# AI Prompt Contract

The AI layer is constrained:

- Analyzes resumes (optional, for SCREENING round context)
- Generates a question (plain text)
- Evaluates a single answer and returns **STRICT JSON only**

The backend:
- validates JSON
- aggregates per-answer evaluations deterministically
- applies weights and thresholds to compute verdicts

## Resume Analysis (Optional)

For SCREENING round, AI can analyze uploaded resume:

```json
{
  "experience": ["5 years backend development", "Led team of 4 engineers"],
  "skills": ["javascript", "python", "aws", "docker"],
  "education": ["BS Computer Science, MIT"],
  "summary": "Experienced full-stack engineer with cloud expertise"
}
```

## Evaluation JSON

Backend expects dimensions by round:

- SCREENING: communication, relevance, presentation
- TECHNICAL: accuracy, completeness, clarity
- SCENARIO: reasoning, tradeoffs, communication

Scores must be integers 0-10.

Example:

```json
{
  "communication": 8,
  "relevance": 7,
  "presentation": 7,
  "summary": "Strong communication with relevant experience examples"
}
```

Rules:
- No markdown
- No extra text outside JSON
- Do NOT decide pass/fail
