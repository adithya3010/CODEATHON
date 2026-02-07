# Codeathon Interview Orchestrator

**An AI-Powered Technical Interview Platform**

The **Codeathon Interview Orchestrator** is a full-stack application designed to conduct automated, multi-round technical interviews. tailored to specific roles and experience levels. It uses Generative AI (OpenAI-compatible) to generate context-aware questions, evaluate candidate answers, and manage the interview state in real-time.

---

## 🚀 The 3-Round Interview Process

The application guides candidates through a structured, 3-stage interview workflow. Each round assesses different dimensions of a candidate's profile.

### 1. 🟢 Screening Round (Round 1)
**Focus**: Soft skills, communication, and resume validation.
-   **Input**: The candidate's resume is analyzed to extract key skills and experience.
-   **Workflow**: The AI asks behavioral questions and verifies experience claims from the resume.
-   **Output**: A generated **Candidate Profile** summarizing strengths, weaknesses, and cultural fit.
-   **Goal**: Determine if the candidate is a basic fit for the role.

### 2. 🔵 Technical Round (Round 2)
**Focus**: Core technical competencies.
-   **Input**: The Role (e.g., "Frontend Dev") and Level (e.g., "Senior").
-   **Workflow**: The AI generates technical questions specific to the domain. It adapts to the candidate's previous answers—digging deeper if they answer well, or simplifying if they struggle.
-   **Scoring**: Answers are evaluated on **Accuracy**, **Completeness**, and **Clarity**.

### 3. 🟣 Scenario Round (Round 3)
**Focus**: Complex problem-solving and system design.
-   **Input**: The candidate's verified skills from previous rounds.
-   **Workflow**: The candidate is presented with a complex, open-ended scenario (e.g., "Design a scalable notification system").
-   **Scoring**: Evaluates **Reasoning**, **Trade-offs Analysis**, and **System Thinking**.
-   **Outcome**: A final **Hire/No-Hire** recommendation is generated based on the aggregate performance across all rounds.

---

## 🛠️ Technical Architecture

This project is a **Monorepo** built with modern web technologies:

| Component | Tech Stack | Description |
| :--- | :--- | :--- |
| **Frontend** | **React**, Vite, TypeScript | fast, responsive SPA. Uses Context API for state and Vanilla CSS for styling. |
| **Backend** | **Node.js**, Express, TypeScript | REST API. Handles orchestration, AI integration, and state management. |
| **Database** | **PostgreSQL** | Primary source of truth for Users, Sessions, and Audit Logs. |
| **State Store** | **Redis** | High-performance store for "live" interview state and session recovery. |
| **AI/LLM** | **OpenAI API** | `gpt-4o-mini` (or similar) used for all generation and reasoning tasks. |
| **Validation** | **Zod** | End-to-end type safety and runtime schema validation. |

### Directory Structure
```
c:\codeathon\
├── apps\
│   ├── web\          # Frontend Application (React)
│   └── server\       # Backend API & Orchestrator (Express)
├── docker-compose.yml # Infrastructure (Postgres, Redis)
└── package.json      # NPM Workspace configuration
```

---

## ⚡ Getting Started (Developer Guide)

Follow these steps to set up the project locally for development.

### Prerequisites
-   **Node.js** (v18 or higher)
-   **Docker** & **Docker Compose** (for Database & Redis)
-   **OpenAI API Key** (for AI features)

### 1. Start Infrastructure
Spin up the PostgreSQL database and Redis cache using Docker:
```bash
docker-compose up -d
```
*Wait a few seconds for the database to be ready.*

### 2. Install Dependencies
Install all packages for the monorepo from the root directory:
```bash
npm install
```

### 3. Configure Environment
1.  Go to `apps/server`.
2.  Copy `.env.example` to `.env`.
3.  Add your OpenAI API Key:
    ```env
    OPENAI_API_KEY=sk-your-key-here...
    ```
    *Note: If you don't provide a key, the system may default to a Mock Provider for testing.*

### 4. Run the Application
You can run both the frontend and backend concurrently with a single command:
```bash
npm run dev:all
```
-   **Frontend**: [http://localhost:5173](http://localhost:5173)
-   **Backend API**: [http://localhost:3001](http://localhost:3001)

### 5. Accessing the Database (Optional)
You can connect to the local Postgres instance using any SQL client:
-   **URL**: `postgres://postgres:postgres@localhost:5432/interview_orchestrator`

---

## 🧪 Development Workflow

-   **Backend Logic**: Key orchestration logic is in `apps/server/src/workflow/interviewOrchestrator.ts`.
-   **AI Prompts**: Prompts for generating questions and evaluating answers are in `apps/server/src/workflow/ai/openAiCompatibleProvider.ts`.
-   **Frontend UI**: The main interview interface is in `apps/web/src/ui/App.tsx`.

### Running Tests
To check type safety across the entire monorepo:
```bash
npm run typecheck
```
