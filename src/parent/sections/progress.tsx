// Parent area section: how practice is going, per list, for the active learner.
//   #/parent/progress                      the lists
//   #/parent/progress/<listId>             header, attempts (newest first), trickiest characters, first-try trend
//   #/parent/progress/<listId>/<sessionId> one attempt: every round, its counts and the missed characters
// The numbers come from src/practice/progress.ts. Missed and tricky characters are buttons that play the
// character's normal audio; a character the list no longer has is labeled "(removed)" and has no audio.
import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { fetchList } from '../../content/client.ts';
import type { ItemData, ListData } from '../../content/types.ts';
import { usePublishedLists } from '../../content/use-lists.ts';
import { activeProfileOf } from '../../profiles.ts';
import { createAudioPlayer, type AudioPlayer } from '../../practice/audio.ts';
import {
  listProgress,
  type AttemptSummary,
  type ListProgress,
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

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const scoreText = (score: Score | null): string => (score ? `${score.correct} of ${score.total}` : '—');

interface ListView {
  list: ListData;
  sessions: Session[];
  progress: ListProgress;
}

/** The list, the active learner's saved attempts at it, and the numbers worked out from them. */
function useListView(listId: string): Loadable<ListView | 'unknown'> {
  const { app } = useAppRecord();
  const profileId = activeProfileOf(app)?.id;
  const published = usePublishedLists();
  const known = published.status === 'ready' && published.value.some((p) => p.list.id === listId);
  const loaded = useLoad(
    async (): Promise<ListView | 'unknown'> => {
      if (!known || profileId === undefined) return 'unknown';
      const [list, sessions] = await Promise.all([
        fetchList(listId),
        getStorage().listSessions(profileId, { listId }),
      ]);
      const ids = list.items.map((item) => item.target);
      return { list, sessions, progress: listProgress(sessions, ids) };
    },
    [listId, known, profileId],
  );
  if (published.status !== 'ready') return published;
  return loaded;
}

function PlayableCharacter({
  player,
  id,
  item,
}: {
  player: AudioPlayer;
  id: string;
  item: ItemData | undefined;
}) {
  if (!item) {
    return (
      <span class="progress-char progress-char--removed">
        <span class="progress-char__glyph" lang="zh-Hans">
          {id}
        </span>{' '}
        <span class="progress-char__note">(removed)</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      class="progress-char progress-char__button"
      aria-label={`Hear ${id}`}
      onClick={() => void player.play(item.audio.normal)}
    >
      <span class="progress-char__glyph" lang="zh-Hans" aria-hidden="true">
        {id}
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

function Page({ view, children }: { view: Loadable<ListView | 'unknown'>; children: (v: ListView) => ComponentChildren }) {
  if (view.status === 'loading') return <p class="notice">Loading…</p>;
  if (view.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  if (view.value === 'unknown') return <p class="notice">We couldn't find this list.</p>;
  return <>{children(view.value)}</>;
}

function AttemptRow({ listId, attempt }: { listId: string; attempt: AttemptSummary }) {
  const status = STATUS[attempt.status];
  const done = attempt.status === 'completed';
  return (
    <li>
      <a class="progress-attempt" data-testid="attempt" href={parentHref('progress', listId, attempt.id)}>
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

function ListProgressPage({ listId }: { listId: string }) {
  const view = useListView(listId);
  const player = useMemo(createAudioPlayer, []);
  return (
    <Page view={view}>
      {({ list, progress }) => {
        const items = new Map(list.items.map((item) => [item.target, item]));
        return (
          <>
            <Who />
            <div class="progress-header" data-testid="progress-header">
              <h2 class="progress-header__title">{list.title}</h2>
              <div class="progress-header__facts">
                {list.testDates && (
                  <span>
                    <span aria-hidden="true">📅 </span>Test: {list.testDates}
                  </span>
                )}
                <span>{characters(list.items.length)}</span>
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
                  <AttemptRow key={attempt.id} listId={listId} attempt={attempt} />
                ))}
              </ul>
            )}

            {progress.trickiest.length > 0 && (
              <>
                <h3 class="progress-heading">Trickiest characters</h3>
                <ol class="progress-list progress-tricky">
                  {progress.trickiest.map(({ id, wrong }) => (
                    <li key={id} class="progress-tricky__row" data-testid="tricky">
                      <PlayableCharacter player={player} id={id} item={items.get(id)} />
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
          {round.missed.map((id) => (
            <PlayableCharacter key={id} player={player} id={id} item={items.get(id)} />
          ))}
        </div>
      )}
    </li>
  );
}

function AttemptPage({ listId, attemptId }: { listId: string; attemptId: string }) {
  const view = useListView(listId);
  const player = useMemo(createAudioPlayer, []);
  return (
    <Page view={view}>
      {({ list, sessions, progress }) => {
        const attempt = progress.attempts.find((a) => a.id === attemptId);
        if (!attempt || !sessions.some((s) => s.id === attemptId)) {
          return <p class="notice">We couldn't find this attempt.</p>;
        }
        const items = new Map(list.items.map((item) => [item.target, item]));
        const status = STATUS[attempt.status];
        return (
          <>
            <a class="parent__entry progress-back" href={parentHref('progress', listId)}>
              <span aria-hidden="true">⬅️ </span>
              {list.title}
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

function Lists() {
  const lists = usePublishedLists();
  if (lists.status === 'loading') return <p class="notice">Loading…</p>;
  if (lists.status === 'error') return <p class="notice">{LOAD_FAILED}</p>;
  return (
    <>
      <Who />
      <ul class="progress-list">
        {lists.value.map(({ list }) => (
          <li key={list.id}>
            <a class="parent__entry" href={parentHref('progress', list.id)}>
              {list.title}
              <span> · {characters(list.itemCount)}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function ProgressSection({ path }: { path: string[] }) {
  const [listId, attemptId] = path;
  if (listId === undefined) return <Lists />;
  if (attemptId === undefined) return <ListProgressPage listId={listId} />;
  return <AttemptPage listId={listId} attemptId={attemptId} />;
}

export const section: ParentSection = {
  id: 'progress',
  title: 'Progress',
  icon: '📈',
  order: 40,
  Component: ProgressSection,
};
