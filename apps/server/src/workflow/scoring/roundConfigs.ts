import type { RoundType } from "../../domain/types.js";

export type RoundScoringConfig = {
  roundType: RoundType;
  dimensions: string[];
  weights: Record<string, number>; // sum must be 1
  passThreshold: number; // 0-100
  questionsPerRound: number;
};

export const roundConfigs: Record<RoundType, RoundScoringConfig> = {
  SCREENING: {
    roundType: "SCREENING",
    dimensions: ["communication", "relevance", "presentation"],
    weights: { communication: 0.4, relevance: 0.35, presentation: 0.25 },
    passThreshold: 60,
    questionsPerRound: 3
  },
  TECHNICAL: {
    roundType: "TECHNICAL",
    dimensions: ["accuracy", "completeness", "clarity"],
    weights: { accuracy: 0.5, completeness: 0.3, clarity: 0.2 },
    passThreshold: 60,
    questionsPerRound: 3
  },
  SCENARIO: {
    roundType: "SCENARIO",
    dimensions: ["reasoning", "tradeoffs", "communication"],
    weights: { reasoning: 0.4, tradeoffs: 0.3, communication: 0.3 },
    passThreshold: 60,
    questionsPerRound: 3
  }
};
