# Learning is a profile setting on phrase recognition, not a practice type

The pre-K learner can't yet say most phrases from memory, so self-grading them means nothing. They need to see and hear each phrase and tap Next until they know them, and then move on to graded Say with the same phrases. Stroke order (Draw) already shows that a practice type can have no marks, so "Learn" could have been a fourth practice type. Instead it is a learning setting on the profile. While it is on, that learner's new phrase recognition sessions are learning sessions: still one Say button and one list, with each session saved as learning or graded. The thing that changes is the learner's stage, not the lesson's content. A setting lets the parent move one child on with a single switch, leaves other profiles alone, and never asks a 4-year-old to pick between two look-alike buttons.

## Considered Options

- **A Learn practice type with its own list**: the lesson YAML would repeat every phrase under `learn:`, and the two copies would drift apart.
- **A Learn practice type that reads the phrase recognition list**: this breaks ADR 0001 (the practice types a lesson offers are the lists it has), and every learner with a Say list would see a Learn button too, older children included.

## Consequences

Whether a session has marks is decided per session, not per practice type: phrase recognition has both kinds, so Progress, the break count and completion check each session. The setting only applies to sessions started after it changes; a session in progress stays the kind it started as.
