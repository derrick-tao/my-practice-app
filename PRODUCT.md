# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- *Learner:* a Grade 1 child practicing on a touch device (tablet or phone, installed to the home screen as a PWA), mostly on their own, in short sessions. Reading is early, so the child's screens lean on icons, audio and very short text.
- *Grown-up:* the parent, who publishes lessons, assigns them to the learner, reviews progress, and applies app updates. They use a gated parent area; the learner never needs it to practice.
- One device may hold more than one learner profile (name and avatar, own sessions and settings), with exactly one active at a time.

## Product Purpose

Help a young learner get ready for the school's actual tests and weekly lists. A lesson is one school test or week in one subject. Chinese (Mandarin) offers Write (dictation on paper, self-graded), Say (phrase recognition, self-graded) and Draw (stroke order, copied on paper, no marks). Math (Grade 1 operations) offers ⚡ Facts, 🔍 Missing, ⚖️ True?, 📖 Stories and 🧠 Tricks, checked by the app, with problems generated fresh each round. A session repeats rounds over the items marked ❌ until every item is ✅. Success is a child who can start, finish and repeat practice without a grown-up at their shoulder, and a parent who can see how it is going.

## Positioning

It practices the child's own school word and phrase lists, not a generic curriculum. The parent publishes lessons as content files, with Mandarin audio at normal and slow speed and stroke-by-stroke drawing. Learner data stays on the device, and the app makes no request outside its own origin.

## Operating Context

- Hosted on GitHub Pages. Lessons are YAML files in `content/<subject>/`, committed to `main`; the deploy workflow validates, builds and publishes them.
- Practice type screens: Home with a lesson card per lesson (Keep going on each practice type in progress), a lesson list, and one screen per practice type. Math uses an on-screen number pad and a True/False pad.
- Updates are applied only from What's new in the parent area, which lists releases newest first. The learner never sees an update prompt.
- Backup and restore of learner data are by exported file. Names and backup files must never be committed.

## Capabilities and Constraints

- Vocabulary is defined in `CONTEXT.md` (Subject, Lesson, Practice type, List, Session, Round, Mark, Try, Profile, Parent area, Release). Use its words and its "avoid" terms, and use the child-facing names (Write, Say, Draw, Tricks) in anything the learner sees.
- Per-profile settings: sounds on or off, Say learning mode, problems per practice (10, 15, 20), and stroke speed and pause.
- Touch-first: the viewport blocks pinch and double-tap zoom during practice, and the app runs full-screen from the home screen.
- Stack is Preact with Vite and TypeScript. Seam 1 e2e tests run in WebKit; content tests run in Vitest.
- Not decided or not recorded: a custom domain, other languages for the interface, and any additional subjects beyond Chinese and math.

## Brand Commitments

- App name: "My Practice App" (home screen title "My Practice").
- Kid-friendly tone. The child's math buttons carry the emoji names ⚡ 🔍 ⚖️ 📖 🧠. The learner's name and avatar are chosen by the family and never stored in the repo.

## Evidence on Hand

- Real lesson content: `content/chinese/fall-2026-assessment.yaml` and the math lessons under `content/math/`.
- Release log: `content/releases.json`.
- Domain language and decisions: `CONTEXT.md`, `docs/adr/`.
- No testimonials, usage statistics or external users are on record. Do not invent any.

## Product Principles

1. The child practices alone. Every learner screen must be usable without reading much and without a grown-up's help.
2. The parent stays in control. Anything that changes the app, the lessons or the data lives behind the parent gate, never in the learner's way.
3. Practice should feel low-stakes. A wrong answer is a chance to try again, not a failure, and the screen says so kindly.
4. Learner data stays on the device. No analytics, accounts or third-party requests.
5. The school's list is the curriculum. The app serves the lessons the parent publishes and does not replace them.

## Accessibility & Inclusion

- A young child with early reading. Large touch targets, short text, and audio for every Chinese item.
- Sound effects are optional per profile, and never silence the item audio.
- No further accessibility standard has been set. Record one here if it is adopted.
