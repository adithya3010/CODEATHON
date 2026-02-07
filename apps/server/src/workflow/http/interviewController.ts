import type { InterviewOrchestrator } from "../interviewOrchestrator.js";

export class InterviewController {
  constructor(private readonly orchestrator: InterviewOrchestrator) {}

  async startInterview(body: { candidateId?: string; role: string; level: "junior" | "mid" | "senior" }) {
    return this.orchestrator.startInterview(body);
  }

  async submitAnswer(body: { sessionId: string; answer: string; questionId?: string }) {
    return this.orchestrator.submitAnswer(body);
  }

  async getState(params: { sessionId: string }) {
    return this.orchestrator.getState(params);
  }

  async getResult(params: { sessionId: string }) {
    return this.orchestrator.getResult(params);
  }
}
