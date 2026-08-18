# Product-Management Cycle — State

- **Project:** NanoQuiz
- **Started:** 2026-08-18
- **Phase:** done
- **Batch:** 1

## Source Issues
F-05 — Per-question timer & auto-advance
F-06 — Final submit & retry
F-07 — Score result screen

Feature specs live in docs/features.md (NanoQuiz repo at /home/munna/speedo/localhost/nano-quiz). Important context from just-completed work: F-04 shipped (commits e99e3be..e78028a) — seeded shuffle module, GET /api/quizzes/:id/question/:seq?seed=, POST /api/quizzes/:id/submit with server-side scoring + idempotent repeat submit, QuizPlay full flow with answer-to-advance, submit auto-retry (3x/1s backoff) + manual retry, and a minimal inline completion screen ("You scored X of Y"). Note the overlap risk: parts of F-06 (submit + retry) and F-07 (minimal score display) already landed inside F-04 — the deliverables must scope what REMAINS (e.g. useQuizTimer hook doesn't exist yet; F-05 timer/auto-advance is fully greenfield; F-06/F-07 may be mostly verification + enrichment like total duration display and leaderboard link). Produce end-to-end deliverables documents per the features.md acceptance criteria.

## Locked Decisions
- Result screen: dedicated route `/quizzes/:id/completion`; inline score in QuizPlay removed (batch 01, Q1=A).
- Leaderboard link: ship a minimal leaderboard page at `/quizzes/:id/leaderboard` now (fetch + list) so F-07's link is not dead; no gold-plating (batch 01, Q2=A).
- Timeout answers: record sentinel `-1` in the answers array; backend must accept and score it as incorrect (batch 01, Q3=A).
- On submit-retry pending: countdown stops and a loader is shown (batch 01, Q4).
- (assumed — override if wrong) Completion state handoff uses client-side state (no new "get my result" endpoint); reload without state degrades gracefully.
- (assumed — override if wrong) elapsedMs stays total-quiz `Date.now() - startedAt`; per-question timer does not feed it.

## Codebase Facts (from analyst)
- F-05/F-06/F-07 specs verified verbatim in docs/features.md:131-180 (this round).
- No useQuizTimer / TimerCountdown exists; hooks/ has only useAuth, useRelativeTime, useTheme. F-05 fully greenfield.
- QuizPlay.tsx: answer-to-advance only; timeLimitSeconds unused; elapsedMs = Date.now() - startedAt ref (satisfied); submit payload `{ seed, answers: number[], elapsedMs }`.
- Submit retry: auto-retry 3x / fixed 1s on network failure (status 0) + manual retry button after exhaustion. Idempotent resubmit returns stored result (backend quizzes.ts ~206-300).
- Backend submit 200 response: `{ score, totalQuestions, correctCount, durationMs, participated }`. No rank. correct_opt never sent.
- Completion UI today: inline "You scored X of Y" in QuizPlay (no duration, no leaderboard link).
- Routes (App.tsx): /login, /, /quizzes/:id/play, catch-all. No Completion or Leaderboard page/route; backend GET /api/quizzes/:id/leaderboard exists.
- SubmitResult type in frontend/src/api/types.ts matches backend response.
- No docs/deliverables.md or docs/deliverables/DEL-*.md exemplars exist — templates used as canonical shape.

## Question History
- batch 01 — result-screen shape, leaderboard-link scope, timeout answer recording, timer-on-retry — answered 2026-08-18

## Deliverables (phase=done)
- DEL-01 — Per-question countdown timer with auto-advance (F-05) — depends on: —
- DEL-02 — Final submit & retry hardening: sentinel handling + retry loader (F-06 remainder) — depends on: DEL-01
- DEL-03 — Score result screen with duration, leaderboard link, and minimal leaderboard page (F-07) — depends on: DEL-01, DEL-02
- Index: deliverables.md; details: deliverables/DEL-0{1,2,3}-*.md
