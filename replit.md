# Book Quiz Lab

영어학원 원서 리딩 학습 퀴즈 앱. 학생들이 원서 수업 후 단어시험과 comprehension quiz를 온라인으로 풀고, 선생님이 결과를 확인할 수 있는 MVP 앱.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied via /api)
- `pnpm --filter @workspace/book-quiz-lab run dev` — run the React frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (auto-provisioned by Replit)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI source of truth for all endpoints
- `lib/db/src/schema/index.ts` — Drizzle DB schema (books, chapters, vocabulary, quizzes, submissions)
- `lib/api-client-react/src/generated/` — auto-generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — auto-generated Zod schemas for server validation (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers (books.ts, submissions.ts, stats.ts)
- `artifacts/book-quiz-lab/src/pages/` — React pages (home, student flow, teacher flow)

## Architecture decisions

- Contract-first: OpenAPI spec gates all frontend work. Run codegen after every spec change.
- Scoring happens server-side in `submissions.ts` — the server receives raw answers and returns scored results with per-question details.
- Vocab quiz questions are generated client-side from the vocabulary list (mixed types: EN→KO, KO→EN, multiple choice, fill-in-blank).
- Comprehension quizzes come directly from the API (stored as multiple_choice or short_answer).
- No auth by design (MVP) — teacher mode is open. Add Clerk auth if needed later.

## Product

- **Student mode**: Name entry → Book selection → Chapter selection → Vocab quiz (mixed types) → Comprehension quiz → Score + review of wrong answers
- **Teacher mode**: Dashboard with stats → Book/chapter management → Vocabulary + quiz question editor → Results table + leaderboard

## User preferences

- Korean UI labels for student-facing screens (학생 모드, 선생님 모드, etc.)
- Colors: Navy (#1a2e5a), White, Gold (#c9a227) accent
- Large, touchable buttons (mobile/tablet friendly)
- No emojis in the UI

## Completed Features (v2)

- Full Korean UI on all pages (home, student flow, teacher dashboard, books, results, content editor)
- Book cover image upload via object storage (presigned URL → PUT → stored path)
- Level selector per chapter: elementary4 / elementary5 / elementary6 / middle
- AI PDF generation: POST /api/chapters/:chapterId/generate-pdf → Claude generates 20 MC questions → pdfkit builds quiz PDF + answer key PDF → base64 returned → browser downloads both files
- Teacher content editor has "AI 시험지 생성" button with level selector and download links

## Gotchas

- When creating quiz questions with `questionType: "short_answer"`, omit the `options` field (don't send `null`) — the Zod schema expects array or undefined.
- After every `lib/api-spec/openapi.yaml` change: run codegen, then `typecheck:libs`, then restart workflows.
- Seed data lives in book id=1, chapter id=1 (Charlotte's Web, Chapter 1).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
