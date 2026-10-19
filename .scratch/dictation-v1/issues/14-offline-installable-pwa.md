# 14: Works offline, installable to the home screen

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** The app is an installable PWA (standalone display, any orientation, icons, theme color). After one online visit, everything works in airplane mode. A service worker precaches the app shell, the content manifest, all list data, and all referenced audio. When a new version is deployed, the new service worker waits, and the child home screen shows "New words are ready! 🔄"; tapping it reloads. The app never reloads on its own during practice. The parent area shows a one-time "Add to Home Screen" install tip for Chrome on iOS.

**Blocked by:** 03

**Status:** resolved

- [ ] Seam 1: load once online, go offline, open a list and complete a round with audio requests served from cache
- [ ] A newly deployed version (simulated) shows the "New words are ready" banner only on home, never during practice; tapping it loads the new content
- [ ] The web app manifest and service worker meet installability requirements (Lighthouse installable passes)
- [ ] The install tip shows once in the parent area and can be dismissed
- [ ] Audio and list data are cached cache-first (immutable hashed names); the manifest is network-first

## Comments

- 2026-10-18 (coordinator): Resolved on `dictation-v1` (merge 4c1ddcc, review fixes 4033da1). Review fixes: font subset precached (6c8c4b5); list data now content-hashed lists/<id>.<hash>.json named in the manifest, so cache-first is safe (992620b).
