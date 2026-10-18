# 10: A list edited during practice

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** When the parent publishes a change to a list that has an active session, opening that session follows the spec's rules:
- Clue, pinyin, or audio changes apply immediately (sessions reference items by id).
- **Removed** items drop out of the current round's remaining items and out of future rounds. If the current item was removed, practice moves to the next one. If the round is then finished, the round summary shows.
- Marks for removed items in finished rounds stay in history, labeled "(removed)".
- **Added** items don't join the active session; they appear in the next session.
- If every item was removed, the session becomes stopped and the child sees a friendly "This list changed — pick a list" message.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] Seam 1 (fixture content swapped between page loads): an edited clue/pinyin shows the new value on the current item's reveal
- [ ] Removing the current item → resume lands on the next remaining item
- [ ] Removing a future item → it never appears in this session
- [ ] Removing the last remaining items of a round → the round summary shows with correct counts
- [ ] Adding an item → absent from the active session; present when a new session starts
- [ ] Removing all items → session stopped and the friendly message shown
- [ ] Marks for removed items in finished rounds are retained and flagged as removed in session history
