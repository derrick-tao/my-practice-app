# 11: Parent progress page

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** In the parent area, a **Progress** page for the active learner, one view per list:
- **Header:** title, test dates, item count, number of attempts, best first-try score.
- **Attempts**, newest first: start date, status (✅ completed / ⏳ in progress / ⏹️ stopped), first-try score, rounds to complete.
- **Attempt detail:** per round, the item count, ✅ count, ❌ count, and the missed characters, shown large and tappable to hear their audio. Removed items are labeled "(removed)".
- **Trickiest characters:** the top 10 by total ❌ marks across all attempts, with counts, tappable to hear.
- **First-try trend** across completed attempts, as plain numbers (e.g. 28 → 33 → 37).

Stopped attempts are listed but excluded from trend and best. There are no charts, and no lesson grouping in v1.

**Blocked by:** 09, 10

**Status:** ready-for-agent

- [ ] Seam 1: after a scripted sequence (one completed attempt over 3 rounds, one stopped attempt, a second completed attempt), the attempts list, statuses, first-try scores, and rounds-to-complete all match
- [ ] Attempt detail shows the correct per-round ✅/❌ counts and missed characters; tapping a character requests its audio
- [ ] Trickiest characters ranks by total ❌ across attempts with correct counts
- [ ] The trend and best score exclude the stopped attempt
- [ ] An in-progress attempt shows as ⏳ with its rounds so far
- [ ] Removed items show as "(removed)" in attempt detail
