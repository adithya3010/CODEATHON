import type { AiProvider, EvaluationResponse, GeneratedQuestion, QuestionGenerationContext } from "./contracts.js";

export class MockAiProvider implements AiProvider {
  async generateQuestion(ctx: QuestionGenerationContext): Promise<GeneratedQuestion> {
    if (ctx.roundType === "SCREENING") {
      // Pool of screening questions - more than needed to avoid repetition
      const allQuestions = [
        "Tell me about a challenging project where you had to communicate technical decisions to non-technical stakeholders.",
        "Describe a situation where you had to quickly learn a new technology. How did you approach it?",
        "What's your process for breaking down a complex problem into manageable parts?",
        "Give me an example of how you've contributed to improving team processes or workflows.",
        "Describe a time when you received critical feedback. How did you respond?",
        "What motivates you in your work, and how do you stay productive during challenging periods?"
      ];

      // Filter out already asked questions
      const availableQuestions = allQuestions.filter(q =>
        !ctx.askedQuestions.some(asked => asked.includes(q.substring(0, 30)))
      );

      const question = availableQuestions.length > 0
        ? availableQuestions[0]
        : allQuestions[ctx.askedQuestions.length % allQuestions.length];

      return { prompt: `[MOCK ${ctx.roundType}] ${question}` };
    }

    const base =
      ctx.roundType === "TECHNICAL"
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
          communication: score((len > 120 ? 7 : 5) + (hasStructure ? 2 : 0)),
          relevance: score((/project|experience|team|delivered|implemented/i.test(params.answer) ? 7 : 5)),
          presentation: score((len > 100 ? 6 : 4) + (hasStructure ? 1 : 0))
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

  async analyzeResume(resumeText: string, targetRole: string): Promise<{
    experience: string[];
    skills: string[];
    education: string[];
    summary: string;
  }> {
    // Mock resume analysis - extract basic patterns
    const experience: string[] = [];
    const skills: string[] = [];
    const education: string[] = [];

    // Simple pattern matching for demo
    const techKeywords = /\b(javascript|typescript|python|java|react|node|aws|docker|kubernetes|sql)\b/gi;
    const matches = resumeText.match(techKeywords) || [];
    const uniqueSkills = [...new Set(matches.map(s => s.toLowerCase()))];
    skills.push(...uniqueSkills.slice(0, 10));

    // Extract years of experience pattern
    const yearsPattern = /(\d+)\s*(years?|yrs?)/gi;
    const yearsMatch = resumeText.match(yearsPattern);
    if (yearsMatch) {
      experience.push(`Mentioned experience: ${yearsMatch[0]}`);
    }

    const summary = `Mock analysis: Resume appears to be for ${targetRole} role. Detected ${skills.length} relevant skills. Text length: ${resumeText.length} characters.`;

    return { experience, skills, education, summary };
  }

  async generateProfile(ctx: {
    transcript: { question: string; answer: string }[];
    role: string;
    level: string;
  }): Promise<string> {
    const answerCount = ctx.transcript.length;
    const totalWords = ctx.transcript.reduce((sum, t) => sum + t.answer.split(' ').length, 0);
    const avgWords = Math.round(totalWords / Math.max(answerCount, 1));

    return `**Candidate Profile Summary**

Role: ${ctx.role} (${ctx.level})
Questions Answered: ${answerCount}
Average Response Length: ${avgWords} words

**Communication Style**: ${avgWords > 20 ? 'Detailed and thorough' : 'Concise and direct'}
**Engagement Level**: ${answerCount >= 3 ? 'Fully engaged throughout the screening' : 'Partially engaged'}

This is a mock profile generated for testing purposes.`;
  }
}
