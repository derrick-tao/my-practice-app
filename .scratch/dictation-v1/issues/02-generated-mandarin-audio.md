# 02: Generated Mandarin audio for every item

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** On every push to `main`, real Mainland Mandarin audio (Azure Neural TTS, `zh-CN-XiaoxiaoNeural`) is generated for each new or changed item, at normal and slow (about −30%) rates. It's committed back to the repo and deployed, so every item on the live site has playable audio. The spoken prompt follows the spec: the `say` override, else "target，clue的target", else the target alone. Standalone targets carry phoneme markup from their pinyin, so 什/么/只/分 are read as intended. The unofficial `edge-tts` provider is available behind a config flag as a fallback. Provider, voice, rates, and output format live in one TTS config.

The `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` repo secrets are set (confirmed 2026-10-18). There is **no local copy of the key**: real audio is generated only in the `main` deploy workflow. Local development and tests use the committed audio plus the fake provider. If env vars with the same names as the secrets are present, local generation may use them, but it must never require them and never write them to disk. Listening checks of the generated audio happen in ticket 17.

**Blocked by:** 01

**Status:** claimed

- [ ] Audio files are content-addressed (hash of provider + voice + rate + SSML). A second build with unchanged content makes zero provider requests; changing one clue makes exactly two (normal + slow) for that item (Seam 2, fake provider)
- [ ] Seam 2 asserts the spoken prompt for each case (say override, clue template, target only), phoneme markup for standalone targets, and the configured normal/slow rates
- [ ] Prune removes unreferenced audio and keeps referenced audio
- [ ] A build that needs audio without provider credentials fails with a clear message; the fake provider is used only in tests
- [ ] On `main`, new audio is committed back with a skip-ci commit before build and deploy; the Azure key is never printed and never given to pull-request builds
- [ ] The `main` workflow run succeeds against Azure with the phoneme markup for 什 (shén), 么 (me), 只 (zhī), 分 (fēn), confirmed from the workflow log, with no key printed. If Azure rejects the markup, those items in the Fall 2026 list get explicit `say` overrides instead, and the finding is noted in the spec. Whether the readings sound right is checked by ear in ticket 17
- [ ] Every one of the 37 Fall 2026 items has normal and slow audio reachable on the live site
- [ ] Switching the config flag to the edge provider generates audio without an Azure key

## Comments

- 2026-10-18 (coordinator): Implemented on `dictation-v1` (75854d8, plus review fixes 9b47ef2/a91eb76). Seam 2 covers content addressing, zero/two-request rebuilds, prompts, `sapi` phoneme markup (neutral tone = 5), rates, prune, missing-credentials failure, and an edge build with no key. Finding: edge-tts can't take phoneme markup, so with the edge provider, polyphones need `say` overrides. Left `claimed` until the first `main` run shows Azure returning 200 for 什/么/只/分 with no key in the log, the `[skip ci]` audio commit landing, and all 74 files live. Until then local `npm run check` needs `FAKE_AUDIO=1`.
