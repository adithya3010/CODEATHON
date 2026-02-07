import type { AiProvider, EvaluationResponse, GeneratedQuestion, QuestionGenerationContext } from "./contracts.js";

export class MockAiProvider implements AiProvider {
  async generateQuestion(ctx: QuestionGenerationContext): Promise<GeneratedQuestion> {
    const base =
      ctx.roundType === "SCREENING"
        ? "Tell me about a time you collaborated across teams."
        : ctx.roundType === "TECHNICAL"
          ? "Explain how you would design a rate limiter for an API."
          : "You discover latency spikes after a deployment. Walk through your approach.";

    return {
      prompt: `[MOCK ${ctx.roundType}] ${base}`
    };
  }

  async evaluateAnswer(params: {
    roundType: QuestionGenerationContext["roundType"];
    question: string;
    answer: string;
    memory: QuestionGenerationContext["memory"];
  }): Promise<EvaluationResponse> {
    // Deterministic-ish scoring based on answer length and keyword presence.
    const len = params.answer.trim().length;
    const hasStructure = /first|second|finally|trade-?off|because|therefore/i.test(params.answer);

    const score = (base: number) => Math.max(0, Math.min(10, base));

    let json: Record<string, number>;

    switch (params.roundType) {
      case "SCREENING":
        json = {
          clarity: score((len > 120 ? 7 : 5) + (hasStructure ? 1 : 0)),
          confidence: score(len > 60 ? 6 : 4),
          completeness: score((len > 150 ? 7 : 5) + (hasStructure ? 1 : 0))
        };
        break;
      case "TECHNICAL":
        json = {
          accuracy: score((/token|bucket|limit|429|sliding/i.test(params.answer) ? 7 : 5) + (hasStructure ? 1 : 0)),
          completeness: score(len > 200 ? 7 : 5),
          clarity: score((len > 120 ? 6 : 5) + (hasStructure ? 1 : 0))
        };
        break;
      case "SCENARIO":
        json = {
          reasoning: score((/measure|metric|trace|rollback|hypothesis/i.test(params.answer) ? 7 : 5) + (hasStructure ? 1 : 0)),
          tradeoffs: score(/trade-?off|cost|risk|impact/i.test(params.answer) ? 7 : 5),
          communication: score((len > 120 ? 6 : 5) + (hasStructure ? 1 : 0))
        };
        break;
    }

    return {
      json,
      reasoningText: "Mock evaluation: deterministic heuristics; backend makes decisions.",
      memoryHints: {
        strengths: hasStructure ? ["Structured communication"] : undefined,
        weaknesses: len < 80 ? ["Insufficient detail"] : undefined
      }
    };
  }
}
