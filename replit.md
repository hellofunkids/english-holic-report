# Book Quiz Lab

영어학원 원서 리딩 학습 자료 자동 생성 앱. 책 제목과 챕터/섹션을 입력하면 AI가 4종의 자료(단어장, 어휘 퀴즈지, 독해 퀴즈지, 정답지)를 한 번에 생성하여 PDF로 다운로드하고 책별로 아카이브한다.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 (port 8080, /api 프록시)
- `pnpm --filter @workspace/book-quiz-lab run dev` — React 프론트엔드
- `pnpm run typecheck` — 전체 타입체크
- `pnpm --filter @workspace/api-spec run codegen` — OpenAPI → React Query hooks + Zod 재생성
- `pnpm --filter @workspace/db run push` — DB 스키마 push
- 필요한 환경변수: `DATABASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (테이블 2개: `books`, `materials`)
- AI: Anthropic Claude (claude-sonnet-4-6) via Replit AI Integrations 프록시
- PDF: pdfkit (서버에서 생성, base64로 전송)
- 코드 생성: Orval (OpenAPI → React Query hooks + Zod)

## 구조

- `lib/api-spec/openapi.yaml` — API 스펙 (단일 진실 원천)
- `lib/db/src/schema/index.ts` — `books`, `materials` 테이블 정의
- `artifacts/api-server/src/routes/` — books, materials, generate, storage, health
- `artifacts/api-server/src/lib/pdfBuilder.ts` — 4종 PDF 빌더 (단어장/어휘퀴즈/독해퀴즈/정답지)
- `artifacts/book-quiz-lab/src/pages/home.tsx` — 단일 페이지 UI (사이드바 + 메인 패널)

## 핵심 동작

1. **교재 추가**: 사이드바에서 책 제목 입력 → DB의 `books`에 저장
2. **자료 생성**: 책 선택 → "새 자료 생성" → 챕터명 + 학년 입력 → Claude가 vocabulary(20개) + 어휘퀴즈(15문항) + 독해퀴즈(20문항)를 한 번에 JSON으로 생성 → `materials` 테이블에 JSONB로 저장 → 서버에서 PDF 4개 생성 → 브라우저에서 자동 다운로드
3. **아카이브**: 책별로 생성된 자료 목록 표시 → "4개 PDF 모두 다운로드" 클릭 시 저장된 JSON으로 PDF 재생성 (AI 재호출 없음)

## 제품

- 선생님 전용 도구. 학생 모드 없음.
- 출력 자료 4종:
  - 단어장 (영단어 / 한국어 뜻 / 예문)
  - 어휘 퀴즈지 (4가지 유형 혼합: fill_blank, match_meaning, choose_word, translation)
  - 독해 퀴즈지 (20문항 4지선다)
  - 정답지 (어휘 + 독해 통합)

## User preferences

- 한국어 UI
- 색상: Navy (#1a2e5a), Gold (#c9a227), White
- 이모지 사용 안 함

## Gotchas

- `openapi.yaml` 변경 후: codegen → typecheck → 워크플로우 재시작
- `materials` 테이블의 `vocabulary`, `vocabQuestions`, `readingQuestions`는 JSONB이며, 타입은 `lib/db/src/schema/index.ts`의 `VocabEntry`, `VocabQuestion`, `ReadingQuestion` 참고
- DB 푸시가 인터랙티브 프롬프트 때문에 실패하면, 충돌하는 테이블을 `DROP TABLE ... CASCADE`로 직접 삭제 후 재시도
- AI 생성은 30~60초 걸릴 수 있음 (Claude가 단어장 + 2종 퀴즈를 한 번의 호출로 생성)

## Pointers

- 워크스페이스 구조와 TS 설정: `pnpm-workspace` 스킬
- Anthropic 호출 방식: `ai-integrations-anthropic` 스킬
