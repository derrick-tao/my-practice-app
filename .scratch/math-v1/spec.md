## Problem Statement

A first-grade learner is assessed at school on Grade 1 operations and algebraic thinking (standards 1.OA.1 and 1.OA.3 to 1.OA.8): word problems, properties of operations, subtraction as an unknown addend, counting on, fluency within 10 and adding and subtracting within 20, the meaning of the equal sign, and finding the unknown number in an equation. The school sends the standards as text, not a list of items.

The app only does Chinese today. Every part of a lesson assumes Chinese: items are Han characters, the learner self-grades, and the build adds pinyin, audio and a handwriting font. None of that fits math. A hand-written list of equations would be memorized instead of solved, and a learner can't self-grade `13 − 4` the way they can self-grade a character they just wrote on paper. The family has no way to practice math in the app, and the parent has no record of which kinds of problem the child keeps missing before the test.

## Solution

Math becomes a second subject. The parent publishes a **math lesson** (subject `math`) as a lesson file, the same way as a Chinese lesson. It holds no items. For each of five **practice types** it holds small **rules** (the numbers to stay within and the operations), and the app makes the items itself.

The child sees one Math card on Home with five big buttons: ⚡ Facts, 🔍 Missing, ⚖️ True?, 📖 Stories and 🧠 Tricks. Each session is 20 **problems** made fresh for that session, spread evenly across the practice type's **problem kinds** and shuffled, with no repeats. The child answers on a big number pad (or two big true/false buttons) and the app checks the answer. There are two tries. A wrong first try gets a gentle "Try again!" with no answer shown. A second wrong try shows the correct answer and a one-line worked strategy, then moves on. Only a right first try is ✅. A right second try still gets a cheerful "got it!" but is marked ❌. Retry rounds cover the ❌ items with new problems of the same kind, so the child can't win by remembering the answer they were just shown. There is no timer and no speed score.

The parent's Progress page works as it does for Chinese, but "trickiest" becomes problem kinds ("subtract across ten: ❌ 4 of 6"), and missed items show the problem and what the child entered. The lesson preview shows each type's rules, its problem kinds, and five sample problems with a 🔀 button for new samples.

## User Stories

1. As a parent, I want to publish a math lesson as a file in the repo, so that I can add the school's next math assessment without a code change.
2. As a parent, I want a math lesson to list only rules for each practice type, so that I don't have to write out hundreds of equations.
3. As a parent, I want a rule to default to Grade 1 (within 20, adding and subtracting), so that a lesson file stays short.
4. As a parent, I want to change `within` in the lesson file for a later test (for example within 100), so that the same app serves the next grade level with a file change only.
5. As a parent, I want the lesson file checked when it is published, so that a mistake such as a math practice type in a Chinese lesson, or a rule that can't produce problems, is caught before the child sees it.
6. As a parent, I want math to be its own lesson, so that it stays a separate test from the Chinese lesson even in the same week.
7. As a parent, I want the lesson to carry the test dates, so that I can see how long we have before the assessment.
8. As a child, I want a Math card on Home with five big buttons, so that I can pick what to practice without reading much.
9. As a child, I want each button to have its own picture (⚡ 🔍 ⚖️ 📖 🧠), so that I know which is which before I can read the word.
10. As a child, I want to see which subject a lesson is for, so that I don't open Chinese when I mean to do math.
11. As a child, I want my math practice to be saved and continue where I left off, so that closing the app doesn't lose my place.
12. As a child, I want a Keep going card for a math session in progress, so that I can get straight back to it.
13. As a child, I want 20 problems per session, so that a session is short enough to finish.
14. As a child, I want each session to have new problems, so that practice is a real test and not remembering last time's answers.
15. As a child, I want a mix of problem kinds in every session, so that I practice everything the school will test.
16. As a child, I want a big number pad with ⌫ and Check, so that I can type an answer without a keyboard covering the screen.
17. As a child, I want two big True and False buttons for true-or-false problems, so that I can answer with one tap.
18. As a child, I want to fill in one blank at a time in a strategy problem, so that I follow the steps one by one.
19. As a child, I want a second try after a wrong answer, so that one slip doesn't count the same as not knowing.
20. As a child, I want a wrong first try to wobble softly and say "Try again!" without a ❌ sound, so that it doesn't feel like failing.
21. As a child, I want to see the right answer and how to get it after my second wrong try, so that I learn the trick.
22. As a child, I want a cheerful "got it!" when I get it on the second try, so that I'm still encouraged.
23. As a child, I want ❌ problems to come back as new problems in the next round, so that I practice the kind I find hard without seeing a problem I already saw the answer to.
24. As a child, I want a celebration when I finish all rounds with a first-try score and the number of rounds, as in Chinese, so that finishing feels good.
25. As a child, I want story problems with a name, an object and emoji pictures for small numbers, so that I can picture what is happening.
26. As a child, I want story problems for adding to, taking from, putting together, taking apart and comparing, so that I meet every situation in the test.
27. As a child, I want the unknown to be in different places in story problems (result, change, start, total, one part, difference, bigger, smaller), so that I learn to read the story and not just to add.
28. As a child, I want equations with the blank in any position (`8 + ? = 11`, `5 = ☐ − 3`), so that I understand the equal sign.
29. As a child, I want true-or-false problems such as `7 = 8 − 1` and `4 + 1 = 5 + 2`, so that I learn that the equal sign means "the same as".
30. As a child, I want guided strategy steps such as `8 + 6 = 10 + ☐`, so that I learn to make ten.
31. As a child, I want fact problems both within 10 and across ten, so that I become fluent in the small facts and can bridge ten.
32. As a child, I want no timer and no speed score, so that I'm not rushed.
33. As a child, I want sound effects only if the profile's Sounds setting is on, so that practice stays quiet when I'm somewhere quiet.
34. As a child, I want a break prompt as in Chinese practice, so that I can rest during a long session.
35. As a parent, I want the break prompt to count finished problems and not each try, so that breaks come at a steady pace.
36. As a parent, I want the app to say that Shuffle doesn't apply to math, so that I'm not confused when problems are always mixed.
37. As a parent, I want a math attempt's first-try score, rounds and best score on the Progress page, so that I can see whether my child is improving before the test.
38. As a parent, I want trickiest to show problem kinds with a count ("subtract across ten: ❌ 4 of 6"), so that I know what to help with.
39. As a parent, I want each round's missed problems to show the problem and what my child entered, so that I can see the kind of mistake.
40. As a parent, I want the lesson preview to show each practice type's rules and problem kinds, so that I know what the child will be asked.
41. As a parent, I want five sample problems per type and a 🔀 button for new samples, so that I can check the problems look right.
42. As a parent, I want math practice to work offline and with no deploy for new problems, so that practice never depends on a connection.
43. As a parent, I want my existing Chinese sessions, profiles and backups to keep working, so that adding math loses nothing.
44. As a parent, I want to export and import a backup that includes math sessions, so that I can move to a new device.
45. As a parent, I want a math session in progress to keep its problems if I edit the lesson, so that my child's session isn't disrupted, with new rules applying from the next session.
46. As a parent, I want a session to end the way a Chinese one does if I remove its practice type from the lesson, so that behavior is predictable.
47. As a parent, I want the app confirmed to work on the family's iPad and iPhone, so that I know the number pad and layout are usable by a 6-year-old.

## Implementation Decisions

Vocabulary is the project glossary's: **Subject**, **Lesson**, **Practice type**, **Item**, **Round**, **Mark**, **Session**, plus the new terms **Rules**, **Problem kind**, **Problem** and **Try** (drafted in the handoff doc, applied to `CONTEXT.md` as part of the first ticket). The glossary's Item, Mark, Session, Break and Undo entries get the math wording.

*Shape*
- Math is its own lesson with subject `math`, not more practice types inside the Chinese lesson. A lesson has exactly one subject (folder, address, manifest grouping, saved sessions), so moving the subject off the lesson was rejected.
- Five practice types, ids `facts`, `missing-number`, `true-or-false`, `word-problems`, `strategies`, covering 1.OA.6, 1.OA.8 and 1.OA.4, 1.OA.7, 1.OA.1, and 1.OA.3, 1.OA.5 and the strategy part of 1.OA.6.
- There is one practice-type registry and each type is tagged with a subject. Validation rejects a math type in a Chinese lesson (and the reverse). Addresses look like `#/math/facts/<lessonId>`. Registry order puts math types after the existing three.
- First lesson: `fall-2026-math-assessment`, title "Fall 2026 Math Assessment", test dates 2026-10-26 to 2026-10-30 (assumed to match the Chinese lesson; confirm before publishing), all five types with `within: 20`.

*Lesson file and build*
- A math lesson holds, per practice type, only rules: `within` and `operations`. `operations` defaults to adding and subtracting, `within` defaults to 20. Example shape: `facts: { within: 20 }`.
- The content build validates the rules and the subject/type pairing. `script`, pinyin, audio and the Kai font are Chinese-only; the build skips them for math. Lesson ids stay unique across subjects.

*Generation*
- Problems are made in the app when a session or a retry round starts, using the existing injected random source (seeded in e2e builds). Math works offline and fresh problems need no deploy.
- A session has 20 items, spread evenly across the practice type's problem kinds, shuffled, with no repeats in a session. For Facts, half are within 10 and half across ten.
- Problem kinds:
  - Facts: add within 10, subtract within 10, add across ten (`8 + 6`), subtract across ten (`13 − 4`).
  - Missing number: blank first, middle or answer, for + and −, including written-backwards forms (`5 = ☐ − 3`). Includes `8 + ? = 10` for `10 − 8` (subtraction as unknown addend).
  - True or false: same number (`6 = 6`), answer on the left (`7 = 8 − 1`), swapped order (`5 + 2 = 2 + 5`), two sums (`4 + 1 = 5 + 2`). About half true; false ones are off by 1 or 2.
  - Word problems: add to and take from (unknown result, change, start); put together and take apart (unknown total, one part); compare (unknown difference, bigger, smaller). "Both parts unknown" is left out because it has many right answers. Sentence templates per situation and unknown position, with names, objects and numbers filled in at random; emoji pictures for numbers up to 10.
  - Strategies: swap the order, make ten with three numbers (`2 + 6 + 4`), count on, make ten (`8 + 6 = 8 + 2 + 4`), break down to ten (`13 − 4 = 13 − 3 − 1`), related fact (`8 + 4 = 12, so 12 − 8`), near doubles (`6 + 7 = 6 + 6 + 1`). Guided steps, one blank at a time.

*What an item is*
- A math item is one of the session's 20 numbered spots ("problem 7"), not its problem kind. It has one problem kind for the whole session and a new problem each round. Rounds key marks by item id, so kind can't be the identity (20 items share as few as 4 kinds). Progress still totals by problem kind.

*Practice behavior*
- Graded by the app. The self-grade ✅/❌ buttons don't apply to math.
- Two tries per problem. The mark is ✅ only if the first try is right. After a second wrong try the app shows the answer plus a one-line worked strategy (for example `8 + 6 = 8 + 2 + 4 = 14`) and moves on. A wrong first try wobbles softly with "Try again!" and no ❌ sound; the ❌ sound plays only after the second wrong try. With the Sounds setting off there is no sound at all.
- Retry rounds cover the ❌ items with new problems of the same kind.
- Answer input: a big 0 to 9 number pad with ⌫ and Check for numeric answers, two big buttons for true or false, and one blank at a time for strategies.
- No Undo in math: with app grading it would only take back wrong answers.
- Shuffle doesn't apply to math (always mixed) and the parent area says so beside the setting. Break and Sounds work as today. The break count counts a finished problem (right first try, right second try, or answer shown), not each try.
- No timer or speed score. No audio yet (maybe later, for word problems).

*Saved data*
- Rounds save problems as data, not text: the kind, the numbers, which spot is blank, and for word problems the name and object picked, plus each try's answer. The screen renders from that, so resume is exact.
- Saved-data schema moves to the next version after the current v4 (v5), additive only, with a migration and a saved-data fixture. Chinese sessions and v4 (and older) backups import unchanged.
- The Session/Round shape needs to carry tries. The existing Mark type (correct/wrong) is not enough on its own.

*Screens and parent area*
- Home has no subject picker. Each lesson card gets a small subject tag (Chinese / Math). Keep going cards are unchanged.
- The number-pad, true/false and strategy screens are new practice flows alongside the existing Chinese flows.
- Parent Progress uses the same layout. Trickiest is problem kinds; missed items show the problem and the child's entered answer. The lesson preview shows each type's rules, its problem kinds and 5 sample problems with a 🔀 button for new samples.
- A lesson changed mid-practice: an in-progress math session keeps its problems and changed rules apply from the next session. A removed practice type ends its session as a Chinese one does today.

*Decisions record*
- An ADR (next free number, 0003) records: items are generated, with a new problem each session and round; math is its own lesson by subject; rejected options were hand-written lists, retrying the same problem, and math as extra practice types inside the Chinese lesson.

## Testing Decisions

- A good test drives the system only through what the child or parent taps and sees, or what the content build accepts and produces, and asserts observable outcomes. It doesn't reach into internal modules, component state or storage records. It should keep passing through an internal refactor that preserves behavior.
- Two existing seams, no new ones (the repo's convention, kept; assumed accepted because there was no one to confirm with while writing this):
  - *Seam 1, the app in a browser* (Playwright on WebKit, iPhone and iPad profiles), against a seeded build. Because problems are random, a test driver reads the problem shown on screen and computes the expected answer itself, so assertions don't depend on a particular seed. Scenarios per practice type: a full session with 20 problems of the right kinds, no repeats, right first try gets ✅, wrong then right gets "got it!" and ❌, wrong twice shows the answer and strategy, the ❌ sound only after the second wrong try, a retry round gives new problems of the same kinds, resume mid-problem restores the exact state including the first try's answer, Shuffle note, Break counting, and subject tag on Home.
  - *Seam 2, content tests* (`npm run test:content`): lesson file validation, including a math type in a Chinese lesson, bad rules, subject/type pairing, unique ids across subjects, and that the build skips Chinese-only output for math.
- Saved data: a saved-data fixture for the new schema version and the existing migration spec pattern, proving old backups and sessions import unchanged.
- Prior art: the existing Seam 1 specs and drivers for practice, resume, undo and break, progress, lesson preview and saved-data migration; the Seam 2 content tests and fixtures.
- Run only the relevant spec files while iterating, one Playwright pass at a time, as the repo's testing notes require.

## Out of Scope

- Audio for math, including reading word problems aloud.
- Any grade other than Grade 1 content (it's a rules change in a lesson file later).
- A timer, speed score, or leaderboard.
- Undo in math.
- A Home subject picker.
- Other subjects, such as English.
- Typed keyboard input for answers beyond the on-screen number pad.
- "Both parts unknown" put-together problems.

## Further Notes

- Handoff and the full design record: `.scratch/math-v1/handoff.md` (rounds 1 to 4, all settled; drift against current `main` already re-checked).
- Sub-issues: 1 Math subject plus Facts end to end; 2 Missing number; 3 True or false; 4 Strategies; 5 Word problems with emoji pictures; 6 Parent progress by problem kind and lesson preview with samples; 7 device sign-off on iPad and iPhone (`ready-for-human`). Issues 2 to 6 depend only on 1, so they can run in parallel.
