# 15: Kid polish

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** Makes practice feel right for a 1st grader:
- **Font:** revealed characters use a Kai-style handwriting font subset (an open-source font such as LXGW WenKai, OFL-licensed), generated at build time from only the characters in the content, at about 40% of the short side of the screen. It falls back to the system font.
- **Sounds:** a soft chime on ✅, a gentle tone on ❌ (never a harsh buzzer), and a fanfare on completion. They play only when the sounds setting is on.
- **Confetti** on the completion screen, replaced by a simple fade under `prefers-reduced-motion`.
- **Volume hint:** "No sound? Turn up the volume 🔈" after repeated audio failures.
- **Accessibility pass:** touch-target sizes, ✅/❌ shape plus color, icon-led labels, and both orientations on iPhone and iPad.

**Blocked by:** 04, 08

**Status:** resolved

- [ ] Seam 2: the font subset covers every character present in the content
- [ ] Seam 1: the revealed character renders with the subset font
- [ ] Sound effects are requested on ✅, ❌, and completion when sounds are on, and not requested when off
- [ ] Confetti runs on completion; with reduced motion emulated, a fade is used instead
- [ ] Two consecutive audio failures show the volume hint
- [ ] All kid-screen controls meet the minimum touch-target size on iPhone and iPad in both orientations

## Comments

- 2026-10-18 (coordinator): Resolved on `dictation-v1` (merge 689214a, review fixes 4033da1). Open owner decision: clue characters are included in the font subset though the clue isn't set in Kai.
