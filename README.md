# My Practice App

A kid-friendly practice web app hosted on GitHub Pages. The first practice type is Chinese character dictation (听写): hear a character in Mandarin, write it on paper, check, and self-mark until every character is right.

- Spec: `.scratch/dictation-v1/spec.md`
- Tickets: `.scratch/dictation-v1/issues/`
- Agent tracker config: `docs/agents/`

Learner data stays on the device. Never commit names or backup files.

## Publish a word list

Add `content/<subject>/<list-id>.yaml` (the file name must equal `id`), commit to `main`, and the deploy workflow validates, builds, and publishes it. See `content/chinese/fall-2026-assessment.yaml` for the format. A mistake fails the build with a message naming the file, item, and rule, and nothing is deployed.

## Audio

Every item gets Mandarin audio at normal and slow speed (Azure `zh-CN-XiaoxiaoNeural`; provider, voice, rates and format live in `tts.config.ts`). Audio is generated only by the `main` deploy workflow, committed back to `audio/` with a `[skip ci]` commit, and deployed in the same run. There is no local key. Files are named by a hash of provider, voice, rate, format and SSML, so only new or changed items are ever sent to Azure.

- Local work and pull requests: a build that needs audio missing from `audio/` fails with a clear message. Opt in to silent placeholder audio with `FAKE_AUDIO=1` (or `--fake-audio`), for example `FAKE_AUDIO=1 npm run check`. Placeholders go to `.generated/` and are never committed.
- `npm run audio:generate [-- --prune]` generates missing audio into `audio/` and needs `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` in the environment. Normally only the workflow runs it.
- To fall back to the unofficial edge-tts service (no key, but no phoneme markup, so give 什/么/只/分 `say` overrides), set `provider: 'edge'` in `tts.config.ts`.

## Develop

Node 24 (`.nvmrc`). One-time: `npm ci && npx playwright install webkit`.

- `npm run dev` - local dev server at http://localhost:5173/my-practice-app/ (prefix with `FAKE_AUDIO=1` until the item audio is committed)
- `npm run check` - validate, typecheck, content tests, build, and browser tests (what CI runs; pull-request CI sets `FAKE_AUDIO=1`)
- Individual steps: `validate`, `typecheck`, `test:content`, `build`, `test:e2e`
