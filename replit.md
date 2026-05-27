# 헬로펀키즈 주니어 어학원 — 통합 도구

영어학원 선생님 전용 도구 모음. 두 개의 독립된 앱으로 구성:

1. **Book Quiz Lab** (`/`) — 원서 리딩 학습 자료 4종(단어장/어휘퀴즈/독해퀴즈/정답지) 자동 생성
2. **영어홀릭 평가서** (`/english-holic/`) — 시험지 사진 업로드 → AI 채점·분석 → 학부모용 평가서 PDF 생성

두 앱은 별개 제품이지만 동일한 워크스페이스(pnpm monorepo)와 같은 API 서버를 공유한다.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API 서버 (port 8080, /api 프록시)
- `pnpm --filter @workspace/book-quiz-lab run dev` — Book Quiz Lab 프론트엔드 (`/`)
- `pnpm --filter @workspace/english-holic-assessment run dev` — 영어홀릭 평가서 프론트엔드 (`/english-holic/`)
- `pnpm run typecheck` — 전체 타입체크
- `pnpm --filter @workspace/api-spec run codegen` — OpenAPI → React Query hooks + Zod 재생성
- `pnpm --filter @workspace/db run push` — DB 스키마 push
- 필요한 환경변수: `DATABASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`

## Stack

- pnpm workspaces, Node 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind + shadcn/ui + framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (테이블: `books`, `materials` — Book Quiz Lab / `assessments` — 영어홀릭 평가서)
- AI: Anthropic Claude (claude-sonnet-4-6) via Replit AI Integrations 프록시
- PDF: pdfkit (서버에서 생성, base64로 전송)
- 이미지: heic-convert (아이폰 HEIC → JPEG)
- 코드 생성: Orval (OpenAPI → React Query hooks + Zod) — Book Quiz Lab만 사용

## 구조

```
artifacts/
├── api-server/                      공유 API 서버
│   └── src/routes/
│       ├── books, materials,        Book Quiz Lab 전용
│       │   generate, storage, health
│       └── assessments.ts           영어홀릭 평가서 전용
├── book-quiz-lab/                   Book Quiz Lab 프론트엔드 (`/`)
└── english-holic-assessment/        영어홀릭 평가서 프론트엔드 (`/english-holic/`)
```

- `lib/api-spec/openapi.yaml` — Book Quiz Lab API 스펙
- `lib/db/src/schema/index.ts` — `books`, `materials`
- `artifacts/api-server/src/lib/pdfBuilder.ts` — 4종 PDF 빌더 (단어장/어휘퀴즈/독해퀴즈/정답지)
- `artifacts/api-server/src/lib/pdfBuilderAssessment.ts` — 평가서 PDF 빌더
- `artifacts/api-server/src/routes/assessments.ts` — `POST /api/assessments/generate` (multipart upload)

## 핵심 동작

### Book Quiz Lab (`/`)
1. 사이드바에서 책 추가 → DB의 `books`에 저장
2. 책 선택 → "새 자료 생성" → 챕터명 + 학년 + 작성자 입력 → Claude가 단어장 + 어휘퀴즈(스펠링 포함) + 독해퀴즈를 JSON으로 생성 → `materials`에 JSONB로 저장 → 서버에서 PDF 4개 생성 → 자동 다운로드
3. 아카이브에서 책별 자료 목록 → "4개 PDF 모두 다운로드"는 저장된 JSON으로 재생성 (AI 재호출 없음)

### 영어홀릭 평가서 (`/english-holic/`)
1. 학생 이름 + 교재명 + 담당 선생님(이현진/이진미/강나영) 입력
2. 시험지 사진 1~8장 업로드 (HEIC 자동 변환)
3. "평가서 생성" → 서버에서 HEIC→JPEG 변환 → Claude vision으로 분석 (총평/잘한 점/보완할 점/다음 학습 제안/영역별 점수/최고의 문장/교정 예시/학부모 메시지)
4. PDF 자동 다운로드 (라더 차트 + 문장 클리닉 + 학부모 메시지 포함, 정확히 A4 양면 1장)
5. 생성된 평가서는 `assessments` 테이블에 자동 저장 → `/english-holic/archive`에서 검색·재다운로드 (AI 재호출 없이 저장된 JSON으로 PDF 재생성)

## 제품

- 선생님 전용 도구. 학생 모드 없음.
- 한국어 UI. Navy `#1a2e5a` / Gold `#c9a227` / White. 이모지 사용 안 함.
- 작성자/담당 선생님: 이현진 원장, 이진미 강사, 강나영 강사

## User preferences

- 한국어 UI
- 색상: Navy (#1a2e5a), Gold (#c9a227), White
- 이모지 사용 안 함
- **Book Quiz Lab과 영어홀릭 평가서는 별개 앱**이며, 한 앱에 합치지 말 것

## Gotchas

- `openapi.yaml` 변경 후: codegen → typecheck → 워크플로우 재시작
- `materials` 테이블의 `vocabulary`, `vocabQuestions`, `readingQuestions`는 JSONB이며, 타입은 `lib/db/src/schema/index.ts` 참고
- DB 푸시가 인터랙티브 프롬프트 때문에 실패하면, 충돌하는 테이블을 `DROP TABLE ... CASCADE`로 직접 삭제 후 재시도
- AI 자료 생성은 30~60초, 평가서는 30~90초 걸릴 수 있음
- 평가서는 OpenAPI를 거치지 않음 (multipart upload). 프론트에서 절대경로 `/api/assessments/generate`로 호출 (공유 프록시가 자동 라우팅)
- 새 artifact를 추가할 때는 `previewPath`를 유일하게 두고, 둘 중 하나는 반드시 `/`에 있어야 함 (현재 Book Quiz Lab)

## Pointers

- 워크스페이스 구조와 TS 설정: `pnpm-workspace` 스킬
- Anthropic 호출 방식: `ai-integrations-anthropic` 스킬
- 새 artifact 추가: `artifacts` 스킬
