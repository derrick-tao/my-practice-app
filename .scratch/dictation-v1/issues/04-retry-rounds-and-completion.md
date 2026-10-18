# 04: Retry rounds until everything is ✅, then completion

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** When a round ends with misses, the round summary says "Let's practice N more!" and offers a big **Practice the ❌ words** button. That starts a new round containing exactly the items marked ❌ in the previous round, always reshuffled, with a round badge (e.g. 🔁 2) on the practice screen. This repeats until a round has zero ❌. The session then completes, and the child sees "You did it! 🎉", "X of Y on the first try!" (round 1 correct out of round 1 total), and "Rounds: N", with a Home button. Confetti and sounds come in 15; this ticket delivers the screen and the numbers.

**Blocked by:** 03

**Status:** resolved

- [ ] Seam 1: a 5-item fixture list with 2 misses → the summary shows ✅ 3 ❌ 2 → the retry round contains exactly those 2 items
- [ ] One miss in round 2 → round 3 with that 1 item → all ✅ → the completion screen shows "3 of 5 on the first try!" and "Rounds: 3"
- [ ] Retry rounds are reordered relative to the previous round (seeded random source)
- [ ] A round with zero misses goes straight to completion (no summary retry button)
- [ ] The round badge appears from round 2 onward

## Comments

- 2026-10-18 (coordinator): Resolved on integration branch `dictation-v1`; all acceptance criteria covered by Seam 1 tests (WebKit, iPhone + iPad, portrait + landscape).
