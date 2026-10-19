import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

// Learner data must never be committed: a backup file saved next to the code (exported on a laptop, say)
// is ignored by git, whatever the date in its name.
describe('backup files and git', () => {
  it.each(['my-practice-app-backup-2026-10-18.json', 'downloads/my-practice-app-backup-2027-01-02.json', 'backup.json'])(
    'ignores %s',
    (file) => {
      const result = spawnSync('git', ['check-ignore', '--quiet', '--no-index', file]);
      expect(result.status, `${file} should be matched by .gitignore`).toBe(0);
    },
  );
});
