# A lesson holds one list per practice type

The v1 spec had one list of items shared by every practice type it allowed. Phrase recognition broke that: the Fall 2026 Assessment's phrases (早上, 薯条, …) are different things to practice from its dictation characters (找, 点, …), yet the parent and child think of both as the same lesson, assigned and tested together. So a lesson file now has one list of items per practice type (`dictation:`, `phrase-recognition:`), and the practice types a lesson offers are the lists it has. An item's identity is its target within its list, so the same text in two lists (猫 in both) is two items with separate marks.

## Considered Options

- **A separate file per practice type** that happen to share a title: fewest changes, but the parent assigns them separately and the home screen shows look-alike cards with nothing tying them together.
- **A grouping file above independent lists**: two files and two levels of assignment for what the family sees as one thing.
