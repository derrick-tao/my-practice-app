// Parent area section: which published lessons the active learner sees on their home screen.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { usePublishedLessons } from '../../content/use-lessons.ts';
import { activeProfileOf, setLessonAssigned } from '../../profiles.ts';
import { SaveFailed } from '../../save-failed.tsx';
import { LessonSwitches } from '../lesson-switches.tsx';
import type { ParentSection } from '../sections.ts';

interface Change {
  lessonId: string;
  on: boolean;
}

function AssignLessons() {
  const { app, update } = useAppRecord();
  const lessons = usePublishedLessons();
  const profile = activeProfileOf(app);
  const [saving, setSaving] = useState<ReadonlySet<string>>(new Set());
  const [failed, setFailed] = useState<Change | null>(null);

  if (!profile) return null;

  const save = async (change: Change): Promise<void> => {
    setFailed(null);
    setSaving((s) => new Set(s).add(change.lessonId));
    try {
      await update((current) => setLessonAssigned(current, profile.id, change.lessonId, change.on));
    } catch {
      setFailed(change);
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(change.lessonId);
        return next;
      });
    }
  };

  return (
    <>
      <p class="notice">
        Lessons {profile.avatar} {profile.name} can practice:
      </p>
      {lessons.status === 'loading' && <p class="notice">Loading…</p>}
      {lessons.status === 'error' && <p class="notice">Couldn't load the lessons. Check the internet and try again.</p>}
      {lessons.status === 'ready' && (
        <LessonSwitches
          lessons={lessons.value}
          assigned={new Set(profile.assignedLessonIds)}
          busy={saving}
          onToggle={(lessonId, on) => void save({ lessonId, on })}
        />
      )}
      {failed && <SaveFailed onRetry={() => void save(failed)} />}
    </>
  );
}

export const section: ParentSection = {
  id: 'assign-lessons',
  title: 'Assign lessons',
  icon: '📚',
  order: 20,
  Component: AssignLessons,
};
