# 07: Parent gate, first-run setup, and assigned lists

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** On first launch, the app shows "Hi! Ask a grown-up to set up 👋". The grown-up passes the **parent gate** (a random `a × b` with a and b from 6–9, entered on an on-screen number pad; a wrong answer gives a new question, with no lockout). They create a learner profile (name and emoji avatar) and assign one or more lists. The child home screen then greets them ("Hi 🐼 {name}!") and shows **only the assigned lists**. A small ⚙️ in the corner opens the gate to the parent area, which shows section entries (later tickets fill them in) and an "Assign lists" section with a toggle per published list. The gate stays unlocked until the parent leaves the parent area or after 5 minutes idle. The implicit default profile from 05 becomes the first real profile; names and avatars are stored only on the device.

**Blocked by:** 05

**Status:** resolved

- [ ] Seam 1: first run → gate → create profile → assign one of two fixture lists → home shows the greeting with avatar and only the assigned list
- [ ] A wrong gate answer shows a new question; a right answer opens the parent area
- [ ] Leaving the parent area re-locks the gate; 5 minutes idle re-locks the gate
- [ ] Unassigning a list hides its card on home; an active session on an unassigned list still shows Keep going
- [ ] An existing in-progress session from before profiles existed is kept on the first profile
- [ ] No profile name appears in any network request

## Comments

- 2026-10-18 (coordinator): Resolved on `dictation-v1` (merge eead40f, review fixes 4033da1).
