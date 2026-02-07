import type { CandidateStatus, InterviewState, IsoDateTime, RoundType, Uuid } from "./types.js";

export type Candidate = {
  id: Uuid;
  status: CandidateStatus;
  currentRound: RoundType | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
};

export type InterviewQuestion = {
  id: Uuid;
  roundType: RoundType;
  prompt: string;
  createdAt: IsoDateTime;
};

export type InterviewAnswer = {
  questionId: Uuid;
  answerText: string;
  answeredAt: IsoDateTime;
  evaluation: {
    json: unknown;
    reasoningText: string;
  } | null;
};

export type ScoreDimensions = Record<string, number>;

export type Scorecard = {
  dimensions: ScoreDimensions;
  weightedScore: number; // 0-100
  reasoning: string;
  // audit: store the raw AI JSON payload used as input to scoring (validated)
  rawEvaluation: unknown;
};

export type RoundVerdict = "PASS" | "FAIL";

export type InterviewRound = {
  roundType: RoundType;
  questions: InterviewQuestion[];
  answers: InterviewAnswer[];
  scorecard: Scorecard | null;
  verdict: RoundVerdict | null;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
};

export type StructuredMemory = {
  strengths: string[];
  weaknesses: string[];
  notes: string[];
};

export type AuditEvent = {
  at: IsoDateTime;
  type:
    | "SESSION_STARTED"
    | "ROUND_STARTED"
    | "QUESTION_ASKED"
    | "ANSWER_SUBMITTED"
    | "ANSWER_EVALUATED"
    | "ROUNDED_SCORED"
    | "ROUND_VERDICT"
    | "SESSION_VERDICT";
  details: Record<string, unknown>;
};

export type ResumeData = {
  fileName: string;
  uploadedAt: IsoDateTime;
  extractedText: string;
  analysis?: {
    experience: string[];
    skills: string[];
    education: string[];
    summary: string;
  };
};

export type InterviewSession = {
  id: Uuid;
  candidateId: Uuid;
  state: InterviewState;
  context: {
    role: string;
    level: "junior" | "mid" | "senior";
  };
  resume?: ResumeData;
  startedAt: IsoDateTime;
  endedAt: IsoDateTime | null;
  rounds: InterviewRound[];
  memory: StructuredMemory;
  auditLog: AuditEvent[];
};
