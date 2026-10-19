import { useState } from 'preact/hooks';
import { useAppRecord } from '../app-context.tsx';
import { ConfirmYesNo } from '../confirm.tsx';
import type { LessonSummary } from '../content/types.ts';
import { usePublishedLessons } from '../content/use-lessons.ts';
import { findActiveSession, stopSession } from '../practice/resume.ts';
import { currentRound, type Session } from '../practice/session.ts';
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { activeProfileOf, setActiveProfile } from '../profiles.ts';
import { applyUpdate, useUpdateReady } from '../pwa/service-worker.ts';
import { hasPracticeScreen, lessonHref, parentHref } from '../router.ts';
import { getStorage } from '../storage/index.ts';
import { useLoad } from '../use-async.ts';
import { SaveFailed } from '../save-failed.tsx';
import { useSave } from '../use-save.ts';

/** A lesson's card opens its first practice type that has a screen (dictation is the only one so far). */
function LessonCard({ subject, lesson }: { subject: string; lesson: LessonSummary }) {
  const first = lesson.practiceTypes.find((type) => hasPracticeScreen(type.id));
  if (!first) return null;
  return (
    <a class="lesson-card" href={lessonHref(subject, first.id, lesson.id)}>
      <span class="lesson-card__title">{lesson.title}</span>
      {lesson.testDates && (
        <span class="lesson-card__meta">
          <span aria-hidden="true">📅 </span>Test: {lesson.testDates}
        </span>
      )}
      <span class="lesson-card__meta">
        <span aria-hidden="true">✏️ </span>
        {first.itemCount} {first.itemCount === 1 ? 'character' : 'characters'}
      </span>
    </a>
  );
}

/** Resume the active session exactly where it was left, or (after a confirmation) start it over. */
function KeepGoingCard({ session, lesson }: { session: Session; lesson: LessonSummary }) {
  const round = currentRound(session);
  const href = lessonHref(session.subject, session.practiceType, session.lessonId);
  const [asking, setAsking] = useState(false);
  const { busy: saving, failed, run } = useSave();

  // Yes: the current session is stopped (kept in history) and saved; opening the lesson then starts a
  // fresh, freshly ordered one, exactly like tapping the lesson's card with nothing in progress.
  const startOver = (): Promise<void> =>
    run(
      () => stopSession(getStorage(), session),
      () => void (location.hash = href),
    );

  return (
    <>
      <div class="keep-going-card">
        <a class="keep-going" href={href}>
          <span class="keep-going__label">
            <span aria-hidden="true">▶️ </span>Keep going
          </span>
          <span class="keep-going__title">{lesson.title}</span>
          <span class="keep-going__progress">
            <RoundBadge index={round.index} />
            <StarBar done={round.position} total={round.itemIds.length} />
          </span>
        </a>
        <button type="button" class="btn keep-going-card__restart" onClick={() => setAsking(true)}>
          <span aria-hidden="true">🔄</span>
          <span class="sr-only">Start over</span>
        </button>
      </div>
      {asking && !failed && (
        <ConfirmYesNo
          question="Start again from the beginning?"
          busy={saving}
          onYes={() => void startOver()}
          onNo={() => setAsking(false)}
        />
      )}
      {failed && <SaveFailed onRetry={() => void startOver()} />}
    </>
  );
}

/** The profile's active session, if any. Home still works when saved sessions can't be read. */
async function loadResume(): Promise<Session | undefined> {
  try {
    return await findActiveSession(getStorage());
  } catch {
    return undefined;
  }
}

/** Avatar buttons to switch learner: only shown when several learners share the device. */
function ProfileSwitcher() {
  const { app, update } = useAppRecord();
  const active = activeProfileOf(app);
  if (app.profiles.length < 2) return null;
  return (
    <div class="profile-switcher" role="group" aria-label="Who is practicing?">
      {app.profiles.map((p) => (
        <button
          type="button"
          key={p.id}
          class="profile-switcher__button"
          aria-label={p.name}
          aria-pressed={p.id === active?.id}
          onClick={() => void update((current) => setActiveProfile(current, p.id)).catch(() => undefined)}
        >
          <span aria-hidden="true">{p.avatar}</span>
        </button>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const { app } = useAppRecord();
  const profile = activeProfileOf(app)!;
  const published = usePublishedLessons();
  // Each learner has their own practice in progress: look again whenever the learner changes.
  const resume = useLoad(loadResume, [profile.id]);
  const updateReady = useUpdateReady();
  const session = resume.status === 'ready' ? resume.value : undefined;
  const all = published.status === 'ready' ? published.value : [];
  const assigned = new Set(profile.assignedLessonIds);
  const shown = all.filter(({ lesson }) => assigned.has(lesson.id));
  // The practice in progress stays reachable even when its lesson has since been unassigned.
  const resumeLesson = session && all.find(({ lesson }) => lesson.id === session.lessonId)?.lesson;
  return (
    <main class="screen">
      <header class="home__top">
        <h1 class="screen__title">
          Hi {profile.avatar} {profile.name}!
        </h1>
        <a class="gear" href={parentHref()} aria-label="Parent area">
          <span aria-hidden="true">⚙️</span>
        </a>
      </header>
      <ProfileSwitcher />
      {updateReady && (
        <button type="button" class="update-banner" onClick={applyUpdate}>
          New words are ready! <span aria-hidden="true">🔄</span>
        </button>
      )}
      {published.status === 'loading' && <p class="notice">Loading…</p>}
      {published.status === 'error' && <p class="notice">Couldn't load the lessons. Check the internet and try again.</p>}
      {session && resumeLesson && <KeepGoingCard session={session} lesson={resumeLesson} />}
      {published.status === 'ready' && shown.length === 0 && !resumeLesson && (
        <p class="notice">No lessons yet. Ask a grown-up to pick some!</p>
      )}
      {shown.length > 0 && (
        <section class="cards">
          {shown.map(({ subject, lesson }) => (
            <LessonCard key={lesson.id} subject={subject} lesson={lesson} />
          ))}
        </section>
      )}
    </main>
  );
}
