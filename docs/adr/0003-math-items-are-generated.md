# Math items are generated: a new problem each session and round

Chinese lists are written by hand and self-graded, and an item is its target text. Math is different: the school sends standards (1.OA.1–1.OA.8), not a list, and a fixed set of equations would be memorized rather than solved. So a math lesson holds no items. For each practice type it holds small rules (the numbers to stay within, the operations), and each session makes items from them (10, 15 or 20, the learner's problems per practice setting), spread across the type's problem kinds. The app checks the answer and shows the right one after a second wrong try, so a ❌ item comes back in the next round as a new problem of the same kind: repeating the shown problem would test memory.

Math is its own lesson (subject `math`) even when its test falls in the same week as a Chinese lesson. ADR-0001 kept a lesson's practice types together because the family sees them as one test; a different subject is a different test, and a lesson belongs to one subject throughout (its folder, its address, its sessions).

## Considered Options

- **Hand-written math lists**, like Chinese: matches the existing content pipeline, but the problems repeat every session and would be learned by heart.
- **Retrying the same problem in later rounds**: keeps an item as its text, as in Chinese, but by then the learner has seen the answer.
- **Math as more practice types inside the Chinese lesson**: one card on Home, but it would take the subject off the lesson and move it onto each practice type, changing addresses and saved sessions.

## Consequences

A math item is one of the session's numbered spots (as many as the setting gave it when the session started), not its text, so a round saves the problem for each spot (kind and numbers) and each try's answer, and the screen renders from that; resuming is exact. The session keeps its rules, so a retry round can make new problems of the same kind even if the lesson changes. Saved data moved to schema v5, additively: Chinese sessions and older backups import unchanged. The problems per practice setting then moved it to v6, also additively: profile settings gained the count (existing profiles get 20), and a session needs no change because its size is the number of spots it already holds.
