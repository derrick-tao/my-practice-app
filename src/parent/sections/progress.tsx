// Parent area section: how practice is going, per lesson, for the active learner.
//   #/parent/progress                      the lessons
//   #/parent/progress/<lessonId>             header, then a part per practice type: its attempts (newest first),
//                                            first-try trend, best score and trickiest items
//   #/parent/progress/<lessonId>/<sessionId> one attempt (a session belongs to one practice type): every round,
//                                            its counts and the missed items
// A practice type without marks (Draw) has no scores: its part is the attempt count and each attempt's date, status
// and how far its one round got, and its attempt page lists that round's characters. A learning session (Say with
// the learning setting on) is the same: listed apart from the part's attempts, under 👂 Learning, and counted in
// none of its numbers.
// A math part (src/parent/math-parts.tsx) keeps the same layout, but its trickiest list is problem kinds with ❌ counts
// out of the problems of that kind, and an attempt page shows each missed problem with the answer the child entered.
// The numbers come from src/practice/progress.ts. Missed and tricky items are buttons that play the item's
// normal audio; an item the lesson's list no longer has is labeled "(removed)" and has no audio.
import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { useAppRecord, useProblemCount } from '../../app-context.tsx';
import { fetchLesson } from '../../content/client.ts';
import { isListType, isRulesType, PRACTICE_TYPE_IDS, type ItemData, type LessonData } from '../../content/types.ts';
import type { Rules } from '../../math/rules.ts';
import { formatDate } from '../../format-date.ts';
import { usePublishedLessons } from '../../content/use-lessons.ts';
import { activeProfileOf } from '../../profiles.ts';
import { useAudioPlayer, type AudioPlayer } from '../../practice/audio.ts';
import { countLabel, itemsIn, listCountsLabel, PRACTICE_TYPES, type PracticeType } from '../../practice/practice-types.tsx';
import {
  listProgress,
  type AttemptSummary,
  type ListProgress,
  type RoundSummary,
  type Score,
} from '../../practice/progress.ts';
import { missedProblems, trickiestKinds } from '../../practice/math-progress.ts';
import type { Round, Session, SessionStatus } from '../../practice/session.ts';
import { parentHref } from '../../router.ts';
import { getStorage } from '../../storage/index.ts';
import { useLoad, type Loadable } from '../../use-async.ts';
import '../progress.css';
import type { ParentSection } from '../sections.ts';
import { MissedProblems, TrickiestKinds } from '../math-parts.tsx';

const LOAD_FAILED = "Couldn't load the progress. Check the internet and try again.";

const STATUS: Record<SessionStatus, { icon: string; label: string }> = {
  completed: { icon: '✅', label: 'Completed' },
  active: { icon: '⏳', label: 'In progress' },
  stopped: { icon: '⏹️', label: 'Stopped' },
};

/** How far a round got without marks: "Characters drawn: 2 of 3", "Phrases learned: 2 of 3" (a round that never started counts as 0 of 0). */
const reachedText = (attempt: Pick<AttemptSummary, 'learning'>, round: RoundSummary | undefined): string =>
  `${attempt.learning ? 'Phrases learned' : 'Characters drawn'}: ${round?.reached ?? 0} of ${round?.itemCount ?? 0}`;

const scoreText = (score: Score | null): string => (score ? `${score.correct} of ${score.total}` : '—');

/** One practice type's part of a lesson: its list now, the learner's sessions of it, and the numbers worked out from them. */
interface Part {
  type: PracticeType;
  items: ItemData[];
  sessions: Session[];
  progress: ListProgress;
  /** A math practice type's rules in the lesson (they order its problem kinds). */
  rules?: Rules;
}

interface LessonView {
  lesson: LessonData;
  /** A part per practice type the lesson offers (or has saved sessions for), in registry order. */
  parts: Part[];
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
      const [lesson, sessions] = await Promise.all([fetchLesson(lessonId), getStorage().listSessions(profileId, { lessonId })]);
      const parts = PRACTICE_TYPE_IDS.flatMap((id): Part[] => {
        const own = sessions.filter((session) => session.practiceType === id);
        const items = (isListType(id) ? lesson.lists[id] : undefined) ?? [];
        const offered = isListType(id) ? items.length > 0 : lesson.rules?.[id] !== undefined;
        if (!offered && own.length === 0) return [];
        const rules = isListType(id) ? undefined : lesson.rules?.[id];
        return [{ type: PRACTICE_TYPES[id], items, sessions: own, progress: listProgress(own, items.map((item) => item.target)), rules }];
      });
      return { lesson, parts };
    },
    [lessonId, known, profileId],
  );
  if (published.status !== 'ready') return published;
  return loaded;
}

function PlayableItem({
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
        {attempt.learning && (
          <span class="progress-attempt__tag">
            <span aria-hidden="true">👂 </span>Learning
          </span>
        )}
        {attempt.hasMarks ? (
          <>
            <span>First try: {scoreText(attempt.firstTry)}</span>
            <span>
              {done ? 'Rounds' : 'Rounds so far'}: {attempt.roundCount}
            </span>
          </>
        ) : (
          <span>{reachedText(attempt, attempt.rounds[0])}</span>
        )}
      </a>
    </li>
  );
}

function PartProgress({ lessonId, part, player }: { lessonId: string; part: Part; player: AudioPlayer }) {
  const { type, items: listed, progress } = part;
  const problemCount = useProblemCount();
  const items = new Map(listed.map((item) => [item.target, item]));
  return (
    <section class="progress-part" data-testid={`progress-part-${type.id}`}>
      <h3 class="progress-part__title">
        <span aria-hidden="true">{type.icon} </span>
        {type.label}
      </h3>
      <div class="progress-header__facts" data-testid="progress-facts">
        <span>{countLabel(type, itemsIn(type.id, listed.length, problemCount))}</span>
        <span>Attempts: {progress.attemptCount}</span>
        {type.hasMarks && <span>Best first try: {progress.best ? scoreText(progress.best) : 'none yet'}</span>}
      </div>

      {type.hasMarks && (
        <>
          <h4 class="progress-heading">First-try trend</h4>
          <p class="progress-trend" data-testid="trend">
            {progress.trend.length > 0 ? progress.trend.join(' → ') : 'No completed attempts yet'}
          </p>
        </>
      )}

      <h4 class="progress-heading">Attempts</h4>
      {progress.attempts.length === 0 ? (
        <p class="notice">No attempts yet</p>
      ) : (
        <ul class="progress-list">
          {progress.attempts.map((attempt) => (
            <AttemptRow key={attempt.id} lessonId={lessonId} attempt={attempt} />
          ))}
        </ul>
      )}

      {progress.learningSessions.length > 0 && (
        <>
          <h4 class="progress-heading">
            <span aria-hidden="true">👂 </span>Learning
          </h4>
          <ul class="progress-list" data-testid="learning-sessions">
            {progress.learningSessions.map((attempt) => (
              <AttemptRow key={attempt.id} lessonId={lessonId} attempt={attempt} />
            ))}
          </ul>
        </>
      )}

      {isRulesType(type.id) && <TrickiestKinds tally={trickiestKinds(part.sessions, type.id, part.rules)} />}

      {type.hasMarks && !isRulesType(type.id) && progress.trickiest.length > 0 && (
        <>
          <h4 class="progress-heading">Trickiest {type.itemNoun.plural}</h4>
          <ol class="progress-list progress-tricky">
            {progress.trickiest.map(({ target, wrong }) => (
              <li key={target} class="progress-tricky__row" data-testid="tricky">
                <PlayableItem player={player} target={target} item={items.get(target)} />
                <span class="progress-tricky__count">
                  <span aria-hidden="true">❌ </span>
                  {wrong}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function LessonProgressPage({ lessonId }: { lessonId: string }) {
  const view = useLessonView(lessonId);
  const player = useAudioPlayer();
  return (
    <Page view={view}>
      {({ lesson, parts }) => (
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
            </div>
          </div>
          {parts.map((part) => (
            <PartProgress key={part.type.id} lessonId={lessonId} part={part} player={player} />
          ))}
        </>
      )}
    </Page>
  );
}

/** A round without marks (stroke order, a learning session): its size, how far it got and its items in the order they came. */
function UnmarkedRoundBlock({
  attempt,
  round,
  type,
  items,
  player,
}: {
  attempt: AttemptSummary;
  round: RoundSummary;
  type: PracticeType;
  items: Map<string, ItemData>;
  player: AudioPlayer;
}) {
  return (
    <li class="progress-round" data-testid="round">
      <div class="progress-round__facts">
        <span>{countLabel(type, round.itemCount)}</span>
        <span>{reachedText(attempt, round)}</span>
      </div>
      <div class="progress-round__missed">
        {round.itemIds.map((target) => (
          <PlayableItem key={target} player={player} target={target} item={items.get(target)} />
        ))}
      </div>
    </li>
  );
}

function RoundBlock({
  round,
  type,
  items,
  player,
  saved,
}: {
  /** The round as saved: a math round's problems and tries. */
  saved?: Round;
  round: RoundSummary;
  type: PracticeType;
  items: Map<string, ItemData>;
  player: AudioPlayer;
}) {
  return (
    <li class="progress-round" data-testid="round">
      <div class="progress-round__facts">
        <strong>Round {round.index}</strong>
        <span>{countLabel(type, round.itemCount)}</span>
        <span>✅ {round.correct}</span>
        <span>❌ {round.wrong}</span>
        {!round.finished && <span>(so far)</span>}
      </div>
      {round.missed.length > 0 && isRulesType(type.id) && saved && <MissedProblems typeId={type.id} missed={missedProblems(saved)} />}
      {round.missed.length > 0 && !(isRulesType(type.id) && saved) && (
        <div class="progress-round__missed">
          {round.missed.map((target) =>
            isRulesType(type.id) ? (
              <span key={target} class="progress-char">
                Problem {target}
              </span>
            ) : (
              <PlayableItem key={target} player={player} target={target} item={items.get(target)} />
            ),
          )}
        </div>
      )}
    </li>
  );
}

function AttemptPage({ lessonId, attemptId }: { lessonId: string; attemptId: string }) {
  const view = useLessonView(lessonId);
  const player = useAudioPlayer();
  return (
    <Page view={view}>
      {({ lesson, parts }) => {
        const part = parts.find((p) => p.sessions.some((s) => s.id === attemptId));
        const attempt = [...(part?.progress.attempts ?? []), ...(part?.progress.learningSessions ?? [])].find((a) => a.id === attemptId);
        if (!part || !attempt) return <p class="notice">We couldn't find this attempt.</p>;
        const items = new Map(part.items.map((item) => [item.target, item]));
        const status = STATUS[attempt.status];
        const savedRounds = part.sessions.find((s) => s.id === attemptId)?.rounds ?? [];
        return (
          <>
            <a class="parent__entry progress-back" href={parentHref('progress', lessonId)}>
              <span aria-hidden="true">⬅️ </span>
              {lesson.title}
            </a>
            <h2 class="progress-header__title">
              <span aria-hidden="true">{part.type.icon} </span>
              {part.type.label} ·{' '}
              {attempt.learning && (
                <>
                  <span aria-hidden="true">👂 </span>Learning ·{' '}
                </>
              )}
              {formatDate(attempt.startedAt)} · <span aria-hidden="true">{status.icon} </span>
              {status.label}
            </h2>
            {attempt.hasMarks && <p>First try: {scoreText(attempt.firstTry)}</p>}
            <ol class="progress-list">
              {attempt.rounds.map((round) =>
                attempt.hasMarks ? (
                  <RoundBlock
                    key={round.index}
                    round={round}
                    type={part.type}
                    items={items}
                    player={player}
                    saved={savedRounds.find((r) => r.index === round.index)}
                  />
                ) : (
                  <UnmarkedRoundBlock
                    key={round.index}
                    attempt={attempt}
                    round={round}
                    type={part.type}
                    items={items}
                    player={player}
                  />
                ),
              )}
            </ol>
          </>
        );
      }}
    </Page>
  );
}

function Lessons() {
  const lessons = usePublishedLessons();
  const problemCount = useProblemCount();
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
              <span> · {listCountsLabel(lesson, problemCount)}</span>
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
