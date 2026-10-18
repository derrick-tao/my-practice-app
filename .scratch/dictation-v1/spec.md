# Spec: Chinese Dictation Practice (v1) for a static GitHub Pages practice app

Status: ready-for-agent

## Problem Statement

A first-grade learner has to prepare for Chinese character dictation (听写) tests at school. The class hands out a list of characters, and at the test the teacher says each one aloud while the children write it on paper. Practicing this at home today needs a parent to sit there the whole time: read each character aloud (often several times), wait for it to be written, show the answer, keep track of which ones were missed, and then go back over only the missed ones until the child gets them all.

The child can't do this alone. They can't read the list without seeing the answers, they need to hear proper Mainland Mandarin pronunciation, and a 6-year-old can't keep track of misses across several passes. The parent also has no record of how practice went: how many tries it took, which characters keep being missed, or whether the child is improving before the test.

The family wants a free, simple website (hosted on GitHub Pages, with no server) that the child can use alone on an iPhone or iPad, that never loses progress when the browser closes, and that the parent can load with new word lists each week. It is the first of several practice types (later: phrase flashcards and sentence building), and Chinese is the first of several subjects (later: English and math).

## Solution

An installable web app, hosted on GitHub Pages, with a child-facing practice area and a parent area protected by a gate.

The **parent** publishes word lists by editing a simple list file in the GitHub repo, which works from a phone browser. On every publish, an automated build checks the file and pre-generates natural Mainland Mandarin audio (normal speed and slow) for each character using a cloud text-to-speech voice, then deploys the site. In the app's parent area, the parent creates a learner profile, assigns lists to the learner, adjusts a few settings, previews every item's audio, reviews progress per list, and exports or imports backups.

The **child** opens the app from the home screen, picks an assigned list (a big card), and practices one character at a time:
- The character's audio plays, e.g. "找，找东西的找" (the character, then a clue word containing it).
- The child writes it on paper, replaying the audio at normal or slow speed as often as they like.
- They tap **Check** to reveal the character with its pinyin and clue word.
- They mark themselves ✅ (got it) or ❌ (not yet), and the next character plays.

After all characters, a summary shows how many were ✅ and ❌. A big button starts a new round with only the ❌ characters, reshuffled. This repeats until every character is ✅, and the app then celebrates with the first-try score and the number of rounds it took.

Progress is saved to on-device storage after every step. Closing the browser, force-quitting, or losing power never loses progress, and reopening offers **Keep going**, which resumes at the exact character, round, and step. The child can **Start over** (with a confirmation), and the parent can erase all progress. The app works fully offline once installed. No learner data ever leaves the device except in backup files the parent exports.

## User Stories

### Child: starting and resuming

1. As a child, I want to see my avatar and a friendly greeting when I open the app, so that I know it's my practice.
2. As a child, I want to see the lists my parent assigned to me as big colorful cards, so that I can pick one without reading much.
3. As a child, I want each list card to show the test date, so that I know which one is coming up.
4. As a child, I want each list card to show how many characters it has, so that I know how long it will take.
5. As a child, I want a big "Keep going" button when I have unfinished practice, so that I can continue right where I stopped.
6. As a child, I want the Keep going card to show my progress as stars, so that I can see how far I've come without reading numbers.
7. As a child, I want the Keep going card to show which round I'm on, so that I know I'm practicing my missed characters.
8. As a child, I want to tap a profile avatar to switch to my profile when more than one learner uses the device, so that I practice with my own progress.

### Child: listening and writing

9. As a child, I want the character's audio to play automatically when a new character appears, so that I can start writing right away.
10. As a child, I want to hear the character followed by a clue word ("找，找东西的找"), so that I know which character is meant when several sound the same.
11. As a child, I want a big Listen button to replay the audio as many times as I want, so that I can listen again while I write.
12. As a child, I want a big Slow button that plays the audio more slowly, so that I can hear each sound clearly.
13. As a child, I want the Check button to appear only after I've heard the audio, so that I don't accidentally see the answer before listening.
14. As a child, I want a star progress bar at the top, so that I can see how many characters are left.
15. As a child, I want a Home button that saves my place, so that I can stop anytime and come back later.

### Child: checking and marking

16. As a child, I want to tap Check to see the character, so that I can compare it with what I wrote on paper.
17. As a child, I want the revealed character to be very large and in a handwriting-style font, so that it looks like what I learn to write at school.
18. As a child, I want to see the pinyin under the character, so that I can connect the sound to the character.
19. As a child, I want to see the clue word in small text on the reveal, so that I remember the word I heard.
20. As a child, I want to replay the audio (normal or slow) on the reveal screen, so that I can listen again while looking at the character.
21. As a child, I want a big green ✅ "I got it" button, so that I can mark a character I wrote correctly.
22. As a child, I want a big red ❌ "Not yet" button, so that I can mark a character I got wrong without feeling bad.
23. As a child, I want ✅ and ❌ to differ in shape as well as color, so that I can tell them apart easily.
24. As a child, I want a soft happy sound when I tap ✅ and a gentle sound when I tap ❌ (never a harsh buzzer), so that practice feels encouraging.
25. As a child, I want the next character to start playing right after I mark, so that practice flows without extra taps.
26. As a child, I want an Undo button right after I mark, so that I can fix it if I tapped the wrong button.
27. As a child, I want Undo to work even if my mark finished the round, so that a mis-tap on the last character can be fixed.

### Child: breaks, rounds, and finishing

28. As a child, I want a "Great job! Take a break?" message every 10 characters, so that I don't get too tired on long lists.
29. As a child, I want "Keep going" to be the big default choice on the break message, so that I can continue easily if I'm not tired.
30. As a child, I want a round summary showing how many I got ✅ and ❌, so that I know how I did.
31. As a child, I want a big "Practice the ❌ words" button on the summary, so that I can practice only the ones I missed.
32. As a child, I want the missed characters in a new order in the next round, so that I can't just remember the order.
33. As a child, I want the rounds to keep going until I get every character right, so that I really learn them all.
34. As a child, I want confetti and a big "You did it! 🎉" when everything is ✅, so that I feel proud.
35. As a child, I want the finish screen to show how many I got right on the first try, so that I know my real test score.
36. As a child, I want the finish screen to show how many rounds it took, so that I can try to do better next time.
37. As a child, I want a "Start over" button with an "Are you sure?" check, so that I can restart a list without doing it by accident.

### Child: safety and ease of use

38. As a child, I want every button to be big and icon-led with at most one or two easy English words, so that I can use the app without help.
39. As a child, I want confirmations to use ✅ Yes and ❌ No icons, so that I understand what I'm choosing.
40. As a child, I want the app to work when I turn the iPad sideways or upright, so that I can hold it however I like.
41. As a child, I want a "Turn up the volume" hint if I can't hear anything, so that I know what's wrong.
42. As a child, I want the app to work without internet, so that I can practice in the car.
43. As a child, I want to be asked for a grown-up when I try to switch to a different list in the middle of practice, so that I don't lose my place by mistake.

### Parent: setup and profiles

44. As a parent, I want a first-run flow that asks a grown-up to set up the app, so that the child isn't confused on first launch.
45. As a parent, I want to create a learner profile with a name and an emoji avatar, so that the child recognizes their own profile.
46. As a parent, I want to add more learner profiles, so that a sibling can use the same device with separate progress.
47. As a parent, I want to edit or delete a profile (delete confirmed by typing the name), so that I can manage profiles without accidents.
48. As a parent, I want the child's name to be stored only on the device, so that it never ends up in the public repo or on the internet.

### Parent: gate

49. As a parent, I want the parent area behind a multiplication question the child can't answer, so that the child can't change settings or erase progress.
50. As a parent, I want a new question after a wrong answer (no lockout), so that I'm never stuck.
51. As a parent, I want the gate to re-lock when I leave the parent area or after 5 minutes idle, so that the child can't get in after I hand the device back.
52. As a parent, I want an on-screen number pad for the gate, so that it works smoothly on the phone.

### Parent: lists and content

53. As a parent, I want to add a word list by writing a simple text file in the GitHub repo from my phone, so that I can publish the week's list in minutes.
54. As a parent, I want each list to have a title, script (simplified or traditional), optional test dates, and items, so that it matches what the school sends home.
55. As a parent, I want each item to have the character, a clue word, optional pinyin, an optional lesson tag, and an optional exact spoken text, so that I can fix anything the voice gets wrong.
56. As a parent, I want pinyin filled in automatically when I leave it out, so that I write less.
57. As a parent, I want the build to reject a list with a clear message naming the file, the item, and the problem, so that a typo never breaks the app.
58. As a parent, I want audio generated automatically for new or changed items when I publish, so that I never record anything myself.
59. As a parent, I want audio generated only for new or changed items, so that the free cloud voice quota is never used up.
60. As a parent, I want the list to show up in the app a few minutes after I publish, so that the child can practice right away.
61. As a parent, I want a "New words are ready" message on the child's home screen when new content is published, so that the app updates without interrupting a practice.
62. As a parent, I want to assign and unassign lists for each learner, so that the child sees only what they should practice.
63. As a parent, I want to preview every item in a list (character, pinyin, clue, normal and slow audio), so that I can check the voice and readings before the child practices.
64. As a parent, I want a fix to a clue, pinyin, or audio to apply to an in-progress practice right away, so that the child hears the corrected version.
65. As a parent, I want a character I remove from a list to drop out of in-progress practice, so that the child doesn't practice something that's no longer on the test.
66. As a parent, I want characters I add to a list to appear in the next practice rather than mid-practice, so that the current round's counts stay consistent.

### Parent: settings

67. As a parent, I want to turn shuffling on or off for the first round, so that I can practice in the teacher's order if I want.
68. As a parent, I want to set how often the break message appears (off, 5, 10, or 15 characters), so that it fits my child's attention span.
69. As a parent, I want to mute the app's sound effects, so that practice can be quiet (character audio still plays).

### Parent: progress review

70. As a parent, I want a progress page for each list, so that I can see how practice is going before the test.
71. As a parent, I want to see every attempt at a list with its date, status (completed, in progress, stopped), first-try score, and rounds to complete, so that I can see improvement over time.
72. As a parent, I want to open an attempt and see each round's ✅ and ❌ counts and which characters were missed, so that I know exactly what needs work.
73. As a parent, I want a "trickiest characters" list (most ❌ across all attempts), so that I can focus on them before the test.
74. As a parent, I want to tap a missed or tricky character to hear it, so that I can quiz my child on the spot.
75. As a parent, I want to see the first-try score trend across completed attempts (e.g. 28 → 33 → 37), so that I can see progress at a glance.
76. As a parent, I want stopped attempts listed but left out of the trend and best score, so that restarts don't skew the numbers.

### Parent: durability and backup

77. As a parent, I want progress saved after every single step, so that nothing is lost if the browser closes or the battery dies.
78. As a parent, I want to export all progress to a backup file through the share sheet (Save to Files, AirDrop), so that a browser data wipe doesn't erase months of practice.
79. As a parent, I want to import a backup, see a summary of what's in it, and confirm before it replaces the data on the device, so that restoring is safe and predictable.
80. As a parent, I want to see when I last made a backup and a reminder after 7 days, so that I remember to back up.
81. As a parent, I want to see whether the browser granted persistent storage, so that I know how safe on-device data is.
82. As a parent, I want to erase all progress for one learner (double confirmation), so that the learner can truly start from scratch.
83. As a parent, I want to erase everything on the device (double confirmation plus typing ERASE), so that I can fully reset the app.
84. As a parent, I want a one-time tip on adding the app to the home screen, so that the app works offline and its data is protected from browser cleanup.
85. As a parent, I want to see the app version and content version, so that I can confirm an update arrived.

### Future-facing

86. As a parent, I want the app organized by subject and practice type, so that English, math, phrase flashcards, and sentence building can be added later without starting over.
87. As a parent, I want saved data to carry a version number and upgrade automatically, so that future updates never break existing progress.
88. As a parent, I want storage behind one replaceable module, so that the app can later move to a real database with sync without rewriting practice logic.

## Implementation Decisions

### Platform and stack

- Static single-page app hosted on GitHub Pages from a **public** repo named `my-practice-app`, deployed by GitHub Actions on push to `main`, using the owner's **personal github.com account** (not corporate GitHub Enterprise hosts).
- Vite + TypeScript (strict) + Preact.
- Hash-based routing (GitHub Pages has no SPA fallback). Routes follow the shape subject → practice type → list, e.g. Chinese / Dictation / a list, so new subjects and practice types slot in.
- The app is served under the repo's subpath, so all asset and route URLs must respect that base path.
- Installable PWA (standalone display, any orientation, icons). A service worker precaches the app shell, the font subset, the content manifest, all list data, and all referenced audio, so the app works fully offline after one online visit.
- A new service worker waits, and the child's home screen shows "New words are ready!". Tapping it reloads. The app never reloads automatically during practice.
- No third-party runtime requests, analytics, or tracking. All assets are same-origin.
- Primary target is Chrome on iOS (WebKit) on iPhone and iPad, in portrait and landscape.

### Domain vocabulary

- **Learner / Profile**: a named child with an emoji avatar, per-profile settings, and assigned lists. Stored only on the device.
- **List**: a published word list (title, subject, allowed practice types, script, optional test dates, items).
- **Item**: one thing to practice. Its **target** is the character(s) to write and also its identity within the list. It can also have a **clue** (a context word containing the target), **pinyin**, a **lesson** tag, and a **say** override.
- **Spoken prompt**: what the audio says. It is the `say` override if present; otherwise "target，clue的target" if there's a clue; otherwise just the target.
- **Session / Attempt**: one learner's run through one list, made of rounds. Its status is active, completed, or stopped.
- **Round**: an ordered pass over a set of items. Round 1 covers all items. Each later round covers only the items marked ❌ in the previous round.
- **Mark**: the learner's self-grade for an item in a round: correct or wrong.
- **First-try score**: the number of correct marks in round 1, out of the number of items in round 1.
- **Rounds to complete**: the number of rounds in a completed session.
- **Parent gate**: the math question that protects parent-only actions.

### Content pipeline (build time)

- Lists are authored as **YAML, one file per list**, grouped by subject in a content folder in the repo. A list's id must equal its file name.
- **List fields:** id, title, subject, allowed practice types, script (`simplified` | `traditional`), optional free-text test dates, items.
- **Item fields:** target (required), clue, pinyin, lesson, say.
- **Validation runs before every build and fails it** with file, item, and rule on any of these:
  - a required field is missing, or a key is unknown
  - the list id doesn't match the file name, or is used by another list
  - a target is duplicated or empty, or isn't CJK for Chinese lists
  - a clue doesn't contain its target
  - pinyin is malformed, or its syllable count doesn't match the target length
- Validation only warns if a list's characters look like the other script.
- Pinyin is auto-generated at build time when omitted (with a pinyin library), and stored explicitly in the build output.
- **Text-to-speech:**
  - Provider is **Azure Neural TTS**, voice `zh-CN-XiaoxiaoNeural`, Mainland Mandarin. Two renditions per item: normal rate, and slow (about −30% rate).
  - Provider, voice, rates, and output format live in one TTS config. Changing the voice regenerates the audio.
  - An unofficial `edge-tts` provider exists as a fallback, switched on by a config flag.
- **Polyphone handling:** standalone occurrences of the target in the spoken prompt are wrapped in an SSML phoneme tag derived from the item's pinyin, so isolated characters with several readings (什 shén, 么 me, 只 zhī, 分 fēn) are read as intended. If Azure's zh-CN phoneme support turns out to be insufficient, those items get an explicit `say` override instead.
- **Audio storage:**
  - Audio files are **content-addressed**: the file name is a hash of provider + voice + rate + SSML. Generation is skipped if the file exists.
  - Generated MP3s are **committed back to the repo** by the deploy workflow, so a re-deploy makes zero cloud calls, and local development works without a key.
  - A prune option removes unreferenced audio.
- The build fails if any item lacks audio and no provider credentials are available. Audio is never silently missing.
- **Build output:**
  - a content manifest: content version, subjects → practice types → list summaries (id, title, script, test dates, item count)
  - one data file per list: metadata, plus items with target, clue, pinyin, lesson, and audio URLs (normal and slow)
  - The content version is a hash of all list data, used for the update prompt and cache busting.
- A **Kai-style handwriting font** subset (an open-source font such as LXGW WenKai, OFL-licensed) containing only the characters in the content is generated at build time, for revealed characters.
- **CI:**
  - Pull requests run validation, typecheck, tests, and build, without secrets or audio generation.
  - Pushes to main run validation → audio generation (using the Azure key and region secrets) → commit new audio (skip-ci) → build → tests → deploy to Pages.
  - Concurrency is limited to one Pages deploy at a time.
  - The Azure key is never logged.

### Data model (on-device)

- All learner data is stored in **IndexedDB**, behind a **StorageAdapter** interface that the UI and practice logic depend on exclusively. v1 implements it with IndexedDB. A future implementation can talk to a database API.
- Adapter operations:
  - load and save the app record
  - get a session, list sessions by profile (optionally by list and status), put a session
  - delete all sessions for a profile
  - export everything, import everything (replace)
- **App record:**
  - schema version (starts at 1)
  - profiles
  - active profile id
  - parent metadata (last backup timestamp)
- **Profile:**
  - id (UUID), name, avatar emoji, created timestamp
  - settings: shuffle (default on), break-every (off, 5, 10, or 15; default 10), sounds (default on)
  - assigned list ids
- **Session:**
  - id (UUID), profile id, subject, practice type, list id
  - content version at start
  - status (active | completed | stopped)
  - started and completed timestamps
  - ordered rounds
  - a single undo entry (or none)
  - a marks-since-break counter
- **Round:**
  - index (1-based)
  - ordered item ids for this round
  - current position
  - phase (listening | revealed)
  - heard-current flag (the audio for the current item has started at least once)
  - map of item id → mark
  - started and completed timestamps
- **Undo entry:** round index, item id, position, previous mark.
- IDs are UUIDs and timestamps are ISO-8601. Everything is plain JSON, so the same shape serves the backup file and a future API.
- Ordered **migrations** run on load (version N → N+1). A backup from a newer schema than the app supports is refused with a message.
- **Every state change is persisted before the UI moves on.** A failed write shows "Couldn't save — tap to retry" and doesn't advance.
- On first run the app requests persistent storage, and shows the result in the parent area.

### Practice logic (dictation)

- **One active session per profile.** Starting a different list while one is active requires the parent gate, and marks the old session stopped.
- Round 1 order is the list order, shuffled if the shuffle setting is on. Later rounds always contain exactly the items marked wrong in the previous round, shuffled. Shuffling uses an injectable random source.
- A session completes when a round finishes with zero wrong marks.
- **Listening phase:**
  - Normal and slow audio can be played without limit.
  - Playing either one sets the heard flag.
  - Check is available only once the heard flag is set.
- **Revealed phase:** shows the target, pinyin, and clue; audio is still playable; the learner marks correct or wrong.
- **A mark:**
  - records the result
  - sets the single undo entry
  - advances the position
  - increments the break counter
  - auto-plays the next item's normal audio from inside the tap handler (so iOS allows the audio). If play is rejected, the Listen button pulses.
- **Break prompt:**
  - shown when the break counter reaches the break-every setting, but never at the end of a round
  - Keep going (default) continues
  - Break saves and returns home
  - scoring is unaffected
- **Round end:** shows the round summary (✅ and ❌ counts). If any marks are wrong, a "Practice the ❌ words" action starts the next round. Otherwise the session completes.
- **Undo:**
  - one level, from the next item's listening screen or from the round summary (including a round summary the undone mark created)
  - restores the previous item in the revealed phase with its mark removed
  - cleared by the next mark or by starting a new round
  - not available after completion
- **Start over (child, confirmed):** marks the current session stopped and creates a new session for the same list, freshly ordered.
- **Resume:**
  - restores the exact round, position, phase, and heard flag
  - audio does not auto-play on resume (iOS gesture rules); the learner taps Listen
- **When a list changes under an active session** (checked when the session is opened):
  - edits to clue, pinyin, or audio apply immediately (sessions store item ids only)
  - removed items drop out of the current round's remaining items and out of future rounds. If the current item was removed, practice moves to the next one. If the round is then finished, the round summary shows.
  - marks for removed items in finished rounds stay in history, labeled "(removed)"
  - added items don't join the active session
  - if every item was removed, the session becomes stopped and the child sees a friendly "This list changed" message
- **Sound effects** (soft chime for correct, gentle tone for wrong, fanfare on completion) play only when the sounds setting is on. There is never a harsh error buzzer.
- **Audio playback:** each item has normal and slow audio elements; the current and next items' audio are preloaded.

### Kid UI

- Icon-first, at most 1–2 simple English words per control ("Listen", "Slow", "Check", "I got it", "Not yet").
- Touch targets are at least 64 pt, and primary actions about 96 pt tall. Kid screens have no small text links.
- Correct and wrong use color plus a distinct shape. Confirmations use ✅ Yes / ❌ No.
- No destructive action takes a single tap.
- The revealed character is very large (about 40% of the short side of the screen) in the Kai-style font subset, falling back to the system font.
- `prefers-reduced-motion` replaces confetti with a simple fade.
- **Screens:**
  - **First-run:** "Ask a grown-up" → gate → create profile → assign lists → home
  - **Home:** greeting with avatar; avatar switcher when there are several profiles; Keep going card (StarBar, round badge, Start over); assigned list cards with test dates and item count; a small gear opening the gate; "New words are ready" banner when an update is waiting
  - **Practice, listening:** Home, StarBar (filled fraction plus small "n / total"), round badge when the round is past 1, Listen, Slow, Check (once heard), and the Undo chip after a mark
  - **Practice, revealed:** character, pinyin, clue, Listen and Slow, I got it, Not yet
  - **Break prompt**
  - **Round summary:** counts, "Let's practice N more!", Practice the ❌ words, Home, Undo chip
  - **Completed:** confetti, "You did it!", "X of Y on the first try!", "Rounds: N", Home
  - **Errors:** "Couldn't save — tap to retry"; a volume hint after repeated audio failures; an offline content message

### Parent area

- **Gate:**
  - random `a × b` with a and b from 6–9, entered on an on-screen number pad
  - a wrong answer gives a new question, with no lockout
  - stays unlocked until the parent leaves the parent area or after 5 minutes idle
  - also required to stop an active session in order to start another list
- **Sections:**
  - **Profiles:** add, edit, delete (confirmed by typing the name), switch active profile
  - **Assign lists:** a toggle per list from the manifest
  - **Settings** (per profile): shuffle, break-every, sounds
  - **Progress**
  - **List preview:** every item with target, pinyin, clue, and normal and slow audio
  - **Backup:** export, import, last-backup age with a nudge after 7 days, persistent-storage status, app and content version
  - **Danger zone:** erase one learner's progress (double confirm); erase everything (double confirm plus typing ERASE)
- **Progress page**, per profile and per list:
  - header: title, test dates, item count, number of attempts, best first-try score
  - attempts, newest first: start date, status, first-try score, rounds to complete
  - attempt detail, per round: item count, ✅ count, ❌ count, and the missed characters (tap to hear)
  - trickiest characters: top 10 by total wrong marks across attempts, with counts (tap to hear)
  - first-try trend across completed attempts, as plain numbers
  - stopped attempts are listed but excluded from trend and best
  - lesson tags are kept in the data for future grouping, with no lesson grouping in the v1 UI
- **Backup file:**
  - JSON containing an app identifier, a kind marker, the schema version, an export timestamp, the app record, and all sessions
  - named with the export date
  - exported through the Web Share API with a file (iOS share sheet), falling back to a download
- **Import:**
  - validates the file
  - shows a summary (number of learners, number of attempts, last used)
  - after confirmation, replaces all local data
  - the last-backup timestamp comes from the imported file

### Privacy

- Learner names, avatars, and progress exist only in on-device storage and in backup files the parent exports.
- The repo contains only code, lists, and generated audio.
- The repo ignores backup files (gitignore).
- An optional check/pre-commit hook scans committed content against a local-only, gitignored denylist (e.g. the child's name).
- The TTS key exists only as a GitHub Actions secret (and in the owner's local Keychain for local generation). It's never printed, and it's never given to pull-request builds.

### Extensibility (shape only, nothing built in v1)

- A **practice-type registry** entry has: id, subject, label, icon, the item fields it requires, its screen, and engine configuration. Dictation is the only entry in v1.
- The session → round → mark model is generic for any self-graded practice type. Phrase flashcards (see a phrase, say it, self-grade) reuse it directly.
- Sentence building would add an optional ordered token list to items.
- Subjects other than Chinese use the existing subject field on lists, sessions, and routes. Math may supply generated items instead of a list.
- The home screen skips a subject picker while only one subject exists.
- A session holds one list in v1. Combining several lists becomes a list of list ids, added by migration.

## Testing Decisions

- **What makes a good test here:** it drives the system only through its public surface (what the child or parent taps and sees, or what the content build accepts and produces) and asserts observable outcomes. It does not reach into internal modules, component state, storage records, or engine functions directly. Tests should keep passing through a full internal refactor that preserves behavior.
- **Two test seams, no others.** There is deliberately no separate unit-test seam for the practice logic. Edge cases of rounds, undo, and list reconciliation are covered through the app seam using small fixture lists.

### Seam 1: the app in a browser (primary)

Playwright on WebKit, with iPhone and iPad (portrait and landscape) device profiles. Tests run against the built app serving fixture content (small lists of 3–6 items), with audio playback stubbed so tests can tell whether, when, and at what rate audio was requested. Reloads, offline mode, and fresh browser contexts stand in for app restarts and new devices. Scenarios:

1. **First run:** gate → create profile → assign a list → the list card appears with its test dates and count.
2. **Full flow:**
   - a list played with 2 misses → round summary counts → retry round contains exactly those 2 items
   - one missed again → round 3 → all correct
   - the completion screen shows the right first-try score and rounds
3. **Practice details:**
   - Check is hidden until audio has been requested
   - Slow requests the slow rendition
   - marking auto-requests the next item's audio
4. **Shuffle:** shuffle off gives list order in round 1; retry rounds are reordered (seeded random source exposed only in test builds).
5. **Breaks:** the break prompt appears at the configured cadence, never at a round end; Break returns home and Keep going resumes.
6. **Undo:**
   - restores the revealed state with the mark removed
   - undo from a round summary created by the last mark returns to that item
   - undo is gone after the next mark
7. **Resume:** reloading during listening, during revealed, on a round summary, and on the break prompt each restores the exact state through Keep going.
8. **Start over:** confirmation required; the old attempt shows as stopped on the progress page and is excluded from trend and best.
9. **Gate:**
   - starting another list while a session is active requires the gate
   - the parent area requires the gate
   - the gate re-locks after leaving
10. **List changes** (fixture content changes between page loads):
    - a removed current item is skipped
    - removed future items disappear
    - all items removed → friendly message
    - added items appear only in a new session
11. **Progress page:** attempts, per-round counts, missed characters, trickiest characters, and trend all match a scripted sequence of sessions.
12. **Backup:** export → erase everything → import restores an identical progress page; a malformed or newer-schema file is rejected with a message.
13. **Erase:** erasing one learner leaves other learners untouched.
14. **Saving:** a forced storage write failure shows "Couldn't save — tap to retry" and doesn't advance.
15. **Offline:** after one online load, a full session completes with the network off.
16. **Privacy:** while running the app, no request leaves the app's origin.

### Seam 2: the content pipeline (build-time)

The content build is exercised as a whole: fixture list files go in, and the outputs are the manifest, the per-list data, the audio file set, or a failure with a specific message. The TTS provider is replaced by a fake that records requests and writes placeholder audio. Scenarios:

1. Each validation rule has a failing fixture whose error names the file, item, and rule; a valid fixture passes.
2. Omitted pinyin is filled in; provided pinyin is kept.
3. The spoken prompt is right for each case: say override, clue template, and target only.
4. The polyphone phoneme markup is present in the TTS request for standalone targets.
5. Normal and slow renditions are both requested, with the configured rates.
6. A second build with unchanged content makes zero provider requests; changing one clue makes exactly two (normal + slow) for that item.
7. Prune removes unreferenced audio and keeps referenced audio.
8. A build with items needing audio and no credentials fails with a clear message.
9. The content version changes if and only if list data changes.
10. The font subset covers every character present in the content.

### Other checks

- **Prior art:** none. The repo is new, and these tests set the patterns for later practice types.
- **CI:** pull requests run typecheck, Seam 2, and Seam 1 (Seam 1 against committed or placeholder audio). Main runs all of them before deploy.
- **Manual device checklist** on real iPhone and iPad in Chrome on iOS (not automated):
  - add to home screen and launch standalone
  - airplane-mode practice
  - auto-play after marking
  - slow is audibly slower
  - the Kai font renders all list characters
  - comfortable touch targets for a child, in both orientations
  - listen to every item in List preview, especially 什, 么, 只, 分

## Out of Scope

- Handwriting input or automatic grading. The child writes on paper and self-grades.
- Accounts, login, cloud sync, or any server or database. Data is on-device only, with manual backups.
- Editing or creating lists inside the app. Lists are authored only in the repo.
- Recording custom audio, or using the browser's built-in speech voices.
- Phrase flashcards, sentence building, speech recognition, English, and math. Only the data-model shape is prepared.
- Combining several lists in one session.
- Grouping the progress page by lesson tag (the tag is stored only).
- Stickers, badges, streaks, or other rewards beyond stars, sounds, and confetti.
- Charts on the progress page (numbers only).
- A Chinese-language UI or other UI languages.
- Automatically hiding lists after their test dates.
- Taiwan Mandarin or other voices/accents (the voice is configurable, but only Mainland Xiaoxiao is in scope).

## Further Notes

- **Setup prerequisites (owner actions, outside the build):**
  - Re-authenticate the GitHub CLI for github.com with the personal account. It's currently invalid; the corporate hosts must not be used.
  - Create the public `my-practice-app` repo with Pages set to deploy from GitHub Actions.
  - Create an Azure Speech resource (Free F0 tier, eastus) under a personal Azure account.
  - Store the key in the local Keychain, and add `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` as repository secrets. Step-by-step instructions for a setup agent were already given to the owner.
- **Storage durability on iOS:** Chrome on iOS uses WebKit, so Safari-style eviction of script-writable storage can apply to sites that aren't installed. Adding the app to the home screen and making regular backups are the protections. This is why the install tip and backup nudge exist.
- **Polyphone reading** needs to be checked against Azure early. The `say` override is the fallback.
- **Assumptions:**
  - "Lesson" on the progress page means one list.
  - The school's list is simplified (the original request said traditional, but the list provided is simplified; the owner confirmed simplified).
  - The list header said 40 characters, but 37 were provided, and 37 is correct per the owner.
  - The clue words below were drafted during requirements gathering and can be edited in the list file.
- **First list to publish:** "Fall 2026 Assessment", subject Chinese, practice type dictation, script simplified, test dates 2026-10-26 to 2026-10-30. Items (target · clue · pinyin):

| # | Target | Clue | Pinyin |
|---|---|---|---|
| 1 | 找 | 找东西 | zhǎo |
| 2 | 点 | 几点 | diǎn |
| 3 | 分 | 一分钟 | fēn |
| 4 | 作 | 作业 | zuò |
| 5 | 业 | 作业 | yè |
| 6 | 半 | 一半 | bàn |
| 7 | 玩 | 好玩 | wán |
| 8 | 做 | 做饭 | zuò |
| 9 | 车 | 汽车 | chē |
| 10 | 可 | 可以 | kě |
| 11 | 以 | 可以 | yǐ |
| 12 | 买 | 买东西 | mǎi |
| 13 | 东 | 东西 | dōng |
| 14 | 西 | 东西 | xī |
| 15 | 后 | 以后 | hòu |
| 16 | 午 | 下午 | wǔ |
| 17 | 晚 | 晚上 | wǎn |
| 18 | 安 | 晚安 | ān |
| 19 | 家 | 回家 | jiā |
| 20 | 看 | 看书 | kàn |
| 21 | 书 | 看书 | shū |
| 22 | 洗 | 洗手 | xǐ |
| 23 | 想 | 想要 | xiǎng |
| 24 | 吃 | 吃饭 | chī |
| 25 | 米 | 米饭 | mǐ |
| 26 | 饭 | 米饭 | fàn |
| 27 | 面 | 面条 | miàn |
| 28 | 喝 | 喝水 | hē |
| 29 | 什 | 什么 | shén |
| 30 | 么 | 什么 | me |
| 31 | 猫 | 小猫 | māo |
| 32 | 狗 | 小狗 | gǒu |
| 33 | 今 | 今天 | jīn |
| 34 | 年 | 今年 | nián |
| 35 | 养 | 养狗 | yǎng |
| 36 | 只 | 一只鸟 | zhī |
| 37 | 鸟 | 小鸟 | niǎo |
