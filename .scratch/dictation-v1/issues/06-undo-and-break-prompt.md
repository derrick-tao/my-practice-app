# 06: Undo the last mark, and break prompts

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** After any ✅/❌ mark, a small **↩️ Undo** chip appears on the next screen, either the next item's listening screen or the round summary that mark produced. Tapping it returns to the previous item in the revealed phase with its mark removed. Undo is one level only: it's cleared by the next mark or by starting a new round, and isn't offered after completion. It survives a reload until it's cleared.

Every 10 marks (the default; configurable in 08), a "Great job! Take a break?" prompt appears with **▶️ Keep going** (primary) and **🏠 Break**. Break saves and returns home. The prompt never appears at the end of a round, and doesn't affect scoring.

**Blocked by:** 05

**Status:** resolved

- [ ] Seam 1: mark ✅, tap Undo → the same item is revealed again with no mark; marking ❌ then records ❌ and the counts reflect it
- [ ] Undo from a round summary created by the last mark returns to that last item; the summary is recomputed after re-marking
- [ ] Undo is gone after the next mark, after starting a retry round, and on the completion screen
- [ ] Undo is still available after reloading on the screen right after a mark
- [ ] With a 12-item list, the break prompt appears after the 10th mark and not at the round end; Keep going continues; Break returns home and Keep going resumes at the right item
- [ ] Break prompts don't change round results or the first-try score

## Comments

- 2026-10-18 (coordinator): Resolved on `dictation-v1` (merge 9dac89b, review fixes 4033da1). Review fix: Undo is now also offered on the break prompt (d3a556a).
