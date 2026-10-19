// Parent area section: back up everything to a file, restore from one, and see how safe the data is.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import {
  backupAge,
  backupFileName,
  checkBackup,
  createBackup,
  dataToRestore,
  describeBackupAge,
  formatDate,
  summarizeBackup,
  type BackupFile,
  type BackupSummary,
} from '../../backup/backup-file.ts';
import { saveBackupFile } from '../../backup/save-file.ts';
import { fetchManifest } from '../../content/client.ts';
import { NewerSchemaError, getStorage } from '../../storage/index.ts';
import type { PersistenceStatus } from '../../storage/types.ts';
import { useLoad } from '../../use-async.ts';
import { APP_VERSION } from '../../version.ts';
import type { ParentSection } from '../sections.ts';
import './backup.css';

type ImportState =
  | { step: 'idle' }
  | { step: 'rejected'; message: string }
  | { step: 'confirm'; backup: BackupFile; summary: BackupSummary; failed: boolean }
  | { step: 'restoring'; backup: BackupFile; summary: BackupSummary }
  | { step: 'done' };

function describePersistence(status: PersistenceStatus | undefined): string {
  if (!status) return 'Persistent storage: not asked yet';
  return status.granted
    ? "Persistent storage: on (the browser keeps this app's data)"
    : 'Persistent storage: off. Add the app to the home screen and keep making backups.';
}

function Status() {
  const { app } = useAppRecord();
  const persistence = useLoad(() => getStorage().getPersistence(), []);
  const manifest = useLoad(fetchManifest, []);
  const age = backupAge(app.parent.lastBackupAt, new Date());
  return (
    <section class="backup__card" aria-labelledby="backup-status">
      <h2 id="backup-status">Status</h2>
      <p data-testid="last-backup">
        Last backup: {describeBackupAge(age)}
        {age.nudge && (
          <span class="backup__nudge" data-testid="backup-nudge">
            <span aria-hidden="true">⏰ </span>Time for a backup
          </span>
        )}
      </p>
      <p data-testid="persistence">
        {persistence.status === 'ready' ? describePersistence(persistence.value) : 'Persistent storage: checking…'}
      </p>
      <p data-testid="app-version">App version: {APP_VERSION}</p>
      <p data-testid="content-version">
        Content version: {manifest.status === 'ready' ? manifest.value.contentVersion : 'unknown'}
      </p>
    </section>
  );
}

function Export() {
  const { update } = useAppRecord();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const run = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      const now = new Date();
      const data = await getStorage().exportAll();
      const result = await saveBackupFile(backupFileName(now), JSON.stringify(createBackup(data, now), null, 2));
      if (result === 'saved') {
        await update((app) => ({ ...app, parent: { ...app.parent, lastBackupAt: now.toISOString() } }));
      }
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="backup__card" aria-labelledby="backup-export">
      <h2 id="backup-export">Export</h2>
      <p>Saves every learner and all their practice to one file. Keep it somewhere safe, like Files or iCloud Drive.</p>
      <button type="button" class="btn btn--primary" disabled={busy} onClick={() => void run()}>
        <span aria-hidden="true">📤 </span>Export a backup
      </button>
      {failed && (
        <p role="alert" class="backup__problem">
          Couldn't make the backup. Try again.
        </p>
      )}
    </section>
  );
}

function Import() {
  const { reload } = useAppRecord();
  const [state, setState] = useState<ImportState>({ step: 'idle' });

  const choose = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // so choosing the same file again still counts
    if (!file) return;
    let text: string;
    try {
      text = await file.text();
    } catch {
      setState({ step: 'rejected', message: "That file couldn't be read, so nothing was changed." });
      return;
    }
    const checked = checkBackup(text);
    setState(
      checked.ok
        ? { step: 'confirm', backup: checked.backup, summary: summarizeBackup(checked.backup), failed: false }
        : { step: 'rejected', message: checked.message },
    );
  };

  const restore = async (backup: BackupFile, summary: BackupSummary): Promise<void> => {
    setState({ step: 'restoring', backup, summary });
    try {
      await getStorage().importAll(dataToRestore(backup));
      await reload();
      setState({ step: 'done' });
    } catch (error) {
      if (error instanceof NewerSchemaError) {
        setState({ step: 'rejected', message: 'That backup was made by a newer version of this app, so nothing was changed.' });
      } else {
        setState({ step: 'confirm', backup, summary, failed: true });
      }
    }
  };

  return (
    <section class="backup__card" aria-labelledby="backup-import">
      <h2 id="backup-import">Import</h2>
      <p>Replaces everything on this device with the contents of a backup file.</p>
      <label class="btn btn--primary backup__choose">
        <span aria-hidden="true">📥 </span>Import a backup
        <input type="file" accept="application/json,.json" class="sr-only" onChange={(e) => void choose(e)} />
      </label>

      {state.step === 'rejected' && (
        <p role="alert" class="backup__problem">
          {state.message}
        </p>
      )}
      {(state.step === 'confirm' || state.step === 'restoring') && (
        <div class="backup__summary" data-testid="import-summary">
          <h3>This backup has</h3>
          <dl>
            <dt>Learners</dt>
            <dd data-testid="import-learners">{state.summary.learners}</dd>
            <dt>Attempts</dt>
            <dd data-testid="import-attempts">{state.summary.attempts}</dd>
            <dt>Last used</dt>
            <dd data-testid="import-last-used">
              {state.summary.lastUsed ? formatDate(state.summary.lastUsed) : 'never'}
            </dd>
            <dt>Backed up</dt>
            <dd data-testid="import-exported">{formatDate(state.summary.exportedAt)}</dd>
          </dl>
          <p>Importing replaces all learners and practice on this device.</p>
          {state.step === 'confirm' && state.failed && (
            <p role="alert" class="backup__problem">
              Couldn't restore the backup. Nothing was changed. Try again.
            </p>
          )}
          <div class="backup__actions">
            <button
              type="button"
              class="btn btn--primary btn--bad"
              disabled={state.step === 'restoring'}
              onClick={() => void restore(state.backup, state.summary)}
            >
              Replace everything on this device
            </button>
            <button
              type="button"
              class="btn"
              disabled={state.step === 'restoring'}
              onClick={() => setState({ step: 'idle' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {state.step === 'done' && (
        <p role="status" class="backup__done">
          <span aria-hidden="true">✅ </span>Backup restored
        </p>
      )}
    </section>
  );
}

function Backup() {
  return (
    <>
      <Status />
      <Export />
      <Import />
    </>
  );
}

export const section: ParentSection = {
  id: 'backup',
  title: 'Backup',
  icon: '💾',
  order: 60,
  Component: Backup,
};
