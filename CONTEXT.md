# My Practice App

A kid-friendly practice app: a learner works through published lessons on their own and self-grades, while a parent publishes lessons and reviews progress.

## Language

### Content

**Lesson**:
A published unit of practice for one school test or week (e.g. "Fall 2026 Assessment"), with a title, subject, script, and optional test dates. It offers one or more practice types, each with its own list.
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

**Item**:
One thing to practice in a list. Its target is its identity within that list.

**Target**:
The Chinese text of an item: the character to write in dictation, or the phrase to say in phrase recognition.

### Practice

**Session**:
One learner's run through one list, made of rounds. Also called an attempt in the parent area. A learner has at most one session in progress per lesson and practice type, all at once; opening a list continues its session or starts one, and never stops another. Home shows a Keep going card for each, most recently used first.

**Round**:
An ordered pass over a set of items; round 1 covers them all, and each later round covers only the items marked ❌ in the round before.

**Mark**:
The learner's self-grade for an item in a round: ✅ correct or ❌ wrong.

**Break (prompt)**:
A pause offered during a round after a set number of marks (the profile's break setting; off means never). The learner chooses Keep going or Break, and the count starts again either way.

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
