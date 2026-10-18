# 13: Backup export and import

**Parent spec:** `.scratch/dictation-v1/spec.md`

**What to build:** In the parent area, a **Backup** section.
- **Export:** saves all profiles and sessions to a JSON backup file named with the export date. The file contains an app identifier, a kind marker, the schema version, an export timestamp, and the data. Export goes through the iOS share sheet (Web Share API with a file: Save to Files, AirDrop), falling back to a download.
- **Import:** validates the file and shows a summary (learners, attempts, last used). After confirmation it **replaces** all local data; the last-backup timestamp comes from the file. Malformed files and files from a newer schema are rejected with a clear message.
- **Status:** the section shows "Last backup: N days ago" (with a nudge badge after 7 days), the persistent-storage status from 05, and the app and content versions.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Seam 1: export → erase everything → import → the home screen, Keep going state, and progress data are identical to before
- [ ] The import summary shows correct counts before confirming; cancelling leaves local data unchanged
- [ ] A malformed file and a newer-schema file are each rejected with a message, with no data change
- [ ] "Last backup" updates after export; the nudge badge appears when the last backup is more than 7 days old (time controlled in test)
- [ ] Persistent-storage status and app/content versions are displayed
- [ ] Backup files are never written into the repo (gitignore already covers them)
