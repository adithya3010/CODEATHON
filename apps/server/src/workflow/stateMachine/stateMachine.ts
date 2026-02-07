import type { InterviewState, RoundType } from "../../domain/types.js";

export const orderedRounds: RoundType[] = ["SCREENING", "TECHNICAL", "SCENARIO"];

export function roundToState(round: RoundType): InterviewState {
  switch (round) {
    case "SCREENING":
      return "SCREENING";
    case "TECHNICAL":
      return "TECHNICAL";
    case "SCENARIO":
      return "SCENARIO";
  }
}

export function nextRound(current: RoundType): RoundType | null {
  const idx = orderedRounds.indexOf(current);
  if (idx < 0) return null;
  return orderedRounds[idx + 1] ?? null;
}

export function canAnswer(state: InterviewState): boolean {
  return state === "SCREENING" || state === "TECHNICAL" || state === "SCENARIO";
}
