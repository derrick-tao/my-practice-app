# 16: Privacy guardrails

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** Guarantees that learner data never leaves the device or lands in the public repo.
- **Commit check:** an optional pre-commit hook, plus a matching check script, scans committed content against a local-only, gitignored denylist (e.g. the child's name). It blocks the commit when there's a match. The check passes silently when no denylist exists (as in CI).
- **No outside requests:** a Seam 1 test runs the app through a full flow and asserts that no network request leaves the app's own origin. That rules out analytics, third-party fonts, and CDNs.

**Blocked by:** 01

**Status:** resolved

- [ ] With a local denylist containing a test name, committing a file containing it is blocked with a message naming the file; without a denylist, commits proceed
- [ ] The denylist file is gitignored and never committed
- [ ] Seam 1: across first run, practice, and the parent area, every request goes to the app's own origin
- [ ] The README explains how to set up the local denylist

## Comments

- 2026-10-18 (coordinator): Resolved on `dictation-v1` (merge 35e65bf, review fixes 4033da1).
