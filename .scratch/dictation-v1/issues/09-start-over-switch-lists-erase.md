# 09: Start over, switching lists, and erase

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:**
- **Start over:** the Keep going card has a 🔄 button. After a "Start again from the beginning?" confirmation (✅ Yes / ❌ No icons), the current session is marked **stopped** and a new session starts for the same list, freshly ordered.
- **Switching lists:** tapping a different list card while a session is active asks "Stop your current practice?" and requires the parent gate. The old session is marked stopped and the new list starts.
- **Danger zone** (parent area): "Erase all progress" for the active learner (two confirmations) deletes that learner's sessions but keeps the profile. "Erase everything on this device" (two confirmations plus typing ERASE) removes all profiles and data and returns to first run.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Seam 1: Start over requires confirmation; ❌ No keeps the session; ✅ Yes starts a fresh session at item 1 of round 1
- [ ] The stopped session is retained in history with status stopped (shown on the progress page in 11)
- [ ] Tapping another list card while active requires the gate; cancelling keeps the current session
- [ ] Erasing one learner's progress leaves other learners' data untouched and keeps the profile
- [ ] Erase everything returns the app to first run with no profiles or sessions
- [ ] No destructive action is reachable with a single tap
