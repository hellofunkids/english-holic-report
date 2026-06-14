---
name: Vercel / CI build of this Replit monorepo
description: Why root `pnpm run build` fails outside Replit and how the vite configs must guard Replit-only env vars
---

# Building this monorepo outside Replit (Vercel/CI)

Root `pnpm run build` = `pnpm run typecheck && pnpm -r --if-present run build`,
so it typechecks libs+artifacts then builds EVERY workspace package (api-server +
all three vite apps + mockup-sandbox).

## Vite configs must not require PORT/BASE_PATH at build time
Each `artifacts/*/vite.config.ts` reads `process.env.PORT` and
`process.env.BASE_PATH`. Replit always provides these via the workflow; Vercel/CI
do NOT. If the config throws when they are missing, `vite build` aborts before
doing anything (mockup-sandbox fails first, then the others).

**Rule:** only require PORT/BASE_PATH for the dev server (`command === "serve"`).
During `vite build`, fall back (`port = rawPort ? Number(rawPort) : 5173`,
`base: basePath ?? "/"`). On Replit BASE_PATH is still set during the deploy
build, so the real value is used there; only non-Replit builds fall back to "/".

**Why:** keeps Replit dev fail-fast behavior intact while letting Vercel build.
**How to apply:** any new vite-based artifact must use the same `command`-gated
guard, or it will break Vercel `pnpm run build`.

## "Emit skipped" / TS6305 is a build-ordering symptom, not a source bug
"src/routes/health.ts: Emit skipped" on Vercel was TS6305 — composite libs
(`@workspace/db`, `@workspace/api-zod`) not built before tsc compiled api-server.
It surfaces on whichever route file imports a `@workspace/*` lib; the file itself
is fine. Fixed by building libs first (`tsc --build`). Don't go hunting for an
import/export bug in the named file.

## defineConfig async return type
If you convert a vite config to `defineConfig(async (env) => ({...}))`, annotate
the return as `Promise<UserConfig>` (import `type UserConfig` from "vite") or
typecheck fails with a confusing "no properties in common with UserConfig" error.

## Registered guard: `vercel-build` validation
Root script `build:ci` = `env -u PORT -u BASE_PATH -u REPL_ID -u REPLIT_DEV_DOMAIN
pnpm run build`. It is registered as the `vercel-build` validation step so a clean
(Replit-env-free) production build is checked from inside the workspace before a
Vercel deploy. If any artifact reintroduces an unconditional PORT/BASE_PATH
dependency at build time, this run fails. Trigger it via the validation tooling.

## Verifying a Vercel build locally
Simulate clean CI: delete `*.tsbuildinfo` + lib/artifact `dist`, then
`env -u PORT -u BASE_PATH -u REPL_ID pnpm run build`. Full build can exceed a
2-min single-command timeout — verify stages separately (typecheck, vite builds,
api-server) or run in background and poll.
