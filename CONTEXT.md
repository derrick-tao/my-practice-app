# My Practice App

A kid-friendly practice app: a learner works through published lessons on their own and is graded (self-graded in Chinese, checked by the app in math), while a parent publishes lessons and reviews progress.

## Language

### Content

**Subject**:
The school subject a lesson belongs to, e.g. Chinese or math. A lesson has exactly one; two subjects tested in the same week are two lessons.
_Avoid_: Course, class

**Lesson**:
A published unit of practice for one school test or week in one subject (e.g. "Fall 2026 Assessment"), with a title, subject, and optional test dates; a Chinese lesson also has a script. It offers one or more practice types, each with its own list.
_Avoid_: Assessment, unit, word list

**Practice type**:
A way of practicing, with its own screen (e.g. dictation, phrase recognition).
_Avoid_: Mode, activity

**List**:
A lesson's items for one practice type, e.g. the Fall 2026 Assessment's 37 dictation characters or its 44 phrases. In math the list is not written in the lesson: new items are made for each session (as many as the profile's problems per practice setting, 20 unless changed), following what the practice type teaches.
_Avoid_: Item set, section

**Dictation**:
The practice type where the learner hears a character, writes it on paper, then checks and self-grades.
_Avoid_: Spelling, 听写 (in code and docs)

**Phrase recognition**:
The practice type where the learner sees a phrase, says it aloud, then hears it and self-grades.
_Avoid_: Phrase flashcards, reading

**Stroke order**:
The practice type where the learner hears a character, watches it drawn one stroke at a time while copying each stroke on paper, then taps Next. Nothing is graded: it has no marks, so its sessions have a single round. Offered only by lessons that have a list for it. It plays by itself, each stroke followed by a pause to copy it, and the profile's stroke speed and pause settings set the pace; the learner's only control is Replay.
_Avoid_: Tracing (kept for drawing over a character on screen), copying, draw-along, 笔顺 (in code and docs)

**Facts**, **Missing number**, **True or false**, **Word problems**, **Strategies**:
The math practice types, each answered by the learner and checked by the app: plain sums and differences (`8 + 6 = ☐`); an equation with the blank anywhere (`8 + ☐ = 11`); deciding whether an equation holds (`4 + 1 = 5 + 2`); short story problems; and guided steps through a strategy such as making ten (`8 + 6 = 10 + ☐`). The child's buttons call them ⚡ Facts, 🔍 Missing, ⚖️ True?, 📖 Stories and 🧠 Tricks.

**Trick**:
The child-facing name for one strategy in the Strategies practice type, e.g. "Make a ten" (seven in all: swap the order, make ten with three numbers, count on, make a ten, break down to ten, related fact, near doubles). Each has plain Grade-1 help: what it is, why it helps, and a worked example of the same lines the practice screen shows, with the answers filled in and numbers other than the current problem's.
_Avoid_: Strategy (in the child's screens; fine in code)

**Rules**:
A math lesson's settings for one practice type: the numbers its problems stay within and the operations they use.
_Avoid_: Config, settings

**Item**:
One thing to practice in a list. In Chinese its target is its identity within that list; in math it is one of the session's numbered spots, with one problem kind and a new problem each round.

**Problem kind**:
What a math item practices, e.g. "adding across ten". A session's items are spread evenly over the type's kinds, with any remainder going to different kinds (15 over 4 kinds is 4, 4, 4 and 3); Facts keeps half within 10 and half across ten as close as the size allows.
_Avoid_: Template, shape, question type

**Problem**:
The particular numbers a math item shows in one round, e.g. `8 + 6 = ☐`. A ❌ item gets a new problem of the same kind in the next round.
_Avoid_: Question, exercise

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
An item's grade in a round: ✅ correct or ❌ wrong. In Chinese the learner self-grades; in math the app checks the answer, and only a right first try is ✅ (so a True or false problem that is wrong is ❌ at once).

**Try**:
One answer the learner checks for a math problem. A number-pad problem allows two: a wrong first try gets "try again", and after a second wrong try the app shows the answer and how to get it (the ❌ sound plays then). Right on the second try is still ❌, with a cheerful "got it!" and the chime. True or false allows one, since with two choices a second try is only a guess: a wrong answer shows the answer and how to get it straight away, with the ❌ sound. A session saved with one wrong True or false try on record loads as missed.
_Avoid_: Attempt (the parent area's word for a session)

**Step**:
One blank of a math problem that has several, such as the Strategies problem `8 + 6`, then `8 + ☐ = 10`, `6 = 2 + ☐`, `10 + 4 = ☐`. Steps are answered one at a time and each has its own tries (two on the number pad); the earlier steps stay on screen with their answers. The problem is ✅ only if every step is right on its first try, and it counts once, after its last step. A problem with a single blank (Facts) has one step.

**Break (prompt)**:
A pause offered during a round after a set number of marks (in math, finished problems, not each try), or of Next taps in stroke order and learning sessions (the profile's break setting; off means never). The learner chooses Keep going or Break, and the count starts again either way.

**Undo entry**:
The record of the learner's latest mark, kept so Undo can take that mark back and return to the item. It is dropped when the session ends or the item leaves the list. Math practice types have no Undo, since the app grades.
_Avoid_: History, redo

### People and settings

**Profile**:
One learner's identity on the device: a name and avatar, their own sessions and progress, and their own settings. Exactly one is active at a time. Also called a learner in the parent area.
_Avoid_: Account, user

**Parent area**:
The grown-up part of the app behind the parent gate: profiles, lesson assignment, settings, progress, backup and the danger zone. A learner never needs it to practice.
_Avoid_: Admin, settings screen

**Sounds setting**:
A per-profile choice to play sound effects on ✅, ❌ and finishing. The chime plays for a right answer, even a right second try that is still marked ❌. It never silences the item audio.
_Avoid_: Mute, volume

**Learning setting**:
A per-profile choice, off by default, for a learner who hasn't memorized the phrases yet: while it is on, their new phrase recognition sessions are learning sessions. It is not a practice type; the learner still sees Say.
_Avoid_: Learn mode

**Problems per practice setting**:
A per-profile choice of 10, 15 or 20 (20 by default) for how many problems a new math session has. It applies when a session starts: a session in progress keeps its size, and its retry rounds cover only the problems missed. It never affects Chinese, whose sessions are as long as their lists. Where a lesson says how many problems it has, it shows this number.
_Avoid_: Session length, quiz size

### Releases

**Release**:
One dated entry in the app's change log: a short title and a few plain-language lines, written for the grown-up, about what is better for the learner or parent. Entries are written by hand for visible changes only, so most deploys have no release of their own. Newest first.
_Avoid_: Version, build, changelog entry (in the parent area's words)

**What's new**:
The parent area section that lists releases, newest first, and is where a grown-up applies a waiting update. The learner never sees an update prompt.
_Avoid_: Updates, release notes (as the section's name)
