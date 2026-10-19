// Parent area section: how practice is going, per lesson, for the active learner.
//   #/parent/progress                      the lessons
//   #/parent/progress/<lessonId>             header, attempts (newest first), trickiest characters, first-try trend
//   #/parent/progress/<lessonId>/<sessionId> one attempt: every round, its counts and the missed characters
// The numbers come from src/practice/progress.ts. Missed and tricky characters are buttons that play the
// character's normal audio; a character the lesson's list no longer has is labeled "(removed)" and has no audio.
import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { fetchLesson } from '../../content/client.ts';
import type { ItemData, LessonData } from '../../content/types.ts';
import { formatDate } from '../../format-date.ts';
import { itemCountOf, usePublishedLessons } from '../../content/use-lessons.ts';
import { activeProfileOf } from '../../profiles.ts';
import { createAudioPlayer, type AudioPlayer } from '../../practice/audio.ts';
import {
  lessonProgress,
  type AttemptSummary,
  type LessonProgress,
  type RoundSummary,
  type Score,
} from '../../practice/progress.ts';
import type { Session, SessionStatus } from '../../practice/session.ts';
import { parentHref } from '../../router.ts';
import { getStorage } from '../../storage/index.ts';
import { useLoad, type Loadable } from '../../use-async.ts';
import '../progress.css';
import type { ParentSection } from '../sections.ts';

const LOAD_FAILED = "Couldn't load the progress. Check the internet and try again.";

const STATUS: Record<SessionStatus, { icon: string; label: string }> = {
  completed: { icon: '✅', label: 'Completed' },
  active: { icon: '⏳', label: 'In progress' },
  stopped: { icon: '⏹️', label: 'Stopped' },
};

const characters = (count: number): string => `${count} ${count === 1 ? 'character' : 'characters'}`;

const scoreText = (score: Score | null): string => (score ? `${score.correct} of ${score.total}` : '—');

interface LessonView {
  lesson: LessonData;
  /** The lesson's dictation list (the only practice type so far). */
  items: ItemData[];
  sessions: Session[];
  progress: LessonProgress;
}

/** The lesson, the active learner's saved attempts at it, and the numbers worked out from them. */
function useLessonView(lessonId: string): Loadable<LessonView | 'unknown'> {
  const { app } = useAppRecord();
  const profileId = activeProfileOf(app)?.id;
  const published = usePublishedLessons();
  const known = published.status === 'ready' && published.value.some((p) => p.lesson.id === lessonId);
  const loaded = useLoad(
    async (): Promise<LessonView | 'unknown'> => {
      if (!known || profileId === undefined) return 'unknown';
      const [lesson, sessions] = await Promise.all([
        fetchLesson(lessonId),
        getStorage().listSessions(profileId, { lessonId, practiceType: 'dictation' }),
      ]);
      const items = lesson.lists.dictation ?? [];
      return { lesson, items, sessions, progress: lessonProgress(sessions, items.map((item) => item.target)) };
    },
    [lessonId, known, profileId],
  );
  if (published.status !== 'ready') return published;
  return loaded;
}

function PlayableCharacter({
  player,
  target,
  item,
}: {
  player: AudioPlayer;
  target: string;
  item: ItemData | undefined;
}) {
  if (!item) {
    return (
      <span class="progress-char progress-char--removed">
        <span class="progress-char__glyph" lang="zh-Hans">
          {target}
        </span>{' '}
        <span class="progress-char__note">(removed)</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      class="progress-char progress-char__button"
      aria-label={`Hear ${target}`}
      onClick={() => void player.play(item.audio.normal)}
    >
      <span class="progress-char__glyph" lang="zh-Hans" aria-hidden="true">
        {target}
      </span>
    </button>
  );
}

function Who() {
  const profile = activeProfileOf(useAppRecord().app);
  return profile ? (
    <p class="progress-who">
      Progress for <span aria-hidden="true">{profile.avatar} </span>
      {profile.name}
    </p>
  ) : null;
}

function Page({
  view,
  children,
}: {
  view: Loadable<LessonView | 'unknown'>;
  children: (v: LessonView) => ComponentChildren;
}) {
  if (view.status === 'loading') return <p class="notice">Loading…</p>;
  if (view.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  if (view.value === 'unknown') return <p class="notice">We couldn't find this lesson.</p>;
  return <>{children(view.value)}</>;
}

function AttemptRow({ lessonId, attempt }: { lessonId: string; attempt: AttemptSummary }) {
  const status = STATUS[attempt.status];
  const done = attempt.status === 'completed';
  return (
    <li>
      <a class="progress-attempt" data-testid="attempt" href={parentHref('progress', lessonId, attempt.id)}>
        <span class="progress-attempt__date">{formatDate(attempt.startedAt)}</span>
        <span class="progress-attempt__status">
          <span aria-hidden="true">{status.icon} </span>
          {status.label}
        </span>
        <span>First try: {scoreText(attempt.firstTry)}</span>
        <span>
          {done ? 'Rounds' : 'Rounds so far'}: {attempt.roundCount}
        </span>
      </a>
    </li>
  );
}

function LessonProgressPage({ lessonId }: { lessonId: string }) {
  const view = useLessonView(lessonId);
  const player = useMemo(createAudioPlayer, []);
  return (
    <Page view={view}>
      {({ lesson, items: listed, progress }) => {
        const items = new Map(listed.map((item) => [item.target, item]));
        return (
          <>
            <Who />
            <div class="progress-header" data-testid="progress-header">
              <h2 class="progress-header__title">{lesson.title}</h2>
              <div class="progress-header__facts">
                {lesson.testDates && (
                  <span>
                    <span aria-hidden="true">📅 </span>Test: {lesson.testDates}
                  </span>
                )}
                <span>{characters(listed.length)}</span>
                <span>Attempts: {progress.attemptCount}</span>
                <span>Best first try: {progress.best ? scoreText(progress.best) : 'none yet'}</span>
              </div>
            </div>

            <h3 class="progress-heading">First-try trend</h3>
            <p class="progress-trend" data-testid="trend">
              {progress.trend.length > 0 ? progress.trend.join(' → ') : 'No completed attempts yet'}
            </p>

            <h3 class="progress-heading">Attempts</h3>
            {progress.attempts.length === 0 ? (
              <p class="notice">No attempts yet</p>
            ) : (
              <ul class="progress-list">
                {progress.attempts.map((attempt) => (
                  <AttemptRow key={attempt.id} lessonId={lessonId} attempt={attempt} />
                ))}
              </ul>
            )}

            {progress.trickiest.length > 0 && (
              <>
                <h3 class="progress-heading">Trickiest characters</h3>
                <ol class="progress-list progress-tricky">
                  {progress.trickiest.map(({ target, wrong }) => (
                    <li key={target} class="progress-tricky__row" data-testid="tricky">
                      <PlayableCharacter player={player} target={target} item={items.get(target)} />
                      <span class="progress-tricky__count">
                        <span aria-hidden="true">❌ </span>
                        {wrong}
                      </span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        );
      }}
    </Page>
  );
}

function RoundBlock({ round, items, player }: { round: RoundSummary; items: Map<string, ItemData>; player: AudioPlayer }) {
  return (
    <li class="progress-round" data-testid="round">
      <div class="progress-round__facts">
        <strong>Round {round.index}</strong>
        <span>{characters(round.itemCount)}</span>
        <span>✅ {round.correct}</span>
        <span>❌ {round.wrong}</span>
        {!round.finished && <span>(so far)</span>}
      </div>
      {round.missed.length > 0 && (
        <div class="progress-round__missed">
          {round.missed.map((target) => (
            <PlayableCharacter key={target} player={player} target={target} item={items.get(target)} />
          ))}
        </div>
      )}
    </li>
  );
}

function AttemptPage({ lessonId, attemptId }: { lessonId: string; attemptId: string }) {
  const view = useLessonView(lessonId);
  const player = useMemo(createAudioPlayer, []);
  return (
    <Page view={view}>
      {({ lesson, items: listed, sessions, progress }) => {
        const attempt = progress.attempts.find((a) => a.id === attemptId);
        if (!attempt || !sessions.some((s) => s.id === attemptId)) {
          return <p class="notice">We couldn't find this attempt.</p>;
        }
        const items = new Map(listed.map((item) => [item.target, item]));
        const status = STATUS[attempt.status];
        return (
          <>
            <a class="parent__entry progress-back" href={parentHref('progress', lessonId)}>
              <span aria-hidden="true">⬅️ </span>
              {lesson.title}
            </a>
            <h2 class="progress-header__title">
              {formatDate(attempt.startedAt)} · <span aria-hidden="true">{status.icon} </span>
              {status.label}
            </h2>
            <p>First try: {scoreText(attempt.firstTry)}</p>
            <ol class="progress-list">
              {attempt.rounds.map((round) => (
                <RoundBlock key={round.index} round={round} items={items} player={player} />
              ))}
            </ol>
          </>
        );
      }}
    </Page>
  );
}

function Lessons() {
  const lessons = usePublishedLessons();
  if (lessons.status === 'loading') return <p class="notice">Loading…</p>;
  if (lessons.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  return (
    <>
      <Who />
      <ul class="progress-list">
        {lessons.value.map(({ lesson }) => (
          <li key={lesson.id}>
            <a class="parent__entry" href={parentHref('progress', lesson.id)}>
              {lesson.title}
              <span> · {characters(itemCountOf(lesson, 'dictation'))}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProgressSection({ path }: { path: string[] }) {
  const [lessonId, attemptId] = path;
  if (lessonId === undefined) return <Lessons />;
  if (attemptId === undefined) return <LessonProgressPage lessonId={lessonId} />;
  return <AttemptPage lessonId={lessonId} attemptId={attemptId} />;
}

export const section: ParentSection = {
  id: 'progress',
  title: 'Progress',
  icon: '📈',
  order: 40,
  Component: ProgressSection,
};
