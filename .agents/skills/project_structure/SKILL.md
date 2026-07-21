---
name: project_structure
description: Understands and explains the architecture, database schema, and layout of the Quizmaster Pro project.
---

# Quizmaster Pro - Project Architecture and Structure Reference

This skill guides you on the codebase layout, system architecture, database schema, and key components of the Quizmaster Pro application. Use this reference when making modifications or debugging.

## 📂 Project Structure

- `server.ts` (Root)
  - The main backend application built with Express and `better-sqlite3`.
  - Handles API routing, JWT authentication (ESS & System admins), database seeding on empty startup, SSE (Server-Sent Events) live clients broadcasting, and stress test simulation.
- `data/`
  - Directory where SQLite databases are stored.
  - `data/master.db`: Central database.
  - `data/campaign_<campaignId>.db`: Dedicated database per campaign (exam room).
- `src/` (Frontend - React + TypeScript + Vite)
  - `src/App.tsx`: Main React component routing and coordinator. Serves the Student Exam Room, Admin Dashboard, and login flows.
  - `src/index.css`: Styling core (Vanilla CSS).
  - `src/types.ts`: TypeScript type definitions shared across the frontend.
  - `src/components/`: Modular UI components:
    - [AAPICOSmartEvalLogo.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/AAPICOSmartEvalLogo.tsx): App Logo.
    - [AdminRolesManager.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/AdminRolesManager.tsx): Admin role configuration and access controls.
    - [BrandingGuidelines.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/BrandingGuidelines.tsx): UI/UX themes and styling colors.
    - [BulkUpload.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/BulkUpload.tsx): Bulk uploading functionality.
    - [CampaignAnalytics.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/CampaignAnalytics.tsx): Result metrics, reports, and grading analytics.
    - [CampaignManager.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/CampaignManager.tsx): Exam room creation, configuration, status management, and parameters (timing, question selection modes).
    - [FormBuilder.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/FormBuilder.tsx): Custom form creation and management.
    - [QuestionBank.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/QuestionBank.tsx): Booklet, categories, difficulties, and central question management.
    - [QuizTaker.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/QuizTaker.tsx): Student view answering questions, showing timers, and final submission.
    - [WebGuidedTour.tsx](file:///c:/Users/wajeepradit.p/git/Quiz/quizmaster-pro/src/components/WebGuidedTour.tsx): Guided interactive onboarding tour.

---

## 🗄️ Database Design

Quizmaster Pro uses SQLite via `better-sqlite3` and adopts a multi-tenant DB structure for performance and isolation:

### 1. Central Database (`data/master.db`)

Holds shared administration data, the central question bank, and configurations for all rooms (campaigns).

- **`admins`**: Administrator accounts
  - `id` (TEXT PRIMARY KEY)
  - `username_or_id` (TEXT UNIQUE) - ESS employee ID or system username
  - `name`, `department` (TEXT)
  - `type` (TEXT) - `'system'` or `'ess'`
  - `password` (TEXT) - Hashed password for system admins; null for ESS admins (authenticated via ESS portal token)
  - `role` (TEXT) - `'super_admin'` or `'admin'`
  
- **`campaigns`**: Individual Exam Rooms
  - `id` (TEXT PRIMARY KEY) - The unique Campaign ID/Room ID
  - `name`, `group_name`, `status` (TEXT) - Status can be `'ACTIVE'`, `'DRAFT'`, etc.
  - `passing_percentage`, `time_limit_minutes`, `max_attempts` (INTEGER)
  - `questions_json` (TEXT) - Serialized questions array configured for this room
  - `question_selection_mode` (TEXT) - `'manual'` or `'rules'`
  - `manual_question_ids_json` (TEXT) - List of question IDs selected manually
  - `rule_category`, `rule_difficulty`, `rule_count`, `target_booklet` (TEXT/INTEGER) - Used when generating dynamic/rule-based exams
  
- **`questions`**: Shared Question Bank
  - `id` (TEXT PRIMARY KEY)
  - `text`, `options_json` (TEXT)
  - `correct_index` (INTEGER)
  - `explanation` (TEXT)
  - `packet_id`, `booklet` (TEXT) - Associates the question with a packet
  
- **`exam_packets`**: Question Booklets / Packs
  - `id` (TEXT PRIMARY KEY)
  - `name` (TEXT UNIQUE)

### 2. Campaign-Specific Databases (`data/campaign_<campaignId>.db`)

Dynamically loaded per active room to keep submission data cleanly separated.

- **`submissions`**: Finalized exam completions
  - `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
  - `user_name`, `user_identifier` (TEXT)
  - `score` (REAL), `total_questions` (INTEGER), `correct_answers` (INTEGER)
  - `passed` (INTEGER) - 0 or 1
  - `duration_seconds` (INTEGER)
  - `answers_json` (TEXT)
  - `department`, `surname`, `em_no`, `company_email`, `company` (TEXT)

- **`attempts`**: Active, ongoing exam sessions (before submission)
  - `id` (TEXT PRIMARY KEY) - Session/Attempt token
  - `user_identifier` (TEXT)
  - `questions_json` (TEXT) - Order of questions assigned to the user
  - `created_at` (TEXT)

---

## 🛠️ Verification & Development Workflow

- Run Dev Server: `npm run dev` (starts the TS backend via `tsx server.ts` and spins up the Vite dev server inside it).
- Build App: `npm run build` (bundles front-end with Vite and uses esbuild to compile `server.ts` into `dist/server.cjs`).
- Type Checks: `npm run lint` or `npx tsc --noEmit`.
