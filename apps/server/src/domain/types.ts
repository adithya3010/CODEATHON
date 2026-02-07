export type CandidateStatus = "IN_PROGRESS" | "SELECTED" | "REJECTED";

export type RoundType = "SCREENING" | "TECHNICAL" | "SCENARIO";

export type InterviewState =
  | "INIT"
  | "SCREENING"
  | "TECHNICAL"
  | "SCENARIO"
  | "FINAL_DECISION"
  | "REJECTED";

export type IsoDateTime = string;

export type Uuid = string;
