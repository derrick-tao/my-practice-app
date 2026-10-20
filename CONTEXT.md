# My Practice App

A kid-friendly practice app: a learner works through published lessons on their own and self-grades, while a parent publishes lessons and reviews progress.

## Language

### Content

**Subject**:
The school subject a lesson belongs to, e.g. Chinese. A lesson has exactly one; two subjects tested in the same week are two lessons.
_Avoid_: Course, class

**Lesson**:
A published unit of practice for one school test or week in one subject (e.g. "Fall 2026 Assessment"), with a title, subject, script, and optional test dates. It offers one or more practice types, each with its own list.
_Avoid_: Assessment, unit, word list

**Practice type**:
A way of practicing, with its own screen (e.g. dictation, phrase recognition).
_Avoid_: Mode, activity

**List**:
A lesson's items for one practice type, e.g. the Fall 2026 Assessment's 37 dictation characters or its 44 phrases.
_Avoid_: Item set, section

**Dictation**:
The practice type where the learner hears a character, writes it on paper, then checks and self-grades.
_Avoid_: Spelling, 听写 (in code and docs)

**Phrase recognition**:
The practice type where the learner sees a phrase, says it aloud, then hears it and self-grades.
_Avoid_: Phrase flashcards, reading

**Stroke order**:
The practice type where the learner hears a character, watches it drawn one stroke at a time while copying each stroke on paper, then taps Next. Nothing is graded: it has no marks, so its sessions have a single round. Offered only by lessons that have a list for it. Each stroke is followed by a pause to copy it; the profile's stroke speed and pause settings set the pace.
_Avoid_: Tracing (kept for drawing over a character on screen), copying, draw-along, 笔顺 (in code and docs)

**Item**:
One thing to practice in a list. Its target is its identity within that list.

**Target**:
The Chinese text of an item: the character to write in dictation or draw in stroke order, or the phrase to say in phrase recognition.

### Practice

**Session**:
One learner's run through one list, made of rounds (one without marks, in stroke order or a learning session, has just one). Also called an attempt in the parent area. A learner has at most one session in progress per lesson and practice type, all at once; opening a list continues its session or starts one, and never stops another. Home shows a Keep going card for each, most recently used first.

**Learning session**:
A phrase recognition session started while the learner's learning setting is on: one pass where each phrase is shown and heard and the learner moves on with Next. It has no marks and no score, and does not count toward attempts or the first-try trend. A session stays the kind it started as, even if the setting changes before it finishes.
_Avoid_: Learn mode, preview, flashcards

**Round**:
An ordered pass over a set of items; round 1 covers them all, and each later round covers only the items marked ❌ in the round before.

**Mark**:
The learner's self-grade for an item in a round: ✅ correct or ❌ wrong.

**Break (prompt)**:
A pause offered during a round after a set number of marks, or of Next taps in stroke order and learning sessions (the profile's break setting; off means never). The learner chooses Keep going or Break, and the count starts again either way.

**Undo entry**:
The record of the learner's latest mark, kept so Undo can take that mark back and return to the item. It is dropped when the session ends or the item leaves the list.
_Avoid_: History, redo

### People and settings

**Profile**:
One learner's identity on the device: a name and avatar, their own sessions and progress, and their own settings. Exactly one is active at a time. Also called a learner in the parent area.
_Avoid_: Account, user

**Parent area**:
The grown-up part of the app behind the parent gate: profiles, lesson assignment, settings, progress, backup and the danger zone. A learner never needs it to practice.
_Avoid_: Admin, settings screen

**Sounds setting**:
A per-profile choice to play sound effects on ✅, ❌ and finishing. It never silences the item audio.
_Avoid_: Mute, volume

**Learning setting**:
A per-profile choice, off by default, for a learner who hasn't memorized the phrases yet: while it is on, their new phrase recognition sessions are learning sessions. It is not a practice type; the learner still sees Say.
_Avoid_: Learn mode
