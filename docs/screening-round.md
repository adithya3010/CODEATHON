# SCREENING Round - Resume Upload & Communication Assessment

## Overview

The SCREENING round has been redesigned to focus on:
1. **Resume Upload & Analysis** - Building context from the candidate's background
2. **Communication Check** - Assessing how candidates articulate their experience

## Features

### 1. Resume Upload (Optional)

Candidates can upload their resume when starting the interview. Supported formats:
- Plain text (.txt)
- PDF (.pdf) 
- Word documents (.doc, .docx)

**Backend Processing:**
- Resume text is extracted and stored
- AI analyzes the resume to extract:
  - Work experience entries
  - Technical skills
  - Education background
  - Summary of qualifications
- Initial memory is seeded with detected skills

### 2. Resume-Based Questions

Questions in the SCREENING round are tailored to the candidate's resume:
- "Based on your resume, tell me about your most significant technical achievement..."
- "How do you typically explain complex technical concepts to non-technical team members?"

Questions focus on communication style and relevance of experience rather than pure technical depth.

### 3. Scoring Dimensions

The SCREENING round evaluates:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| **Communication** | 40% | Clarity, structure, and articulation of ideas |
| **Relevance** | 35% | Connection to target role and meaningful examples |
| **Presentation** | 25% | Professional presentation and organization of thoughts |

**Pass Threshold:** 60/100 (weighted score)

**Questions Per Round:** 2 (reduced from 3 to focus on quality)

## Implementation Details

### Backend Changes

**Models** ([domain/models.ts](../apps/server/src/domain/models.ts)):
```typescript
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
  // ... existing fields
  resume?: ResumeData;
};
```

**AI Contract** ([workflow/ai/contracts.ts](../apps/server/src/workflow/ai/contracts.ts)):
- Added `resumeContext` to `QuestionGenerationContext`
- Added optional `analyzeResume()` method to `AiProvider` interface

**Orchestrator** ([workflow/interviewOrchestrator.ts](../apps/server/src/workflow/interviewOrchestrator.ts)):
- `startInterview()` accepts `resumeText` and `resumeFileName`
- Calls AI to analyze resume if provided
- Seeds memory with detected skills
- Passes resume context to question generation

### Frontend Changes

**App Component** ([web/src/ui/App.tsx](../apps/web/src/ui/App.tsx)):
- Added file upload input for resume
- Reads file content as text
- Displays upload status and file size
- Sends resume data with start interview request

**API Layer** ([web/src/ui/api.ts](../apps/web/src/ui/api.ts)):
- Updated `startInterview()` to accept optional resume parameters

## User Experience

### Starting an Interview WITH Resume:

1. User uploads resume file
2. Frontend reads file content
3. Backend analyzes resume and extracts structured data
4. SCREENING questions are contextualized to resume content
5. Initial memory is populated with skills from resume

### Starting an Interview WITHOUT Resume:

1. User clicks "Start" without uploading
2. Generic communication questions are asked
3. Standard SCREENING evaluation applies

## Example Flow

```
User uploads resume: "5 years Python, led team, AWS certified..."

AI Analysis:
{
  "experience": ["5 years backend development", "Team lead"],
  "skills": ["python", "aws", "docker", "kubernetes"],
  "education": ["BS Computer Science"],
  "summary": "Experienced backend engineer with cloud expertise"
}

Memory seeded: 
- strengths: ["Resume skills: python, aws, docker, kubernetes, ..."]

Question 1:
"Based on your resume, I see you have experience leading teams and working 
with AWS. Tell me about your most significant technical achievement and how 
you communicated its impact to stakeholders."

[Candidate answers...]

Evaluation:
{
  "communication": 8,
  "relevance": 7,
  "presentation": 8,
  "summary": "Clear communication with relevant examples from experience"
}
```

## Technical Notes

- Resume analysis is **optional** - system works with or without it
- MockAiProvider has simple pattern matching for demo purposes
- OpenAiCompatibleProvider uses structured JSON schema for analysis
- Resume text is limited by request size (current: 1MB limit in Express)
- For large PDFs, consider adding PDF parsing library in production

## Future Enhancements

- [ ] Add PDF text extraction (currently expects plain text)
- [ ] Support for more file formats
- [ ] Resume scoring/matching against role requirements
- [ ] Automatic role detection from resume
- [ ] Resume highlights displayed in UI during interview
- [ ] Export interview results with resume context
