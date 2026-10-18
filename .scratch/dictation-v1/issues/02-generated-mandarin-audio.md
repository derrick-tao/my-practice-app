# 02: Generated Mandarin audio for every item

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** On every push to `main`, real Mainland Mandarin audio (Azure Neural TTS, `zh-CN-XiaoxiaoNeural`) is generated for each new or changed item, at normal and slow (about −30%) rates. It's committed back to the repo and deployed, so every item on the live site has playable audio. The spoken prompt follows the spec: the `say` override, else "target，clue的target", else the target alone. Standalone targets carry phoneme markup from their pinyin, so 什/么/只/分 are read as intended. The unofficial `edge-tts` provider is available behind a config flag as a fallback. Provider, voice, rates, and output format live in one TTS config.

The `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` repo secrets are set (confirmed 2026-10-18), and the `main` deploy workflow uses them. For local generation, the owner keeps an optional copy of the key in a git-ignored `.env` (not the macOS Keychain), created from the committed `.env.example`. Only `npm run audio:generate` reads it, and variables already in the environment win. Validate, build, the app, and the tests never read it, and nothing requires it: local development and tests still work from the committed audio plus the fake provider. Listening checks of the generated audio happen in ticket 17.

**Blocked by:** 01

**Status:** resolved

- [ ] Audio files are content-addressed (hash of provider + voice + rate + SSML). A second build with unchanged content makes zero provider requests; changing one clue makes exactly two (normal + slow) for that item (Seam 2, fake provider)
- [ ] Seam 2 asserts the spoken prompt for each case (say override, clue template, target only), phoneme markup for standalone targets, and the configured normal/slow rates
- [ ] Prune removes unreferenced audio and keeps referenced audio
- [ ] A build that needs audio without provider credentials fails with a clear message; the fake provider is used only in tests
- [ ] On `main`, new audio is committed back with a skip-ci commit before build and deploy; the Azure key is never printed and never given to pull-request builds
- [ ] The `main` workflow run succeeds against Azure with the phoneme markup for 什 (shén), 么 (me), 只 (zhī), 分 (fēn), confirmed from the workflow log, with no key printed. If Azure rejects the markup, those items in the Fall 2026 list get explicit `say` overrides instead, and the finding is noted in the spec. Whether the readings sound right is checked by ear in ticket 17
- [ ] Every one of the 37 Fall 2026 items has normal and slow audio reachable on the live site
- [ ] Switching the config flag to the edge provider generates audio without an Azure key
- [ ] Locally, `npm run audio:generate` reads the credentials from a git-ignored `.env` when present (environment wins, key never printed); `.env.example` is committed with placeholders only (Seam 2)

## Comments

- 2026-10-18 (coordinator): Implemented on `dictation-v1` (75854d8, plus review fixes 9b47ef2/a91eb76). Seam 2 covers content addressing, zero/two-request rebuilds, prompts, `sapi` phoneme markup (neutral tone = 5), rates, prune, missing-credentials failure, and an edge build with no key. Finding: edge-tts can't take phoneme markup, so with the edge provider, polyphones need `say` overrides. Left `claimed` until the first `main` run shows Azure returning 200 for 什/么/只/分 with no key in the log, the `[skip ci]` audio commit landing, and all 74 files live. Until then local `npm run check` needs `FAKE_AUDIO=1`.
- 2026-10-18 (owner decision): Local key handling changed from "no local key" / Keychain to an optional git-ignored `.env`. The `audio` CLI command loads `.env` (or `--env-file path`) via `process.loadEnvFile`, and environment variables take precedence. Added `.env.example`, a `!.env.example` gitignore exception, a Seam 2 CLI test, and README setup steps. CI is unchanged (repo secrets).
- 2026-10-18 (coordinator): Verified on deploy run 39143096214. Azure returned 74/74 `status=200` with `phoneme=yes` for 什/么/只/分 (normal and slow), and the key appears only masked. Audio was committed back as da2a427 `[skip ci]`, and all 74 files are served from /content/audio/. `npm run check` passes on main without FAKE_AUDIO. The edge provider is covered only by Seam 2 with a stubbed transport, not a real run. Listening checks are in ticket 17.
