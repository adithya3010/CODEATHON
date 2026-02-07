import { z } from "zod";

import type { Scorecard } from "../../domain/models.js";
import type { RoundType } from "../../domain/types.js";
import type { RoundScoringConfig } from "./roundConfigs.js";

const DimensionScore = z.number().int().min(0).max(10);

export type RoundResult = {
  roundType: RoundType;
  scorecard: Scorecard;
  verdict: "PASS" | "FAIL";
  explainableReasons: string[];
};

export class DecisionEngine {
  constructor(private readonly configs: Record<RoundType, RoundScoringConfig>) {
    // Validate configs on startup for determinism.
    for (const cfg of Object.values(configs)) {
      const weightSum = Object.values(cfg.weights).reduce((a, b) => a + b, 0);
      if (Math.abs(weightSum - 1) > 1e-6) {
        throw new Error(`Invalid weights for ${cfg.roundType}: sum=${weightSum}`);
      }
    }
  }

  getConfig(roundType: RoundType): RoundScoringConfig {
    return this.configs[roundType];
  }

  computeRoundResult(params: {
    roundType: RoundType;
    rawEvaluations: unknown[];
    reasoningTexts: string[];
  }): RoundResult {
    const cfg = this.getConfig(params.roundType);

    const evalSchema = z
      .object(
        Object.fromEntries(cfg.dimensions.map((d) => [d, DimensionScore])) as Record<
          string,
          z.ZodTypeAny
        >
      )
      .passthrough();

    if (params.rawEvaluations.length === 0) {
      throw new Error("No evaluations provided");
    }

    const perAnswer = params.rawEvaluations.map((re) => evalSchema.parse(re));

    // Aggregate deterministically: mean of each dimension across answered questions.
    const dimensions: Record<string, number> = {};
    for (const d of cfg.dimensions) {
      const mean =
        perAnswer.map((x) => Number(x[d])).reduce((a, b) => a + b, 0) / perAnswer.length;
      dimensions[d] = Math.round(mean);
    }

    // Weighted score maps 0-10 dimension scores into 0-100.
    let weighted = 0;
    for (const d of cfg.dimensions) {
      const w = cfg.weights[d] ?? 0;
      weighted += (dimensions[d] / 10) * 100 * w;
    }
    const weightedScore = Math.round(weighted);

    const verdict: "PASS" | "FAIL" = weightedScore >= cfg.passThreshold ? "PASS" : "FAIL";

    const explainableReasons: string[] = [];
    explainableReasons.push(
      `Weighted score ${weightedScore} (threshold ${cfg.passThreshold}) => ${verdict}`
    );
    for (const d of cfg.dimensions) {
      const value = dimensions[d];
      if (value <= 4) explainableReasons.push(`${d} is weak (${value}/10)`);
      if (value >= 8) explainableReasons.push(`${d} is strong (${value}/10)`);
    }

    const scorecard: Scorecard = {
      dimensions,
      weightedScore,
      reasoning: [...new Set(params.reasoningTexts.filter(Boolean))].join("\n\n"),
      rawEvaluation: {
        perAnswer,
        aggregate: dimensions
      }
    };

    return { roundType: cfg.roundType, scorecard, verdict, explainableReasons };
  }
}
