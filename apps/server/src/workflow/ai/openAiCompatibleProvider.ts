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
    let system: string;

    if (ctx.roundType === "TECHNICAL") {
      // Role-specific technical focus areas
      const roleFocus: Record<string, string> = {
        "Frontend Developer": "React/Vue/Angular components, state management, CSS/responsive design, browser APIs, performance optimization, accessibility (a11y), bundlers like Webpack/Vite",
        "Backend Developer": "REST/GraphQL APIs, database design (SQL/NoSQL), authentication, caching strategies, microservices, message queues, error handling",
        "Full Stack Developer": "End-to-end architecture, API integration, database schemas, frontend-backend communication, deployment pipelines",
        "DevOps Engineer": "CI/CD pipelines, Docker/Kubernetes, infrastructure as code (Terraform/Ansible), monitoring/logging, cloud services (AWS/GCP/Azure)",
        "Data Engineer": "ETL pipelines, data warehousing, SQL optimization, Spark/Airflow, data modeling, streaming (Kafka)",
        "Mobile Developer": "iOS/Android development, React Native/Flutter, mobile UI patterns, offline storage, push notifications, app performance",
        "QA Engineer": "Test automation frameworks, testing strategies, CI integration, API testing, performance testing, test case design",
        "Machine Learning Engineer": "ML model training/deployment, feature engineering, MLOps, model evaluation metrics, data preprocessing, TensorFlow/PyTorch",
        "Cloud Architect": "Cloud architecture patterns, multi-cloud strategies, security best practices, cost optimization, high availability design",
        "Security Engineer": "OWASP vulnerabilities, authentication/authorization, encryption, penetration testing, security audits, incident response"
      };

      const focus = roleFocus[ctx.role] || "relevant technical concepts for the role";

      const qIndex = ctx.questionIndex ?? 0;
      let difficultyContext = "";

      if (qIndex === 0) {
        difficultyContext = "Difficulty Level: FUNDAMENTAL/CORE CONCEPTS. Ask a foundational question to verify their core knowledge.";
      } else if (qIndex === 1) {
        difficultyContext = "Difficulty Level: INTERMEDIATE/APPLIED. Ask a practical, scenario-based, or debugging question that requires applying knowledge.";
      } else {
        difficultyContext = "Difficulty Level: ADVANCED/COMPLEX. Ask a challenging question about system design, performance optimization, architecture, or edge cases.";
      }

      system = `You are a senior technical interviewer. Generate ONE challenging technical question for a ${ctx.level} ${ctx.role} candidate.

**Role-Specific Focus Areas for ${ctx.role}:**
${focus}

**${difficultyContext}**

Requirements:
- Ask about specific technologies, patterns, or scenarios relevant to ${ctx.role}
- Be practical and real-world focused, not theoretical
- Match difficulty to ${ctx.level} level (${ctx.level === 'junior' ? 'fundamental concepts' : ctx.level === 'mid' ? 'intermediate problem-solving' : 'advanced architecture decisions'})
- NEVER repeat questions from: ${ctx.askedQuestions.slice(-5).join(', ')}
- Output ONLY the question text, no explanations or preamble`;
    } else if (ctx.roundType === "SCENARIO") {
      // Role-specific scenario focus areas
      const roleScenarios: Record<string, string> = {
        "Frontend Developer": "UI performance issues, broken user flows, accessibility complaints, cross-browser bugs, design system conflicts",
        "Backend Developer": "API downtime, database bottlenecks, data inconsistency, authentication failures, third-party service outages",
        "Full Stack Developer": "End-to-end feature delivery challenges, coordinating frontend-backend changes, deployment issues",
        "DevOps Engineer": "Production outages, failed deployments, infrastructure scaling issues, security breaches, cost overruns",
        "Data Engineer": "Pipeline failures, data quality issues, slow queries affecting production, data migration challenges",
        "Mobile Developer": "App crashes in production, performance issues on older devices, push notification failures, app store rejections",
        "QA Engineer": "Critical bugs found in production, test environment instability, regression issues, release blocking defects",
        "Machine Learning Engineer": "Model drift in production, training pipeline failures, bias detection, model rollback decisions",
        "Cloud Architect": "Multi-region failover scenarios, cost optimization trade-offs, security incident response, vendor lock-in decisions",
        "Security Engineer": "Data breach response, vulnerability disclosure, compliance audit failures, suspicious activity detection"
      };

      const scenarios = roleScenarios[ctx.role] || "real-world challenges relevant to the role";

      // Determine which part of the scenario we're in based on question count
      const questionNum = (ctx.questionIndex ?? 0) + 1;

      let partInstruction: string;
      let partLabel: string;

      if (questionNum === 1) {
        partLabel = "[SCENARIO - Part A: Initial Response]";
        partInstruction = `Present a realistic crisis or challenging situation. Ask what the candidate's FIRST STEPS would be to assess and respond to the situation. Focus on immediate actions and prioritization.`;
      } else if (questionNum === 2) {
        partLabel = "[SCENARIO - Part B: Deep Dive]";
        partInstruction = `Based on a typical response to the previous scenario, present a follow-up challenge or complication. Ask how they would handle root cause analysis, implement a fix, or coordinate with stakeholders. Focus on technical depth and problem-solving.`;
      } else {
        partLabel = "[SCENARIO - Part C: Prevention & Learning]";
        partInstruction = `Present the final part of the scenario. Ask what measures, processes, or improvements they would implement to PREVENT similar issues in the future. Focus on long-term thinking, documentation, and process improvement.`;
      }

      system = `You are a senior interviewer conducting a multi-part scenario assessment for a ${ctx.level} ${ctx.role}.

**Scenario Context for ${ctx.role}:**
${scenarios}

**This is ${partLabel}**
${partInstruction}

Requirements:
- Create a realistic, specific situation with details (systems, timeframes, stakeholders)
- Match complexity to ${ctx.level} level
- ${questionNum > 1 ? 'Build on the previous scenario context' : 'Start a fresh scenario'}
- Output format: Start with "${partLabel}" then the scenario question
- Be concise but detailed enough to assess decision-making`;
    } else {
      system = "You generate ONE creative and non-generic interview question. Do not evaluate. Do not decide pass/fail. Output plain text only. STRICTLY do not repeat any question from the 'askedQuestions' list. Focus on the candidate's specific role and level.";
    }

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
      "Do not decide pass/fail. Provide 0-10 integer scores for requested dimensions. " +
      "For SCENARIO questions (Round 3), prioritize depth, comprehensive analysis, and clarity. " +
      "Detailed, well-reasoned answers covering multiple aspects (root cause, fix, prevention) should score HIGH (8-10). " +
      "Vague or brief answers should score LOW (0-4). Average answers (5-7).";

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
    const resp = await fetch(`${this.baseUrl} /chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey} `
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
      throw new Error(`OpenAI - compatible request failed(${resp.status}): ${txt} `);
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
    const resp = await fetch(`${this.baseUrl} /chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.cfg.apiKey} `
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
      throw new Error(`OpenAI - compatible request failed(${resp.status}): ${txt} `);
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
