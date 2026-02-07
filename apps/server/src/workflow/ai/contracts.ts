import { z } from "zod";

import type { RoundType } from "../../domain/types.js";

export type QuestionGenerationContext = {
  roundType: RoundType;
  role: string;
  level: "junior" | "mid" | "senior";
  memory: {
    strengths: string[];
    weaknesses: string[];
    notes: string[];
  };
  askedQuestions: string[];
  questionIndex: number; // 0-based index of the question in the current round
  resumeContext?: {
    extractedText: string;
    analysis?: {
      experience: string[];
      skills: string[];
      education: string[];
      summary: string;
    };
  };
};

export type GeneratedQuestion = {
  prompt: string;
};

export type EvaluationResponse = {
  json: unknown; // validated later by DecisionEngine per-round
  reasoningText: string; // allowed, but does not drive decisions
  memoryHints?: {
    strengths?: string[];
    weaknesses?: string[];
    notes?: string[];
  };
};

export interface AiProvider {
  generateQuestion(ctx: QuestionGenerationContext): Promise<GeneratedQuestion>;
  evaluateAnswer(params: {
    roundType: RoundType;
    question: string;
    answer: string;
    memory: QuestionGenerationContext["memory"];
  }): Promise<EvaluationResponse>;
  analyzeResume?(resumeText: string, targetRole: string): Promise<{
    experience: string[];
    skills: string[];
    education: string[];
    summary: string;
  }>;
  generateProfile?(context: {
    transcript: { question: string; answer: string }[];
    role: string;
    level: string;
  }): Promise<string>;
}

export const MemoryHintsSchema = z
  .object({
    strengths: z.array(z.string().min(1)).optional(),
    weaknesses: z.array(z.string().min(1)).optional(),
    notes: z.array(z.string().min(1)).optional()
  })
  .strict();
