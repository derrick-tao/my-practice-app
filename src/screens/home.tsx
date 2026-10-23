import { useState } from 'preact/hooks';
import { useAppRecord, useProblemCount } from '../app-context.tsx';
import { ConfirmYesNo } from '../confirm.tsx';
import type { LessonSummary } from '../content/types.ts';
import { usePublishedLessons } from '../content/use-lessons.ts';
import { countLabel, itemsIn, PRACTICE_TYPES, subjectLabel } from '../practice/practice-types.tsx';
import { findSessionsInProgress, stopSession } from '../practice/resume.ts';
import { currentRound, type Session } from '../practice/session.ts';
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { activeProfileOf, setActiveProfile } from '../profiles.ts';
import { useUpdateReady } from '../pwa/service-worker.ts';
import { UpdateDot } from '../pwa/update-dot.tsx';
import { lessonHref, parentHref } from '../router.ts';
import { getStorage } from '../storage/index.ts';
import { useLoad } from '../use-async.ts';
import { SaveFailed } from '../save-failed.tsx';
import { useSave } from '../use-save.ts';

/**
 * A practice type with a session in progress: its button says Keep going, with the round and stars in place of
 * the count, and opens the same route as ever, so the learner lands exactly where they stopped. The 🔄 beside it,
 * after a confirmation, stops only that session and opens the list afresh.
 */
function KeepGoingButton({ session, lesson }: { session: Session; lesson: LessonSummary }) {
  const round = currentRound(session);
  const href = lessonHref(session.subject, session.practiceType, session.lessonId);
  const type = PRACTICE_TYPES[session.practiceType];
  const [asking, setAsking] = useState(false);
  const { busy: saving, failed, run } = useSave();

  // Yes: this session is stopped (kept in history) and saved, and no other; opening the list then starts a
  // fresh, freshly ordered one, exactly like tapping the button with nothing in progress.
  const startOver = (): Promise<void> =>
    run(
      () => stopSession(getStorage(), session),
      () => void (location.hash = href),
    );

  return (
    <>
      <div class="lesson-card__row">
        <a class="lesson-card__button lesson-card__button--keep-going" href={href}>
          <span>
            <span aria-hidden="true">{type.icon} </span>
            {type.label} · <span aria-hidden="true">▶️ </span>Keep going
          </span>
          <span class="lesson-card__progress">
            <RoundBadge index={round.index} />
            <StarBar done={round.position} total={round.itemIds.length} />
          </span>
          <span class="sr-only"> for {lesson.title}</span>
        </a>
        <button type="button" class="btn lesson-card__restart" onClick={() => setAsking(true)}>
          <span aria-hidden="true">🔄</span>
          <span class="sr-only">Start over {type.label}</span>
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

/**
 * A lesson's card: its title and test dates, and a big button for each practice type it offers, with its count,
 * or Keep going where a session is in progress (`inProgress`: this lesson's). A session of a type the lesson no
 * longer offers keeps its button too, so opening it can settle it.
 */
function LessonCard({ subject, lesson, inProgress }: { subject: string; lesson: LessonSummary; inProgress: Session[] }) {
  const problemCount = useProblemCount();
  const offered = new Set<string>(lesson.practiceTypes.map(({ id }) => id));
  return (
    <section class="lesson-card" role="group" aria-label={lesson.title}>
      <span class="lesson-card__title">{lesson.title}</span>
      <span class="lesson-card__subject" data-testid="subject-tag">
        {subjectLabel(subject)}
      </span>
      {lesson.testDates && (
        <span class="lesson-card__meta">
          <span aria-hidden="true">📅 </span>Test: {lesson.testDates}
        </span>
      )}
      {lesson.practiceTypes.map(({ id, itemCount }) => {
        const session = inProgress.find((s) => s.practiceType === id);
        if (session) return <KeepGoingButton key={id} session={session} lesson={lesson} />;
        const type = PRACTICE_TYPES[id];
        return (
          <a key={id} class="lesson-card__button" href={lessonHref(subject, id, lesson.id)}>
            <span aria-hidden="true">{type.icon} </span>
            {type.label} · {countLabel(type, itemsIn(id, itemCount, problemCount))}
            <span class="sr-only"> for {lesson.title}</span>
          </a>
        );
      })}
      {inProgress
        .filter((session) => !offered.has(session.practiceType))
        .map((session) => (
          <KeepGoingButton key={session.id} session={session} lesson={lesson} />
        ))}
    </section>
  );
}

/** The profile's sessions in progress, most recently used first. Home still works when saved sessions can't be read. */
async function loadResume(): Promise<Session[]> {
  try {
    return await findSessionsInProgress(getStorage());
  } catch {
    return [];
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
  const sessions = resume.status === 'ready' ? resume.value : [];
  // Per device, not per learner: a waiting update is told to the grown-up by a dot on the gear, never to the child.
  const updateWaiting = useUpdateReady();
  const all = published.status === 'ready' ? published.value : [];
  const assigned = new Set(profile.assignedLessonIds);
  const shown = all.filter(({ lesson }) => assigned.has(lesson.id));
  return (
    <main class="screen">
      <header class="home__top">
        <h1 class="screen__title">
          Hi {profile.avatar} {profile.name}!
        </h1>
        <a class="gear" href={parentHref()} aria-label={updateWaiting ? 'Parent area, update waiting' : 'Parent area'}>
          <span aria-hidden="true">⚙️</span>
          {updateWaiting && <UpdateDot />}
        </a>
      </header>
      <ProfileSwitcher />
      {published.status === 'loading' && <p class="notice">Loading…</p>}
      {published.status === 'error' && <p class="notice">Couldn't load the lessons. Check the internet and try again.</p>}
      {published.status === 'ready' && shown.length === 0 && (
        <p class="notice">No lessons yet. Ask a grown-up to pick some!</p>
      )}
      {shown.length > 0 && (
        <section class="cards">
          {shown.map(({ subject, lesson }) => (
            <LessonCard
              key={lesson.id}
              subject={subject}
              lesson={lesson}
              inProgress={sessions.filter((session) => session.lessonId === lesson.id)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
