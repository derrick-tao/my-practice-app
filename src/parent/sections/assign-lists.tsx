// Parent area section: which published lists the active learner sees on their home screen.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { usePublishedLists } from '../../content/use-lists.ts';
import { activeProfileOf, setListAssigned } from '../../profiles.ts';
import { SaveFailed } from '../../save-failed.tsx';
import { ListSwitches } from '../list-switches.tsx';
import type { ParentSection } from '../sections.ts';

interface Change {
  listId: string;
  on: boolean;
}

function AssignLists() {
  const { app, update } = useAppRecord();
  const lists = usePublishedLists();
  const profile = activeProfileOf(app);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<Change | null>(null);

  if (!profile) return null;

  const save = async (change: Change): Promise<void> => {
    setFailed(null);
    setSaving((s) => new Set(s).add(change.listId));
    try {
      await update((current) => setListAssigned(current, profile.id, change.listId, change.on));
    } catch {
      setFailed(change);
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(change.listId);
        return next;
      });
    }
  };

  return (
    <>
      <p class="notice">
        Lists {profile.avatar} {profile.name} can practice:
      </p>
      {lists.status === 'loading' && <p class="notice">Loading…</p>}
      {lists.status === 'error' && <p class="notice">Couldn't load the lists. Check the internet and try again.</p>}
      {lists.status === 'ready' && (
        <ListSwitches
          lists={lists.value}
          assigned={new Set(profile.assignedListIds)}
          busy={saving}
          onToggle={(listId, on) => void save({ listId, on })}
        />
      )}
      {failed && <SaveFailed onRetry={() => void save(failed)} />}
    </>
  );
}

export const section: ParentSection = {
  id: 'assign-lists',
  title: 'Assign lists',
  icon: '📚',
  order: 20,
  Component: AssignLists,
};
