import type pino from "pino";
import { v4 as uuidv4 } from "uuid";

import type {
  AuditEvent,
  Candidate,
  InterviewAnswer,
  InterviewQuestion,
  InterviewRound,
  InterviewSession,
  RoundVerdict
} from "../domain/models.js";
import type { InterviewState, RoundType } from "../domain/types.js";
import { nowIso } from "../domain/time.js";
import { InvalidStateError, NotFoundError, ValidationError } from "../domain/errors.js";
import type { CandidateRepo, InterviewStateStore, SessionRepo } from "../persistence/interfaces.js";
import type { AiProvider } from "./ai/contracts.js";
import { DecisionEngine } from "./scoring/decisionEngine.js";
import { canAnswer, nextRound, roundToState } from "./stateMachine/stateMachine.js";

export class InterviewOrchestrator {
  constructor(
    private readonly deps: {
      candidateRepo: CandidateRepo;
      sessionRepo: SessionRepo;
      interviewStateStore: InterviewStateStore;
      aiProvider: AiProvider;
      decisionEngine: DecisionEngine;
      logger: pino.Logger;
    }
  ) { }

  async startInterview(params: {
    candidateId?: string;
    role: string;
    level: "junior" | "mid" | "senior";
    resumeText?: string;
    resumeFileName?: string;
  }) {
    const candidateId = params.candidateId ?? uuidv4();
    const sessionId = uuidv4();

    const now = nowIso();

    const candidate: Candidate = {
      id: candidateId,
      status: "IN_PROGRESS",
      currentRound: null,
      createdAt: now,
      updatedAt: now
    };

    const session: InterviewSession = {
      id: sessionId,
      candidateId,
      state: "INIT",
      context: {
        role: params.role,
        level: params.level
      },
      startedAt: now,
      endedAt: null,
      rounds: [],
      memory: { strengths: [], weaknesses: [], notes: [] },
      auditLog: []
    };

    // If resume provided, analyze it before starting
    if (params.resumeText && params.resumeFileName) {
      const extractedText = params.resumeText;

      let analysis: any = undefined;
      if (this.deps.aiProvider.analyzeResume) {
        try {
          analysis = await this.deps.aiProvider.analyzeResume(extractedText, params.role);

          // Populate initial memory from resume
          if (analysis.skills && analysis.skills.length > 0) {
            session.memory.strengths.push(`Resume skills: ${analysis.skills.slice(0, 5).join(", ")}`);
          }
        } catch (err) {
          this.deps.logger.warn({ err }, "resume_analysis_failed");
        }
      }

      session.resume = {
        fileName: params.resumeFileName,
        uploadedAt: now,
        extractedText,
        analysis
      };

      this.appendAudit(session, "SESSION_STARTED", {
        role: params.role,
        level: params.level,
        resumeUploaded: true,
        resumeFileName: params.resumeFileName
      });
    } else {
      this.appendAudit(session, "SESSION_STARTED", { role: params.role, level: params.level });
    }

    await this.deps.candidateRepo.upsert(candidate);
    await this.deps.sessionRepo.upsert(session);

    // Transition into first round and ask first question deterministically.
    const updated = await this.ensureRoundStarted(sessionId, "SCREENING");

    await this.persistLiveState(updated);

    return this.toPublicState(updated);
  }

  async submitAnswer(params: { sessionId: string; answer: string; questionId?: string }) {
    const session = await this.getSessionOrThrow(params.sessionId);

    if (!canAnswer(session.state)) {
      throw new InvalidStateError(`Cannot answer in state ${session.state}`);
    }

    const round = this.getActiveRound(session);
    const activeQuestion = this.getActiveQuestion(round);

    if (params.questionId && params.questionId !== activeQuestion.id) {
      throw new ValidationError("questionId does not match active question");
    }

    const answer: InterviewAnswer = {
      questionId: activeQuestion.id,
      answerText: params.answer,
      answeredAt: nowIso()
      ,
      evaluation: null
    };
    round.answers.push(answer);

    await this.persistLiveState(session);

    this.appendAudit(session, "ANSWER_SUBMITTED", {
      roundType: round.roundType,
      questionId: activeQuestion.id
    });

    // Evaluate via AI (json only) then compute deterministic score contributions.
    const evalResp = await this.deps.aiProvider.evaluateAnswer({
      roundType: round.roundType,
      question: activeQuestion.prompt,
      answer: params.answer,
      memory: session.memory
    });

    answer.evaluation = { json: evalResp.json, reasoningText: evalResp.reasoningText };

    this.appendAudit(session, "ANSWER_EVALUATED", {
      roundType: round.roundType,
      questionId: activeQuestion.id
    });

    // Update structured memory (append-only, deduped).
    this.applyMemoryHints(session, evalResp.memoryHints);

    // If enough answers, score & decide round; otherwise ask next question.
    const cfg = this.deps.decisionEngine.getConfig(round.roundType);

    if (round.answers.length >= cfg.questionsPerRound) {
      const rawEvaluations = round.answers
        .map((a) => a.evaluation?.json)
        .filter((x): x is unknown => x !== undefined && x !== null);
      const reasoningTexts = round.answers
        .map((a) => a.evaluation?.reasoningText)
        .filter((x): x is string => typeof x === "string");

      const roundResult = this.deps.decisionEngine.computeRoundResult({
        roundType: round.roundType,
        rawEvaluations,
        reasoningTexts
      });

      round.scorecard = roundResult.scorecard;
      round.verdict = roundResult.verdict;
      round.endedAt = nowIso();

      this.appendAudit(session, "ROUNDED_SCORED", {
        roundType: round.roundType,
        weightedScore: roundResult.scorecard.weightedScore,
        dimensions: roundResult.scorecard.dimensions
      });
      this.appendAudit(session, "ROUND_VERDICT", {
        roundType: round.roundType,
        verdict: roundResult.verdict,
        reasons: roundResult.explainableReasons
      });

      if (roundResult.verdict === "FAIL") {
        await this.reject(session, `Failed ${round.roundType} round`, roundResult.explainableReasons);
        await this.deps.sessionRepo.upsert(session);

        await this.persistLiveState(session, { completed: true });
        return this.toPublicState(session);
      }

      // If passing locally (or just finished), try generating profile if provider supports it.
      // We do this if we are passing the SCREENING round specifically, or just every round?
      // Requirement says "for 1st round... build a profile". 
      if (round.roundType === "SCREENING" && this.deps.aiProvider.generateProfile) {
        try {
          const transcript = round.questions.map(q => {
            const a = round.answers.find(ans => ans.questionId === q.id);
            return { question: q.prompt, answer: a?.answerText ?? "" };
          });

          const profile = await this.deps.aiProvider.generateProfile({
            transcript,
            role: session.context.role,
            level: session.context.level
          });

          session.profile = profile;
          await this.deps.sessionRepo.upsert(session);
        } catch (err) {
          this.deps.logger.warn({ err }, "profile_generation_failed");
        }
      }

      const nr = nextRound(round.roundType);
      if (!nr) {
        await this.finalize(session, {
          finalVerdict: "SELECTED",
          reasons: [`Passed all rounds. Last score: ${roundResult.scorecard.weightedScore}`]
        });
        await this.deps.sessionRepo.upsert(session);

        await this.persistLiveState(session, { completed: true });
        return this.toPublicState(session);
      }

      // Move to next round.
      await this.deps.sessionRepo.upsert(session);
      const updated = await this.ensureRoundStarted(session.id, nr);

      await this.persistLiveState(updated);
      return this.toPublicState(updated);
    }

    // Ask next question within current round.
    await this.askNextQuestion(session, round);
    await this.deps.sessionRepo.upsert(session);

    await this.persistLiveState(session);

    return this.toPublicState(session);
  }

  async getState(params: { sessionId: string }) {
    const session = await this.getSessionOrThrow(params.sessionId);
    return this.toPublicState(session);
  }

  async getResult(params: { sessionId: string }) {
    const session = await this.getSessionOrThrow(params.sessionId);
    if (session.state !== "FINAL_DECISION" && session.state !== "REJECTED") {
      throw new InvalidStateError("Interview not completed");
    }

    const candidate = await this.deps.candidateRepo.getById(session.candidateId);

    return {
      sessionId: session.id,
      candidateId: session.candidateId,
      candidateStatus: candidate?.status ?? "IN_PROGRESS",
      state: session.state,
      memory: session.memory,
      rounds: session.rounds.map((r) => ({
        roundType: r.roundType,
        verdict: r.verdict,
        scorecard: r.scorecard
      })),
      auditLog: session.auditLog
    };
  }

  private async ensureRoundStarted(sessionId: string, roundType: RoundType) {
    const session = await this.getSessionOrThrow(sessionId);
    const candidate = await this.deps.candidateRepo.getById(session.candidateId);
    if (!candidate) throw new NotFoundError("candidate not found");

    const state = roundToState(roundType);
    session.state = state;

    candidate.currentRound = roundType;
    candidate.updatedAt = nowIso();

    const round: InterviewRound = {
      roundType,
      questions: [],
      answers: [],
      scorecard: null,
      verdict: null,
      startedAt: nowIso(),
      endedAt: null
    };
    session.rounds.push(round);

    this.appendAudit(session, "ROUND_STARTED", { roundType });

    await this.askNextQuestion(session, round);

    await this.deps.candidateRepo.upsert(candidate);
    await this.deps.sessionRepo.upsert(session);

    return session;
  }

  private async askNextQuestion(session: InterviewSession, round: InterviewRound) {
    const askedQuestions = session.rounds.flatMap((r) => r.questions.map((q) => q.prompt));

    const resumeContext = session.resume ? {
      extractedText: session.resume.extractedText,
      analysis: session.resume.analysis
    } : undefined;

    const q = await this.deps.aiProvider.generateQuestion({
      roundType: round.roundType,
      role: session.context.role,
      level: session.context.level,
      memory: session.memory,
      askedQuestions,
      questionIndex: round.questions.length,
      resumeContext
    });

    const question: InterviewQuestion = {
      id: uuidv4(),
      roundType: round.roundType,
      prompt: q.prompt,
      createdAt: nowIso()
    };

    round.questions.push(question);
    this.appendAudit(session, "QUESTION_ASKED", { roundType: round.roundType, questionId: question.id });
  }

  private async persistLiveState(session: InterviewSession, opts?: { completed?: boolean }) {
    // Redis is a *live* state store: best-effort, not source-of-truth.
    try {
      const activeRound = session.rounds[session.rounds.length - 1] ?? null;
      const questionIndex = activeRound ? Math.max(0, activeRound.questions.length - 1) : 0;

      if (opts?.completed) {
        await this.deps.interviewStateStore.clear(session.id);
        return;
      }

      await this.deps.interviewStateStore.set({
        sessionId: session.id,
        state: session.state,
        currentRound: activeRound ? activeRound.roundType : null,
        questionIndex,
        updatedAt: nowIso()
      });
    } catch (e) {
      this.deps.logger.warn({ err: e, sessionId: session.id }, "live_state_store_write_failed");
    }
  }

  private getActiveRound(session: InterviewSession): InterviewRound {
    const r = session.rounds.at(-1);
    if (!r) throw new InvalidStateError("No active round");
    return r;
  }

  private getActiveQuestion(round: InterviewRound): InterviewQuestion {
    const q = round.questions.find((qq) => !round.answers.some((a) => a.questionId === qq.id));
    if (!q) {
      // If no unanswered question exists, the orchestrator should have asked it.
      throw new InvalidStateError("No active question");
    }
    return q;
  }

  private appendAudit(session: InterviewSession, type: AuditEvent["type"], details: AuditEvent["details"]) {
    session.auditLog.push({ at: nowIso(), type, details });
  }

  private async reject(session: InterviewSession, message: string, reasons: string[]) {
    session.state = "REJECTED";
    session.endedAt = nowIso();

    const candidate = await this.deps.candidateRepo.getById(session.candidateId);
    if (candidate) {
      candidate.status = "REJECTED";
      candidate.updatedAt = nowIso();
      await this.deps.candidateRepo.upsert(candidate);
    }

    this.appendAudit(session, "SESSION_VERDICT", {
      verdict: "REJECTED",
      message,
      reasons
    });
  }

  private async finalize(session: InterviewSession, params: { finalVerdict: "SELECTED" | "REJECTED"; reasons: string[] }) {
    session.state = "FINAL_DECISION";
    session.endedAt = nowIso();

    const candidate = await this.deps.candidateRepo.getById(session.candidateId);
    if (candidate) {
      candidate.status = params.finalVerdict;
      candidate.updatedAt = nowIso();
      await this.deps.candidateRepo.upsert(candidate);
    }

    this.appendAudit(session, "SESSION_VERDICT", {
      verdict: params.finalVerdict,
      reasons: params.reasons
    });
  }

  private applyMemoryHints(
    session: InterviewSession,
    hints?: {
      strengths?: string[];
      weaknesses?: string[];
      notes?: string[];
    }
  ) {
    if (!hints) return;

    const merge = (arr: string[], incoming?: string[]) => {
      if (!incoming) return;
      for (const s of incoming) {
        if (!arr.includes(s)) arr.push(s);
      }
    };

    merge(session.memory.strengths, hints.strengths);
    merge(session.memory.weaknesses, hints.weaknesses);
    merge(session.memory.notes, hints.notes);
  }

  private async getSessionOrThrow(id: string): Promise<InterviewSession> {
    const s = await this.deps.sessionRepo.getById(id);
    if (!s) throw new NotFoundError("session not found");
    return s;
  }

  private toPublicState(session: InterviewSession) {
    const activeRound = session.rounds.at(-1) ?? null;
    const activeQuestion = activeRound
      ? activeRound.questions.find((q) => !activeRound.answers.some((a) => a.questionId === q.id)) ?? null
      : null;

    return {
      sessionId: session.id,
      candidateId: session.candidateId,
      state: session.state,
      currentRound: activeRound?.roundType ?? null,
      activeQuestion: activeQuestion
        ? { id: activeQuestion.id, prompt: activeQuestion.prompt, roundType: activeQuestion.roundType }
        : null,
      progress: session.rounds.map((r) => ({
        roundType: r.roundType,
        answers: r.answers.length,
        questionsAsked: r.questions.length,
        verdict: r.verdict,
        weightedScore: r.scorecard?.weightedScore ?? null,
        feedback: r.scorecard?.reasoning ?? null,
        dimensions: r.scorecard?.dimensions ?? null
      })),
      profile: session.profile,
      memory: session.memory
    };
  }
}
