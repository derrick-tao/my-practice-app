# 05: Never lose progress

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** Every practice step is saved on the device before the screen changes, so closing the browser, force-quitting, or losing power never loses progress. On reopening, the home screen shows a **▶️ Keep going** card (list title, star progress, round badge). Tapping it resumes at the exact round, position, and phase (listening or revealed), with the "heard" state preserved. Audio does not auto-play on resume (iOS gesture rules), so the child taps Listen. If a save fails, the child sees "Couldn't save — tap to retry" and the screen doesn't advance. There is one active session per profile; until profiles exist (07), the app uses an implicit default profile.

All storage goes through a single StorageAdapter interface (IndexedDB implementation), as described in the spec's data model. Saved data carries a schema version, ordered migrations run on load, and the app requests persistent storage on first run.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Seam 1: reloading during listening, during revealed, and on a round summary each shows Keep going, which restores the exact state (same item, round, phase; Check still visible if audio was already heard)
- [ ] Reload mid-retry-round resumes in that retry round with the correct remaining items
- [ ] A completed session no longer shows Keep going
- [ ] Forcing a storage write failure shows "Couldn't save — tap to retry" and doesn't advance; retry succeeds and advances
- [ ] A saved-data fixture at the current schema version loads; the migration runner is in place for future versions
- [ ] Persistent storage is requested on first run, and the result is retained for display later (13)
- [ ] The UI and practice flow access storage only through the StorageAdapter
