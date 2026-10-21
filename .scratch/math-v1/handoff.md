# Handoff: math as a second subject (deferred)

**Status:** design complete on 2026-10-20; nothing is implemented. This records a design grilling session (`/grill-with-docs`, deferred 2026-10-19) so it can be picked up without redoing it. Rounds 1–4 are all settled (the final round was accepted as recommended on 2026-10-20). Written against commit `966caef`; codebase facts re-checked against `a80650f` (see "Drift since `966caef`").

**To resume:** apply the draft glossary entries to `CONTEXT.md`, add the draft ADR as `docs/adr/0003-…` (0002 is taken), and turn this into a spec issue with sub-issues per `docs/agents/issue-tracker.md` (the work split is Round 4, item 9). One item is still assumed rather than confirmed: the math test dates (Round 3, item 8).

## The ask

> Could this math text be converted and worked into a new practice type within the same existing lesson? It's also a new subject so not sure how we should think about this.

The school's text, verbatim:

> **Math — What we have learned and will be assessed**
>
> *Represent and solve problems involving addition and subtraction.*
> 1.OA.1 Use addition and subtraction within 20 to solve word problems involving situations of adding to, taking from, putting together, taking apart, and comparing, with unknowns in all positions, e.g., by using objects, drawings, and equations with a symbol for the unknown number to represent the problem.
>
> *Understand and apply properties of operations and the relationship between addition and subtraction.*
> 1.OA.3 Apply properties of operations as strategies to add and subtract. (Students need not use formal terms for these properties.) Examples: If 8 + 3 = 11 is known, then 3 + 8 = 11 is also known. (Commutative property of addition.) To add 2 + 6 + 4, the second two numbers can be added to make a ten, so 2 + 6 + 4 = 2 + 10 = 12. (Associative property of addition.)
> 1.OA.4 Understand subtraction as an unknown-addend problem. For example, subtract 10 – 8 by finding the number that makes 10 when added to 8. Add and subtract within 20.
> 1.OA.5 Relate counting to addition and subtraction (e.g., by counting on 2 to add 2).
> 1.OA.6 Add and subtract within 20, demonstrating fluency for addition and subtraction within 10. Use strategies such as counting on; making ten (e.g., 8 + 6 = 8 + 2 + 4 = 10 + 4 = 14); decomposing a number leading to a ten (e.g., 13 – 4 = 13 – 3 – 1 = 10 – 1 = 9); using the relationship between addition and subtraction (e.g., knowing that 8 + 4 = 12, one knows 12 – 8 = 4); and creating equivalent but easier or known sums (e.g., adding 6 + 7 by creating the known equivalent 6 + 6 + 1 = 12 + 1 = 13).
>
> *Work with addition and subtraction equations.*
> 1.OA.7 Understand the meaning of the equal sign, and determine if equations involving addition and subtraction are true or false. For example, which of the following equations are true and which are false? 6 = 6, 7 = 8 – 1, 5 + 2 = 2 + 5, 4 + 1 = 5 + 2.
> 1.OA.8 Determine the unknown whole number in an addition or subtraction equation relating three whole numbers. For example, determine the unknown number that makes the equation true in each of the equations 8 + ? = 11, 5 = ☐ – 3, 6 + 6 = ☐.

## Codebase facts that shaped the design (at `966caef`; still true at `a80650f` unless the drift section says otherwise)

- A lesson has exactly one `subject`. It shows in the folder (`content/chinese/`), the address (`#/chinese/dictation/<lessonId>`, `src/router.ts`), the manifest grouping (`Manifest.subjects`), and every saved `Session.subject`.
- Lesson ids are unique across all subjects (`id-unique` in `content-build/validate.ts`), so a math lesson can't reuse `fall-2026-assessment`.
- Everything about items is Chinese: targets must be Han (`target-cjk`), `script` is a required lesson field, build output always has `pinyin` and normal/slow Mandarin audio, and the Kai font is subset from targets.
- `PRACTICE_TYPE_IDS` (`src/content/types.ts`) is one flat list with no subject. The v1 spec (`.scratch/dictation-v1/spec.md`) planned for a registry entry to carry a subject, and said "Math may supply generated items instead of a list."
- Practice is self-graded throughout. A `Round` stores `itemIds` (targets), `marks` keyed by item id, a `phase` of `prompt`/`revealed`, and `heardCurrent` (`src/practice/session.ts`). Undo is one level.
- Randomness is injected (`src/practice/random.ts`); e2e builds are seeded, so generated content could be deterministic in Seam 1 tests.
- Saved data is at schema v2 with ordered migrations (`src/storage/migrations.ts`) and saved-data fixtures for old versions.
- The parent progress page shows attempts, first-try trend, best score, trickiest items, and each round's missed items. The lesson preview lists items.
- ADR-0001 kept a lesson's practice types in one lesson because the family sees them as one test.

## Drift since `966caef` (re-checked at `a80650f`)

Landed since: Pre-K lesson (#33), **stroke order / Draw** practice type (#42, #43, #47), the **learning setting** for Say (#44, ADR 0002), audio release fix (#45). What it changes for math:

- **Saved data is now schema v4**, so math's additive change is **v5**.
- **ADR 0002 is taken** (`0002-learning-is-a-setting-not-a-practice-type.md`); the math ADR is `0003`.
- `PRACTICE_TYPE_IDS` is now `dictation`, `stroke-order`, `phrase-recognition`. The registry order drives button order; math types are appended after them. `PRACTICE_TYPES` in `src/practice/practice-types.tsx` is the registry to extend with a subject.
- **Sessions no longer always have marks.** `hasMarks(session)` (`src/practice/session.ts`) is false for stroke order and learning sessions, and Progress, break count and completion branch on it. Math sessions *have* marks, but a mark needs the try count (first-try vs second-try) that today's `Mark` (`correct`/`wrong`) does not carry, so math rounds need their own saved shape for tries (Round 4, item 4 already says "each try's answer").
- **Screens are now flow components**: `src/screens/practice-flows.tsx` holds per-kind flows (stroke order, learning) and `practice.tsx` was slimmed. Math's number-pad flow belongs there as a new flow.
- **Break prompt** counts marks *or* Next taps (`marksSinceBreak`). Math counts a mark when a problem is finished (right first try, right second try, or answer shown), not each try.
- **Parent Progress** now lists learning sessions apart from attempts and has per-kind handling; math adds "by problem kind" to that. The Progress/lesson-preview files (`src/parent/sections/progress.tsx`, `lesson-preview.tsx`) changed a lot, so re-read them when slicing issue 6.
- **`CONTEXT.md`** now has **Subject**, **Stroke order**, **Learning session**, **Learning setting**; **Item**, **Mark**, **Session**, **Break (prompt)** and **Undo entry** are still the Chinese-only wording the draft changes below replace.
- **Two Chinese lessons** exist (`fall-2026-assessment`, `prek-2026-10-19`). Lesson ids are still unique across subjects, so `fall-2026-math-assessment` is fine.
- Still true: Chinese-only content build (`target-cjk`, `script` in `LESSON_KEYS`, pinyin, audio, Kai font in `content-build/`), `id-unique`, router `#/<subject>/<practiceType>/<lessonId>`, injected `RandomSource`, ordered migrations with saved-data fixtures per version.

## Settled decisions

### Round 1: shape

1. **A separate math lesson**, subject `math`, not more practice types inside the Chinese lesson. A different subject is a different test, and moving the subject off the lesson would change addresses, manifest and saved sessions.
2. **Every standard becomes practice**, as separate practice types within the math lesson (grouped in round 2).
3. **Graded by the app, not self-graded.** This is the major difference from Chinese. The ✅/❌ self-grade buttons don't apply; the UX is different.
4. **Generated, not a fixed list.** Each session gets 20 new problems per practice type, following what the practice type teaches.
5. **No audio yet.** Maybe later, for word problems.

### Round 2: practice

1. **Five practice types:**
   - *Facts* (1.OA.6): `8 + 6 = ?`, `13 – 4 = ?`.
   - *Missing number* (1.OA.8, 1.OA.4): blank anywhere, e.g. `8 + ? = 11`, `5 = ☐ – 3`, `8 + ? = 10` for `10 – 8`.
   - *True or false* (1.OA.7): `7 = 8 – 1`, `4 + 1 = 5 + 2`, `6 = 6`.
   - *Word problems* (1.OA.1): every situation, unknown in every position.
   - *Strategies* (1.OA.3, 1.OA.5, strategy part of 1.OA.6): guided steps, e.g. `8 + 3 = 11, so 3 + 8 = ?`, `2 + 6 + 4 = 2 + ☐`, `8 + 6 = 10 + ☐`, `7, count on 2 → ?`.
2. **The lesson file holds small *rules* per practice type:** `within` and `operations` only, each defaulting to Grade 1 (within 20; add and subtract). A later "within 100" test is a file change.
3. **Two tries.** A wrong first try gets a gentle "try again" with no answer shown. A second wrong try shows the correct answer plus a one-line worked strategy (e.g. `8 + 6 = 8 + 2 + 4 = 14`), then moves on. The mark is ✅ only if the first try was right; right on the second try still gets a cheerful "got it!".
4. **Retry rounds give new problems of the same kind**, not the same problem: the learner has seen the answer by then, so repeating it would test memory.
5. **Answer input:** a big 0–9 number pad with ⌫ and Check for numeric answers; two big buttons for true or false; one blank at a time for strategies. **No Undo in math**: with app grading it would only take back wrong answers.
6. **Word problems are sentence templates** per situation and unknown position, with names, objects and numbers filled in at random. Add emoji pictures (🍎🍎🍎…) for numbers up to 10, since 1.OA.1 mentions "objects, drawings". E.g. "Mia has 8 🍎. She gets 3 more. How many now?"

### Round 3: content and screens

1. **Kid-facing buttons** on one Math card: ⚡ Facts · 🔍 Missing · ⚖️ True? · 📖 Stories · 🧠 Tricks. Items are "problems" in every type.
2. **Problem kinds per practice type:**

   | Practice type | Problem kinds |
   |---|---|
   | Facts | add within 10 · subtract within 10 · add across ten (8+6) · subtract across ten (13−4) |
   | Missing number | blank first / middle / answer, for + and −, including written-backwards forms (`5 = ☐ − 3`) |
   | True or false | same number (`6 = 6`) · answer on the left (`7 = 8 − 1`) · swapped order (`5+2 = 2+5`) · two sums (`4+1 = 5+2`); about half true, false ones off by 1 or 2 |
   | Word problems | add to and take from (unknown result / change / start) · put together and take apart (unknown total / one part) · compare (unknown difference / bigger / smaller). Leave out "both parts unknown", which has many right answers |
   | Strategies | swap the order · make ten with three numbers (2+6+4) · count on · make ten (8+6 = 8+2+4) · break down to ten (13−4 = 13−3−1) · related fact (8+4=12, so 12−8) · near doubles (6+7 = 6+6+1) |

3. **The 20 problems are spread evenly across the type's kinds**, shuffled, with no repeats in a session. For Facts, half within 10 and half across ten, to match 1.OA.6's "fluency within 10".
4. **No timer and no speed score.** The first-try ✅ count already shows fluency.
5. **Parent progress uses the same layout.** *Trickiest* becomes problem kinds ("subtract across ten: ❌ 4 of 6"), and missed items show the problem and what the child entered (`13 − 4 = ?`, answered 8).
6. **Parent lesson preview** shows each type's rules, its problem kinds, and 5 sample problems, with a 🔀 button for new samples.
7. **A wrong first try is gentle:** a soft wobble and "Try again!" with no ❌ sound. The ❌ sound plays only after the second wrong try. With the Sounds setting off, there's no sound at all.
8. **First lesson:** `content/math/fall-2026-math-assessment.yaml`, title "Fall 2026 Math Assessment", test dates 2026-10-26 to 2026-10-30 (assumed the same as the Chinese one; confirm before publishing), all five types `within: 20`.

### Round 4: how it's built (accepted as recommended, 2026-10-20)

1. **Correction to rounds 2–3: what makes a math item unique.** Rounds 2–3 assumed an item's identity is its problem kind. That fails: 20 items over as few as 4 kinds means items share a kind, and rounds key marks by item id. *Decided:* a math item is one of the session's 20 numbered spots ("problem 7"), with one problem kind for the whole session and a new problem each round. Progress still totals by kind. The draft glossary and ADR below already assume this.
2. **One practice-type registry, each type tagged with a subject.** Validation rejects a math type in a Chinese lesson. Ids: `facts`, `missing-number`, `true-or-false`, `word-problems`, `strategies`. Addresses like `#/math/facts/fall-2026-math-assessment`.
3. **Problems are made in the app** when a session or retry round starts, using the injected random source (seeded in e2e). The content build only validates rules. Works offline; fresh problems need no deploy.
4. **Rounds save problems as data**, not text: kind, numbers, which spot is blank, and for word problems the name and object picked, plus each try's answer. The screen renders from that, so resume is exact. Saved-data schema v5 (next after the current v4), additive only, so Chinese sessions and v4 (and older) backups import unchanged.
5. **Lesson file shape:**

   ```yaml
   id: fall-2026-math-assessment
   title: Fall 2026 Math Assessment
   subject: math
   testDates: 2026-10-26 to 2026-10-30
   facts: { within: 20 }
   missing-number: { within: 20 }
   true-or-false: { within: 20 }
   word-problems: { within: 20 }
   strategies: { within: 20 }
   ```

   `operations` defaults to add and subtract. `script`, pinyin, audio and the Kai font become Chinese-only; the build skips them for math.
6. **Lesson changed mid-practice:** an in-progress math session keeps its problems; changed rules apply from the next session. A removed practice type ends its session the way a Chinese one does today.
7. **Home has no subject picker** (the v1 spec skipped it only while there was one subject). Each lesson card gets a small subject tag (Chinese / Math). Keep going cards are unchanged.
8. **Profile settings:** *Shuffle* doesn't apply to math (always mixed), and the parent area says so next to it. *Break* and *Sounds* work as now.
9. **Work split:** a spec issue with sub-issues:
   1. Math subject plus *Facts* end to end: lesson file and validation, subject-tagged registry, generation, number-pad screen, two tries, retry rounds, save and resume, schema v5.
   2. *Missing number*.
   3. *True or false*.
   4. *Strategies*.
   5. *Word problems* with emoji pictures.
   6. Parent progress by problem kind, and the preview with 🔀 samples.
   7. Device sign-off on iPad/iPhone (`ready-for-human`).

   2–6 depend only on 1, so they can run in parallel.

## Draft glossary changes for `CONTEXT.md`

Apply these when the work starts, not before: `CONTEXT.md` describes what the app is, and math isn't in it yet. The *Subject* entry was added now, because it is already true.

- Intro line: a learner "is graded (self-graded in Chinese, checked by the app in math)" instead of "self-grades".
- **Lesson**: "…with a title, subject, and optional test dates; a Chinese lesson also has a script…"
- **List**: add "In math the list is not written in the lesson: 20 new items are made for each session, following what the practice type teaches."
- **Facts**, **Missing number**, **True or false**, **Word problems**, **Strategies**: the math practice types, each answered by the learner and checked by the app: plain sums and differences (`8 + 6 = ?`); an equation with the blank anywhere (`8 + ? = 11`); deciding whether an equation holds (`4 + 1 = 5 + 2`); short story problems; and guided steps through a strategy such as making ten (`8 + 6 = 10 + ☐`).
- **Rules**: a math lesson's settings for one practice type: the numbers its problems stay within and the operations they use. _Avoid_: config, settings.
- **Item**: one thing to practice in a list. In Chinese its target is its identity within that list; in math it is one of the session's numbered spots, with one problem kind and a new problem each round.
- **Problem kind**: what a math item practices, e.g. "missing first number, adding within 20". _Avoid_: template, shape, question type.
- **Problem**: the particular numbers a math item shows in one round, e.g. `? + 5 = 12`. _Avoid_: question, exercise.
- **Mark**: an item's grade in a round: ✅ correct or ❌ wrong. In Chinese the learner self-grades; in math the app checks the answer, and only a right first try is ✅.
- **Try**: one answer the learner checks for a math problem. A problem allows two; after a second wrong try the app shows the answer and how to get it. _Avoid_: attempt (the parent area's word for a session).
- **Session** and **Break (prompt)**: a math session has marks and rounds like Chinese graded ones; a break counts a finished problem (not each try).
- **Undo entry**: add "Math practice types have no Undo, since the app grades."

## Draft ADR (becomes `docs/adr/0003-…` when the work starts)

> # Math items are generated: a new problem each session and round
>
> Chinese lists are written by hand and self-graded, and an item is its target text. Math is different: the school sends standards (1.OA.1–1.OA.8), not a list, and a fixed set of equations would be memorized rather than solved. So a math lesson holds no items. For each practice type it holds small rules (the numbers to stay within, the operations), and each session makes 20 items from them, spread across the type's problem kinds. The app checks the answer and shows the right one after a second wrong try, so a ❌ item comes back in the next round as a new problem of the same kind: repeating the shown problem would test memory.
>
> Math is its own lesson (subject `math`) even when its test falls in the same week as a Chinese lesson. ADR-0001 kept a lesson's practice types together because the family sees them as one test; a different subject is a different test, and a lesson belongs to one subject throughout (its folder, its address, its sessions).
>
> ## Considered Options
>
> - **Hand-written math lists**, like Chinese: matches the existing content pipeline, but the problems repeat every session and would be learned by heart.
> - **Retrying the same problem in later rounds**: keeps an item as its text, as in Chinese, but by then the learner has seen the answer.
> - **Math as more practice types inside the Chinese lesson**: one card on Home, but it would take the subject off the lesson and move it onto each practice type, changing addresses and saved sessions.
