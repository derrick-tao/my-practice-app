# My Practice App

A kid-friendly practice web app hosted on GitHub Pages. The first practice type is Chinese character dictation (听写): hear a character in Mandarin, write it on paper, check, and self-mark until every character is right.

- Spec: `.scratch/dictation-v1/spec.md`
- Tickets: `.scratch/dictation-v1/issues/`
- Agent tracker config: `docs/agents/`

Learner data stays on the device. Never commit names or backup files.

## Publish a word list

Add `content/<subject>/<list-id>.yaml` (the file name must equal `id`), commit to `main`, and the deploy workflow validates, builds, and publishes it. See `content/chinese/fall-2026-assessment.yaml` for the format. A mistake fails the build with a message naming the file, item, and rule, and nothing is deployed.

## Develop

Node 24 (`.nvmrc`). One-time: `npm ci && npx playwright install webkit`.

- `npm run dev` - local dev server at http://localhost:5173/my-practice-app/
- `npm run check` - validate, typecheck, content tests, build, and browser tests (what CI runs)
- Individual steps: `validate`, `typecheck`, `test:content`, `build`, `test:e2e`
