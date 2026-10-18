# 08: Settings and multiple profiles

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** In the parent area, per-profile **Settings**:
- shuffle round 1 on/off (default on; retry rounds always shuffle)
- break every Off / 5 / 10 / 15 (default 10)
- sounds on/off (default on; it controls sound effects only, and character audio always plays)

A **Profiles** section lets the parent add more learners, edit name and avatar, delete a profile (confirmed by typing its name), and switch the active profile. When more than one profile exists, the child home screen shows a row of avatar buttons to switch. Each profile has its own assigned lists, settings, sessions, and Keep going card.

**Blocked by:** 06, 07

**Status:** ready-for-agent

- [ ] Seam 1: shuffle off → round 1 follows list order; retry rounds are still reordered
- [ ] Break every 5 → prompt after 5 marks; Off → no prompt
- [ ] The sounds setting is saved and exposed to the sound-effects player (effects arrive in 15)
- [ ] Two profiles: each keeps separate assigned lists, settings, and an in-progress session; switching via avatar shows the right Keep going card
- [ ] Deleting a profile requires typing its name and removes only that profile's data
- [ ] With a single profile, no avatar switcher row is shown
