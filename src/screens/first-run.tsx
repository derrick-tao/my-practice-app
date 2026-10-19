// First run: "Ask a grown-up" -> parent gate -> create the learner profile -> assign lists -> home.
// Nothing is saved until the last step, so quitting half way leaves the device as it was.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../app-context.tsx';
import { usePublishedLists } from '../content/use-lists.ts';
import { ParentGate } from '../parent/gate.tsx';
import { ListSwitches } from '../parent/list-switches.tsx';
import { ProfileFields } from '../parent/profile-fields.tsx';
import { addProfile, AVATARS } from '../profiles.ts';

type Step = 'welcome' | 'gate' | 'profile' | 'lists';

export function FirstRun() {
  const [step, setStep] = useState<Step>('welcome');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [assigned, setAssigned] = useState<ReadonlySet<string>>(new Set());

  switch (step) {
    case 'welcome':
      return (
        <main class="screen first-run">
          <h1 class="first-run__hello">Hi! Ask a grown-up to set up 👋</h1>
          <button type="button" class="btn btn--primary" onClick={() => setStep('gate')}>
            <span aria-hidden="true">🔒 </span>I'm a grown-up
          </button>
        </main>
      );
    case 'gate':
      return (
        <main class="screen first-run">
          <ParentGate onPassed={() => setStep('profile')} />
        </main>
      );
    case 'profile':
      return (
        <ProfileStep
          name={name}
          avatar={avatar}
          onName={setName}
          onAvatar={setAvatar}
          onNext={() => setStep('lists')}
        />
      );
    case 'lists':
      return (
        <ListsStep
          name={name.trim()}
          avatar={avatar}
          assigned={assigned}
          onToggle={(id, on) =>
            setAssigned((current) => {
              const next = new Set(current);
              if (on) next.add(id);
              else next.delete(id);
              return next;
            })
          }
          onBack={() => setStep('profile')}
        />
      );
  }
}

function ProfileStep(props: {
  name: string;
  avatar: string;
  onName: (name: string) => void;
  onAvatar: (avatar: string) => void;
  onNext: () => void;
}) {
  const ready = props.name.trim() !== '';
  return (
    <main class="screen first-run">
      <h1 class="screen__title">Who is learning?</h1>
      <ProfileFields name={props.name} avatar={props.avatar} onName={props.onName} onAvatar={props.onAvatar} />
      <button type="button" class="btn btn--primary" disabled={!ready} onClick={props.onNext}>
        Next<span aria-hidden="true"> ➡️</span>
      </button>
    </main>
  );
}

function ListsStep(props: {
  name: string;
  avatar: string;
  assigned: ReadonlySet<string>;
  onToggle: (listId: string, on: boolean) => void;
  onBack: () => void;
}) {
  const { update } = useAppRecord();
  const lists = usePublishedLists();
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const done = async (): Promise<void> => {
    if (saving) return;
    setSaving(true);
    setSaveFailed(false);
    try {
      await update((current) =>
        addProfile(
          current,
          { name: props.name, avatar: props.avatar, assignedListIds: [...props.assigned] },
          crypto.randomUUID(),
          new Date().toISOString(),
        ),
      );
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  };

  // A list is needed to practice: finishing with none picked would leave the child an empty home.
  const needsPick = lists.status === 'ready' && lists.value.length > 0 && props.assigned.size === 0;
  return (
    <main class="screen first-run">
      <h1 class="screen__title">
        {props.avatar} {props.name}'s lists
      </h1>
      <p class="notice">Pick the lists to practice.</p>
      {lists.status === 'loading' && <p class="notice">Loading…</p>}
      {lists.status === 'error' && <p class="notice">Couldn't load the lists. Check the internet and try again.</p>}
      {lists.status === 'ready' && (
        <ListSwitches lists={lists.value} assigned={props.assigned} onToggle={props.onToggle} />
      )}
      {saveFailed && (
        <div role="alert" class="save-failed">
          <span aria-hidden="true">⚠️ </span>Couldn't save — tap Done to retry
        </div>
      )}
      <div class="row">
        <button type="button" class="btn btn--audio" onClick={props.onBack}>
          <span aria-hidden="true">⬅️ </span>Back
        </button>
        <button type="button" class="btn btn--primary" disabled={needsPick || saving} onClick={() => void done()}>
          <span aria-hidden="true">✅ </span>Done
        </button>
      </div>
    </main>
  );
}
