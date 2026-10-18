# 01: A published list shows up on the live site

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** The tracer bullet through the whole system. A parent commits a YAML word list to `main`, the deploy workflow validates it, builds the content (manifest + per-list data), builds the app, runs both test seams, and deploys to GitHub Pages. Opening the live site on an iPhone shows the child home screen with a big card for that list (title, test dates, character count). An invalid list fails CI with a message naming the file, item, and rule, and nothing deploys.

Sets up the stack (Vite + TypeScript strict + Preact), hash routing under the repo's base path, and the subject → practice type → list route shape. Introduces the TTS provider seam with only a **fake provider** that writes silent placeholder audio, so items carry audio references from day one. Ticket 02 replaces it with real providers and enforces the missing-credentials rule. Includes the real "Fall 2026 Assessment" list (37 items, from the spec's Further Notes) as the first published content, plus small fixture lists for tests.

**Blocked by:** None (can start immediately)

**Status:** resolved

- [ ] Pushing to `main` deploys to https://derrick-tao.github.io/my-practice-app/ via GitHub Actions; pull requests run validate, typecheck, tests, and build without deploying or using secrets
- [ ] The live home screen shows a card for "Fall 2026 Assessment" with "Test: 2026-10-26 to 2026-10-30" and 37 characters, on iPhone and iPad in portrait and landscape
- [ ] Validation enforces every rule in the spec (required fields, unknown keys, id = file name and unique, unique non-empty CJK targets, clue contains target, pinyin format and syllable count). Each rule has a failing fixture whose error names file, item, and rule. A script mismatch is only a warning
- [ ] Omitted pinyin is auto-filled at build time; provided pinyin is kept
- [ ] The build emits a manifest (content version, subjects → practice types → list summaries) and per-list data with items and normal/slow audio references; the content version changes if and only if list data changes
- [ ] Seam 1 harness: Playwright (WebKit, iPhone + iPad profiles) runs against the built app with fixture content and stubbed audio playback, and asserts the list card renders
- [ ] Seam 2 harness: the content build runs end-to-end on fixture lists with the fake TTS provider, and its outputs or errors are asserted
- [ ] Concurrency allows one Pages deploy at a time

## Comments

- 2026-10-18 (coordinator): Implemented on integration branch `dictation-v1` (bec799e, c8fceec, 67e9412; review fixes d36815b..510ab52). Verified locally: every validation rule, pinyin auto-fill, manifest/per-list data, content version, both seams, Fall 2026 card on iPhone/iPad in both orientations. Left `claimed` until the first push to `main` confirms the live deploy, PR CI behaviour, and that an invalid list blocks deploy.
- 2026-10-18 (coordinator): Verified live after PR #1. PR CI passed with no secrets. Deploy run 39143096214 succeeded with one Pages deploy. Live home in WebKit (iPhone 15, iPad Pro 11 landscape) shows "Fall 2026 Assessment", "2026-10-26 to 2026-10-30" and 37 characters, with no cross-origin requests. Not exercised live: an invalid list blocking deploy (covered locally by the validate step's failure).
