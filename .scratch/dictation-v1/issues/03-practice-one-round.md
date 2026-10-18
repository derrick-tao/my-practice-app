# 03: Practice one round of dictation

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** The child taps a list card and practices every item once. On each new item, the normal audio auto-plays. Big **Listen** and **Slow** buttons replay as often as wanted. **Check** appears only once audio for the current item has been requested. Check reveals the target (very large), its pinyin, and the clue word in small text, with Listen/Slow still available. The child taps ✅ "I got it" or ❌ "Not yet". The mark is recorded and the next item's audio auto-plays from inside the tap handler; if playback is rejected, the Listen button pulses. A star progress bar (filled fraction plus small "n / total") and a Home button sit at the top. After the last item, a round summary shows the ✅ and ❌ counts.

Round 1 is shuffled by default (the setting to turn this off comes in 08). Shuffling uses an injectable random source, seeded in test builds. Nothing persists yet; reloading restarts (05 adds durability). Kid UI rules apply: icon-first with 1–2 word labels, touch targets of at least 64 pt and primary actions about 96 pt, and ✅/❌ distinguished by shape as well as color.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Seam 1: tapping a card opens practice, and the first item's normal audio is requested automatically
- [ ] Check is hidden until audio for the current item has been requested (via auto-play, Listen, or Slow), then appears
- [ ] Slow requests the slow rendition; Listen and Slow can be tapped any number of times in both phases
- [ ] The reveal shows target, pinyin, and clue from the list data
- [ ] Marking advances to the next item and requests its normal audio; the star bar and "n / total" update
- [ ] After the last item, the round summary shows the correct ✅ and ❌ counts for a scripted sequence of marks
- [ ] With the seeded random source, round 1 order is shuffled and deterministic in tests
- [ ] Home returns to the home screen
- [ ] Layout works on iPhone and iPad in portrait and landscape
