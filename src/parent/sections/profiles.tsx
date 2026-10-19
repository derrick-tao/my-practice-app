// Parent area section: the learners on this device. Add, edit (name and avatar), delete (confirmed by
// typing the name) and switch the active learner. Every write goes through `useAppRecord().update`;
// a failed write leaves things as they were and says so.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { usePublishedLists } from '../../content/use-lists.ts';
import { addProfile, AVATARS, editProfile, removeProfile, setActiveProfile } from '../../profiles.ts';
import { eraseLearnerProgress } from '../../erase.ts';
import { SaveFailed } from '../../save-failed.tsx';
import { getStorage } from '../../storage/index.ts';
import type { Profile } from '../../storage/types.ts';
import { useSave } from '../../use-save.ts';
import { ListSwitches } from '../list-switches.tsx';
import { ProfileFields } from '../profile-fields.tsx';
import type { ParentSection } from '../sections.ts';

type View =
  | { name: 'list' }
  | { name: 'add' }
  | { name: 'edit'; profileId: string }
  | { name: 'delete'; profileId: string };

function Profiles() {
  const { app, update } = useAppRecord();
  const [view, setView] = useState<View>({ name: 'list' });
  /** Run one write; on success, `then` (e.g. back to the list). */
  const { busy, failed, run, clearFailed } = useSave();
  const toList = (): void => {
    clearFailed();
    setView({ name: 'list' });
  };

  const profileOf = (id: string): Profile | undefined => app.profiles.find((p) => p.id === id);

  if (view.name === 'add') {
    return (
      <AddForm
        busy={busy}
        failed={failed}
        onCancel={toList}
        onSave={(input) =>
          run(
            () =>
              update((current) =>
                addProfile(current, input, crypto.randomUUID(), new Date().toISOString()),
              ),
            toList,
          )
        }
      />
    );
  }

  if (view.name === 'edit') {
    const profile = profileOf(view.profileId);
    if (profile) {
      return (
        <EditForm
          profile={profile}
          busy={busy}
          failed={failed}
          onCancel={toList}
          onSave={(input) => run(() => update((current) => editProfile(current, profile.id, input)), toList)}
        />
      );
    }
  }

  const deleting = view.name === 'delete' ? profileOf(view.profileId) : undefined;

  return (
    <>
      <ul class="profiles">
        {app.profiles.map((profile) => {
          const active = profile.id === app.activeProfileId;
          return (
            <li key={profile.id} class="profiles__row">
              <span class="profiles__who">
                <span aria-hidden="true">{profile.avatar} </span>
                {profile.name}
                {active && <span class="profiles__tag"> (learning now)</span>}
              </span>
              {deleting?.id === profile.id ? (
                <DeleteConfirm
                  profile={profile}
                  busy={busy}
                  onCancel={toList}
                  onConfirm={() =>
                    run(async () => {
                      // Sessions first: if the second step fails the learner is still listed, so
                      // deleting again finishes the job. Never the other way round (orphaned practice).
                      await eraseLearnerProgress(getStorage(), profile.id);
                      await update((current) => removeProfile(current, profile.id));
                    }, toList)
                  }
                />
              ) : (
                <span class="profiles__actions">
                  {!active && (
                    <button
                      type="button"
                      class="btn btn--small"
                      onClick={() => void run(() => update((current) => setActiveProfile(current, profile.id)))}
                    >
                      Switch to {profile.name}
                    </button>
                  )}
                  <button type="button" class="btn btn--small" onClick={() => setView({ name: 'edit', profileId: profile.id })}>
                    Edit {profile.name}
                  </button>
                  {app.profiles.length > 1 && (
                    <button
                      type="button"
                      class="btn btn--small btn--danger"
                      onClick={() => {
                        clearFailed();
                        setView({ name: 'delete', profileId: profile.id });
                      }}
                    >
                      Delete {profile.name}
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {failed && <SaveFailed />}
      <button type="button" class="btn btn--primary" onClick={() => setView({ name: 'add' })}>
        <span aria-hidden="true">➕ </span>Add a learner
      </button>
    </>
  );
}

function DeleteConfirm({
  profile,
  busy,
  onCancel,
  onConfirm,
}: {
  profile: Profile;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === profile.name.toLowerCase();
  return (
    <div class="profiles__confirm" role="group" aria-label={`Delete ${profile.name}?`}>
      <p class="notice">
        This erases {profile.name}'s practice for good. Type <strong>{profile.name}</strong> to confirm.
      </p>
      <label class="field">
        <span class="field__label">Type {profile.name} to confirm</span>
        <input
          class="field__input"
          type="text"
          value={typed}
          autoComplete="off"
          autoCapitalize="off"
          onInput={(e) => setTyped(e.currentTarget.value)}
        />
      </label>
      <div class="row">
        <button type="button" class="btn btn--audio" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" class="btn btn--primary btn--bad" disabled={!matches || busy} onClick={onConfirm}>
          Yes, delete {profile.name}
        </button>
      </div>
    </div>
  );
}

function AddForm({
  busy,
  failed,
  onCancel,
  onSave,
}: {
  busy: boolean;
  failed: boolean;
  onCancel: () => void;
  onSave: (input: { name: string; avatar: string; assignedListIds: string[] }) => void;
}) {
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [assigned, setAssigned] = useState<ReadonlySet<string>>(new Set());
  const lists = usePublishedLists();
  return (
    <div class="first-run">
      <ProfileFields name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      {lists.status === 'ready' && (
        <>
          <p class="notice">Lists to practice:</p>
          <ListSwitches
            lists={lists.value}
            assigned={assigned}
            onToggle={(id, on) =>
              setAssigned((current) => {
                const next = new Set(current);
                if (on) next.add(id);
                else next.delete(id);
                return next;
              })
            }
          />
        </>
      )}
      {failed && <SaveFailed />}
      <FormButtons
        canSave={name.trim() !== '' && !busy}
        onCancel={onCancel}
        onSave={() => onSave({ name, avatar, assignedListIds: [...assigned] })}
      />
    </div>
  );
}

function EditForm({
  profile,
  busy,
  failed,
  onCancel,
  onSave,
}: {
  profile: Profile;
  busy: boolean;
  failed: boolean;
  onCancel: () => void;
  onSave: (input: { name: string; avatar: string }) => void;
}) {
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  return (
    <div class="first-run">
      <ProfileFields name={name} avatar={avatar} onName={setName} onAvatar={setAvatar} />
      {failed && <SaveFailed />}
      <FormButtons canSave={name.trim() !== '' && !busy} onCancel={onCancel} onSave={() => onSave({ name, avatar })} />
    </div>
  );
}

function FormButtons({ canSave, onCancel, onSave }: { canSave: boolean; onCancel: () => void; onSave: () => void }) {
  return (
    <div class="row">
      <button type="button" class="btn btn--audio" onClick={onCancel}>
        Cancel
      </button>
      <button type="button" class="btn btn--primary" disabled={!canSave} onClick={onSave}>
        <span aria-hidden="true">✅ </span>Save
      </button>
    </div>
  );
}

export const section: ParentSection = {
  id: 'profiles',
  title: 'Profiles',
  icon: '🧒',
  order: 10,
  Component: Profiles,
};
