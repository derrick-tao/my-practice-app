# My Practice App

A kid-friendly practice web app hosted on GitHub Pages. The first practice type is Chinese character dictation (听写): hear a character in Mandarin, write it on paper, check, and self-mark until every character is right.

- Spec: `.scratch/dictation-v1/spec.md`
- Tickets: `.scratch/dictation-v1/issues/`
- Agent tracker config: `docs/agents/`

Learner data stays on the device. Never commit names or backup files.

## Privacy: keep the child's name out of the repo

Names, avatars and progress live only on the device and in backup files you export (`*backup*.json` is git-ignored). The app makes no request outside its own origin (a browser test checks this). To also stop a name slipping into a commit, set up a local denylist:

1. Create `.privacy-denylist` in the repo root, one term per line (for example the child's name, in any spelling you use). Matching is case-insensitive; blank lines and lines starting with `#` are ignored. The file is git-ignored, so it is never committed or pushed.
2. `npm run privacy:install-hook` installs an opt-in git `pre-commit` hook (nothing installs it for you). A commit whose staged files, or file names, contain a term is blocked with a message naming each file and line; the message never repeats the term. It won't overwrite a pre-commit hook you already have.
3. `npm run privacy:check` runs the same scan on what is staged; `npm run privacy:check -- --all` scans every tracked file.

With no `.privacy-denylist` (as in CI and on a fresh clone) the check passes silently and commits are unaffected.

## Publish a lesson

Add `content/<subject>/<lesson-id>.yaml` (the file name must equal `id`), commit to `main`, and the deploy workflow validates, builds, and publishes it. A lesson holds one list per practice type (so far just `dictation:`); see `content/chinese/fall-2026-assessment.yaml` for the format. A mistake fails the build with a message naming the file, item, and rule, and nothing is deployed.

## Audio

Every item gets Mandarin audio at normal and slow speed (Azure `zh-CN-XiaoxiaoNeural`; provider, voice, rates and format live in `tts.config.ts`). The `main` deploy workflow generates any missing audio with the repo secrets, commits it back to `audio/` with a `[skip ci]` commit, and deploys it in the same run. You can also generate it locally with your own copy of the key in `.env` (below). Files are named by a hash of provider, voice, rate, format and SSML, so only new or changed items are ever sent to Azure.

- Local work and pull requests: a build that needs audio missing from `audio/` fails with a clear message. Opt in to silent placeholder audio with `FAKE_AUDIO=1` (or `--fake-audio`), for example `FAKE_AUDIO=1 npm run check`. Placeholders go to `.generated/` and are never committed.
- `npm run audio:generate [-- --prune]` generates missing audio into `audio/`. It needs `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`. In CI they come from the repo secrets; locally they come from `.env`:
  1. `cp .env.example .env` (`.env` is git-ignored)
  2. Paste KEY 1 from the Azure portal (your Speech resource → Keys and Endpoint) after `AZURE_SPEECH_KEY=`, and check that `AZURE_SPEECH_REGION` matches the resource's Location/Region (e.g. `eastus`)
  3. `npm run audio:generate`, then `npm run dev` or `npm run check` work without `FAKE_AUDIO=1`. Commit the new `audio/` files, or leave them and let the workflow generate the same files on `main`

  Variables already set in your shell override `.env`. Only this command reads `.env`; the app, build and tests never do, so the key can't end up in the deployed site. Never commit `.env` and never prefix the names with `VITE_`.
- To fall back to the unofficial edge-tts service (no key, but no phoneme markup, so give 什/么/只/分 `say` overrides), set `provider: 'edge'` in `tts.config.ts`.

## Develop

Node 24 (`.nvmrc`). One-time: `npm ci && npx playwright install webkit`.

- `npm run dev` - local dev server at http://localhost:5173/my-practice-app/ (prefix with `FAKE_AUDIO=1` until the item audio exists in `audio/`)
- `npm run check` - validate, typecheck, content tests, build, and browser tests (what CI runs; pull-request CI sets `FAKE_AUDIO=1`)
- Individual steps: `validate`, `typecheck`, `test:content`, `build`, `test:e2e`
