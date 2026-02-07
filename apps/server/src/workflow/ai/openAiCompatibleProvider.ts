import { z } from "zod";

import type { AiProvider, EvaluationResponse, GeneratedQuestion, QuestionGenerationContext } from "./contracts.js";
import type { RoundType } from "../../domain/types.js";

type Cfg = {
  apiKey: string;
  baseUrl?: string;
  model?: string;
};

// Minimal OpenAI-compatible client using fetch; avoids coupling to a specific SDK.
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(private readonly cfg: Cfg) {
    this.baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(/\/$/, "");
    this.model = cfg.model ?? "gpt-4.1-mini";
  }

  async generateQuestion(ctx: QuestionGenerationContext): Promise<GeneratedQuestion> {
    const system =
      "You generate ONE creative and non-generic interview question. Do not evaluate. Do not decide pass/fail. Output plain text only. STRICTLY do not repeat any question from the 'askedQuestions' list. Focus on the candidate's specific role and level.";

    const user = {
      roundType: ctx.roundType,
      role: ctx.role,
      level: ctx.level,
      memory: ctx.memory,
      askedQuestions: ctx.askedQuestions,
      resumeContext: ctx.resumeContext
    };

    const text = await this.chatText({
      system,
      user: JSON.stringify(user),
      temperature: 0.7
    });

    return { prompt: text.trim() };
  }

  async analyzeResume(resumeText: string, targetRole: string): Promise<{
    experience: string[];
    skills: string[];
    education: string[];
    summary: string;
  }> {
    const system = "You analyze resumes and extract structured information. Output STRICT JSON only.";

    const schema = {
      name: "ResumeAnalysis",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          experience: { type: "array", items: { type: "string" } },
          skills: { type: "array", items: { type: "string" } },
          education: { type: "array", items: { type: "string" } },
          summary: { type: "string" }
        },
        required: ["experience", "skills", "education", "summary"]
      },
      strict: true
    };

    const user = {
      resumeText,
      targetRole,
      instruction: "Extract experience entries, technical skills, education details, and provide a brief summary."
    };

    const jsonText = await this.chatJson({
      system,
      user: JSON.stringify(user),
      jsonSchema: schema,
      temperature: 0.0
    });

    const result = safeJsonParse(jsonText) as {
      experience: string[];
      skills: string[];
      education: string[];
      summary: string;
    };

    return result;
  }

  async generateProfile(ctx: {
    transcript: { question: string; answer: string }[];
    role: string;
    level: string;
  }): Promise<string> {
    const system = "You are an expert recruiter. Analyze the interview transcript and generate a professional profile summary for the candidate. Focus on their communication skills, technical depth, and cultural fit. Output plain text.";

    const user = {
      role: ctx.role,
      level: ctx.level,
      transcript: ctx.transcript
    };

    return await this.chatText({
      system,
      user: JSON.stringify(user),
      temperature: 0.7
    });
  }

  async evaluateAnswer(params: {
    roundType: RoundType;
    question: string;
    answer: string;
    memory: QuestionGenerationContext["memory"];
  }): Promise<EvaluationResponse> {
    // Contract: STRICT JSON only for scores. Reasoning can be separate.
    // We request a JSON object that includes all dimensions and a short summary.

    const dimsByRound: Record<RoundType, string[]> = {
      SCREENING: ["communication", "relevance", "presentation"],
      TECHNICAL: ["accuracy", "completeness", "clarity"],
      SCENARIO: ["reasoning", "tradeoffs", "communication"]
    };

    const dims = dimsByRound[params.roundType];

    const schema = {
      name: "InterviewEvaluation",
      schema: {
        type: "object",
        additionalProperties: true,
        properties: Object.fromEntries([
          ...dims.map((d) => [d, { type: "integer", minimum: 0, maximum: 10 }]),
          ["summary", { type: "string" }],
          ["memoryHints", {
            type: "object",
            additionalProperties: false,
            properties: {
              strengths: { type: "array", items: { type: "string" } },
              weaknesses: { type: "array", items: { type: "string" } },
              notes: { type: "array", items: { type: "string" } }
            }
          }]
        ]),
        required: [...dims, "summary"]
      },
      strict: true
    };

    const system =
      "You are an interview answer evaluator. Output MUST be JSON ONLY (no markdown). " +
      "Do not decide pass/fail. Provide 0-10 integer scores for requested dimensions.";

    const user = {
      roundType: params.roundType,
      question: params.question,
      answer: params.answer,
      memory: params.memory,
      scoringScale: "0-10 integers"
    };

    const jsonText = await this.chatJson({
      system,
      user: JSON.stringify(user),
      jsonSchema: schema,
      temperature: 0.0
    });

    const parsedUnknown = safeJsonParse(jsonText);

    // Pull reasoning from 'summary' only; decision engine will compute verdict.
    const summary = z.object({ summary: z.string() }).passthrough().parse(parsedUnknown).summary;

    const memoryHints = z
      .object({
        memoryHints: z
          .object({
            strengths: z.array(z.string()).optional(),
            weaknesses: z.array(z.string()).optional(),
            notes: z.array(z.string()).optional()
          })
          .optional()
      })
      .passthrough()
      .parse(parsedUnknown).memoryHints;

    return {
      json: parsedUnknown,
      reasoningText: summary,
      memoryHints
    };
  }

  private async chatText(params: {
    system: string;
    user: string;
    temperature: number;
  }): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: params.temperature,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OpenAI-compatible request failed (${resp.status}): ${txt}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }

  private async chatJson(params: {
    system: string;
    user: string;
    jsonSchema: unknown;
    temperature: number;
  }): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        temperature: params.temperature,
        response_format: {
          type: "json_schema",
          json_schema: params.jsonSchema
        },
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user }
        ]
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`OpenAI-compatible request failed (${resp.status}): ${txt}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "{}";
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // best-effort recovery if provider wrapped JSON in whitespace
    const trimmed = text.trim();
    return JSON.parse(trimmed);
  }
}
