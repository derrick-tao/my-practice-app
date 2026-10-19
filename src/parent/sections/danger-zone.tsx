// Parent area section: erase one learner's progress, or everything on the device. Nothing here takes a
// single tap: each erase asks twice, and erasing everything also needs ERASE typed.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { eraseEverything, eraseLearnerProgress } from '../../erase.ts';
import { activeProfileOf } from '../../profiles.ts';
import { HOME_HREF } from '../../router.ts';
import { getStorage } from '../../storage/index.ts';
import { useSave } from '../../use-save.ts';
import type { ParentSection } from '../sections.ts';

const CONFIRM_WORD = 'ERASE';

/** Which erase is being confirmed, and how far along. A learner is held by id so the erase hits the one that was asked about. */
type Flow =
  | { kind: 'none' }
  | { kind: 'learner'; step: 1 | 2; profileId: string; name: string }
  | { kind: 'everything'; step: 1 | 2 };

function DangerZone() {
  const { app, reload } = useAppRecord();
  const profile = activeProfileOf(app);
  const [flow, setFlow] = useState<Flow>({ kind: 'none' });
  const [typed, setTyped] = useState('');
  const { busy, failed, run, clearFailed } = useSave();
  const [erasedName, setErasedName] = useState<string | null>(null);

  const reset = (): void => {
    setFlow({ kind: 'none' });
    setTyped('');
    clearFailed();
  };

  const eraseLearner = (profileId: string, name: string): Promise<void> =>
    run(
      () => eraseLearnerProgress(getStorage(), profileId),
      () => {
        reset();
        setErasedName(name);
      },
    );

  const eraseAll = (): Promise<void> =>
    run(
      () => eraseEverything(getStorage()),
      async () => {
        // The app record is now empty: reloading it shows first run.
        location.hash = HOME_HREF;
        await reload();
      },
    );

  return (
    <div class="danger">
      {failed && (
        <p role="alert" class="notice">
          Couldn't erase. Nothing was changed. Please try again.
        </p>
      )}
      {erasedName !== null && flow.kind === 'none' && (
        <p role="status" class="danger__done">
          {erasedName}'s progress was erased.
        </p>
      )}

      {flow.kind === 'none' && (
        <>
          {profile && (
            <button
              type="button"
              class="btn btn--bad"
              onClick={() => {
                setErasedName(null);
                setFlow({ kind: 'learner', step: 1, profileId: profile.id, name: profile.name });
              }}
            >
              <span aria-hidden="true">🧹 </span>Erase all progress
            </button>
          )}
          <button
            type="button"
            class="btn btn--bad"
            onClick={() => {
              setErasedName(null);
              setFlow({ kind: 'everything', step: 1 });
            }}
          >
            <span aria-hidden="true">🗑️ </span>Erase everything on this device
          </button>
        </>
      )}

      {flow.kind === 'learner' && flow.step === 1 && (
        <section class="danger__panel" aria-labelledby="danger-title">
          <h2 id="danger-title">Erase all of {flow.name}'s progress?</h2>
          <p>Every practice {flow.name} has done is deleted. The profile and its settings stay.</p>
          <Choices
            confirm="Yes, continue"
            busy={busy}
            onConfirm={() => setFlow({ ...flow, step: 2 })}
            onCancel={reset}
          />
        </section>
      )}
      {flow.kind === 'learner' && flow.step === 2 && (
        <section class="danger__panel" aria-labelledby="danger-title">
          <h2 id="danger-title">Really erase everything {flow.name} has practiced?</h2>
          <p>This cannot be undone.</p>
          <Choices
            confirm="Yes, erase"
            busy={busy}
            onConfirm={() => void eraseLearner(flow.profileId, flow.name)}
            onCancel={reset}
          />
        </section>
      )}

      {flow.kind === 'everything' && flow.step === 1 && (
        <section class="danger__panel" aria-labelledby="danger-title">
          <h2 id="danger-title">Erase everything on this device?</h2>
          <p>All learners, their progress and their settings are deleted. The app goes back to first-time set-up.</p>
          <Choices
            confirm="Yes, continue"
            busy={busy}
            onConfirm={() => setFlow({ kind: 'everything', step: 2 })}
            onCancel={reset}
          />
        </section>
      )}
      {flow.kind === 'everything' && flow.step === 2 && (
        <section class="danger__panel" aria-labelledby="danger-title">
          <h2 id="danger-title">Really erase everything?</h2>
          <p>This cannot be undone. A backup file you exported earlier is the only way back.</p>
          <label>
            Type {CONFIRM_WORD} to confirm
            <br />
            <input
              class="danger__input"
              type="text"
              value={typed}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              spellcheck={false}
              onInput={(event) => setTyped(event.currentTarget.value)}
            />
          </label>
          <Choices
            confirm="Erase it all"
            busy={busy}
            disabled={typed !== CONFIRM_WORD}
            onConfirm={() => void eraseAll()}
            onCancel={reset}
          />
        </section>
      )}
    </div>
  );
}

function Choices({
  confirm,
  busy,
  disabled = false,
  onConfirm,
  onCancel,
}: {
  confirm: string;
  busy: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div class="row">
      <button type="button" class="btn btn--bad" disabled={busy || disabled} onClick={onConfirm}>
        {confirm}
      </button>
      <button type="button" class="btn" disabled={busy} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export const section: ParentSection = {
  id: 'danger-zone',
  title: 'Danger zone',
  icon: '⚠️',
  order: 70,
  Component: DangerZone,
};
