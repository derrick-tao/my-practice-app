import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchList, fetchManifest } from '../content/client.ts';
import type { ItemData, ListData } from '../content/types.ts';
import { createAudioPlayer } from '../practice/audio.ts';
import { createRandomSource } from '../practice/random.ts';
import { openSession } from '../practice/resume.ts';
import { createSessionSync, type SyncState } from '../practice/session-sync.ts';
import {
  canRetry,
  currentItemId,
  currentRound,
  isRoundOver,
  mark,
  markCounts,
  markHeard,
  placeOf,
  reveal,
  sessionResult,
  startRetryRound,
  type Mark,
  type PracticeEnv,
  type Place,
  type Session,
} from '../practice/session.ts';
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { HOME_HREF } from '../router.ts';
import { getStorage } from '../storage/index.ts';
import { useLoad } from '../use-async.ts';

function HomeButton() {
  return (
    <a class="home-button" href={HOME_HREF}>
      <span aria-hidden="true">🏠 </span>Home
    </a>
  );
}

export function PracticeScreen({
  practiceType,
  listId,
}: {
  subject: string;
  practiceType: string;
  listId: string;
}) {
  const loaded = useLoad(
    async () => {
      const [list, manifest] = await Promise.all([fetchList(listId), fetchManifest()]);
      return { list, contentVersion: manifest.contentVersion };
    },
    [listId],
  );
  if (loaded.status === 'ready') {
    return (
      <OpenPractice
        key={listId}
        list={loaded.value.list}
        practiceType={practiceType}
        contentVersion={loaded.value.contentVersion}
      />
    );
  }
  return (
    <main class="screen">
      <HomeButton />
      <p class="notice">{loaded.status === 'loading' ? 'Loading…' : "We couldn't find this list."}</p>
    </main>
  );
}

const realEnv = (): PracticeEnv => ({
  random: createRandomSource(),
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
});

function SaveFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" class="save-failed">
      <button type="button" class="btn btn--primary btn--bad" onClick={onRetry}>
        <span aria-hidden="true">⚠️ </span>Couldn't save — tap to retry
      </button>
    </div>
  );
}

/** Continues the saved session for this list, or starts and saves a new one, before showing practice. */
function OpenPractice({
  list,
  practiceType,
  contentVersion,
}: {
  list: ListData;
  practiceType: string;
  contentVersion: string;
}) {
  const env = useMemo(realEnv, []);
  const [attempt, setAttempt] = useState(0);
  const opened = useLoad(
    // Shuffle is on by default; the setting to turn it off arrives with ticket 08.
    () => openSession(getStorage(), list, { practiceType, contentVersion, shuffle: true }, env),
    [attempt],
  );
  if (opened.status === 'ready') {
    return <PracticeRun list={list} env={env} initial={opened.value.session} resumed={opened.value.resumed} />;
  }
  return (
    <main class="screen">
      <HomeButton />
      {opened.status === 'loading' ? (
        <p class="notice">Loading…</p>
      ) : (
        <SaveFailed onRetry={() => setAttempt((n) => n + 1)} />
      )}
    </main>
  );
}

function PracticeRun({
  list,
  env,
  initial,
  resumed,
}: {
  list: ListData;
  env: PracticeEnv;
  initial: Session;
  /** Continuing saved progress: audio must wait for the child's tap (iOS gesture rules). */
  resumed: boolean;
}) {
  const player = useMemo(createAudioPlayer, []);
  const itemsById = useMemo(() => new Map(list.items.map((item) => [item.target, item])), [list]);

  // What is shown is always what is saved: every change goes through `sync`, which saves it first.
  const [view, setView] = useState<SyncState>({ session: initial, saveFailed: false });
  const sync = useMemo(() => createSessionSync(getStorage(), initial, setView), []);
  useEffect(() => () => sync.detach(), []);
  const { session, saveFailed } = view;
  /** Auto-play for this place was rejected by the browser: the Listen button pulses. */
  const [blockedAt, setBlockedAt] = useState<Place | null>(null);

  const round = currentRound(session);
  const itemId = currentItemId(round);
  const item = itemId === undefined ? undefined : itemsById.get(itemId);

  /**
   * Request audio for the item at `place`; once playback starts the heard flag is saved (dropped if
   * the learner has moved on by then).
   */
  const requestAudio = (target: ItemData, rendition: 'normal' | 'slow', autoplay: boolean, place: Place): void => {
    void player.play(target.audio[rendition]).then((started) => {
      if (started) {
        setBlockedAt(null);
        sync.dispatch((s) => markHeard(s, place));
      } else if (autoplay) {
        setBlockedAt(place);
      }
    });
  };

  // First item of a new session: auto-play on arrival (not when resuming).
  useEffect(() => {
    if (item && !resumed) requestAudio(item, 'normal', true, placeOf(session));
  }, []);

  // Preload the current item's audio and the next item's.
  useEffect(() => {
    const upcoming = [round.itemIds[round.position], round.itemIds[round.position + 1]]
      .map((id) => (id === undefined ? undefined : itemsById.get(id)))
      .filter((x): x is ItemData => x !== undefined);
    player.preload(upcoming.flatMap((x) => [x.audio.normal, x.audio.slow]));
  }, [round.index, round.position]);

  /**
   * Run a step that moves the learner on. It is ignored while a save is running or has failed, so a
   * quick double tap cannot act twice. Returns the session it will show once saved.
   */
  const advance = (step: (from: Session) => Session): Session | undefined => {
    if (sync.busy()) return undefined;
    const before = sync.state().session;
    const after = step(before);
    if (after === before) return undefined;
    sync.dispatch((s) => (s === before ? after : s));
    return after;
  };

  /** Auto-play the current item of `after` from inside the tap handler, so iOS allows the audio. */
  const autoplayCurrent = (after: Session): void => {
    const id = currentItemId(currentRound(after));
    const next = id === undefined ? undefined : itemsById.get(id);
    if (next) requestAudio(next, 'normal', true, placeOf(after));
  };

  const onCheck = (): void => void advance(reveal);

  const onMark = (result: Mark): void => {
    const after = advance((s) => mark(s, result, env));
    if (after) autoplayCurrent(after);
  };

  const onRetry = (): void => {
    const after = advance((s) => startRetryRound(s, env));
    if (!after) return;
    setBlockedAt(null);
    autoplayCurrent(after);
  };

  if (session.status === 'completed') {
    return (
      <main class="screen practice">
        <h1 class="sr-only">{list.title}</h1>
        <Completion {...sessionResult(session)} />
      </main>
    );
  }

  const place = placeOf(session);
  const pulse = blockedAt?.roundIndex === place.roundIndex && blockedAt.position === place.position;

  return (
    <main class="screen practice">
      <header class="practice__top">
        <HomeButton />
        <RoundBadge index={round.index} />
        <StarBar done={round.position} total={round.itemIds.length} />
      </header>
      {saveFailed && <SaveFailed onRetry={sync.retry} />}
      <h1 class="sr-only">{list.title}</h1>
      {item && !isRoundOver(round) && (
        <section class="practice__body">
          <div class="practice__stage">
            {round.phase === 'revealed' ? (
              <Reveal item={item} />
            ) : (
              <p class="prompt">
                <span aria-hidden="true">✏️ </span>Write it!
              </p>
            )}
          </div>
          <div class="practice__controls">
            <div class="row">
              <button
                type="button"
                class={`btn btn--audio${pulse ? ' pulse' : ''}`}
                onClick={() => requestAudio(item, 'normal', false, place)}
              >
                <span aria-hidden="true">🔊 </span>Listen
              </button>
              <button
                type="button"
                class="btn btn--audio"
                onClick={() => requestAudio(item, 'slow', false, place)}
              >
                <span aria-hidden="true">🐢 </span>Slow
              </button>
            </div>
            <div class="row row--primary">
              {round.phase === 'listening' && round.heardCurrent && (
                <button type="button" class="btn btn--primary btn--check" onClick={onCheck}>
                  <span aria-hidden="true">👀 </span>Check
                </button>
              )}
              {round.phase === 'revealed' && (
                <>
                  <button type="button" class="btn btn--primary btn--good" onClick={() => onMark('correct')}>
                    <span aria-hidden="true">✅ </span>I got it
                  </button>
                  <button type="button" class="btn btn--primary btn--bad" onClick={() => onMark('wrong')}>
                    <span aria-hidden="true">❌ </span>Not yet
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}
      {isRoundOver(round) && (
        <RoundSummary {...markCounts(round)} onRetry={canRetry(session) ? onRetry : undefined} />
      )}
    </main>
  );
}

function RoundSummary({
  correct,
  wrong,
  onRetry,
}: {
  correct: number;
  wrong: number;
  onRetry?: () => void;
}) {
  return (
    <section class="summary" data-testid="round-summary">
      <div class="summary__counts">
        <span class="count count--good">
          <span aria-hidden="true">✅ </span>
          <span data-testid="correct-count">{correct}</span>
        </span>
        <span class="count count--bad">
          <span aria-hidden="true">❌ </span>
          <span data-testid="wrong-count">{wrong}</span>
        </span>
      </div>
      {wrong > 0 && onRetry && (
        <>
          <p class="summary__more">Let's practice {wrong} more!</p>
          <button type="button" class="btn btn--primary btn--retry" onClick={onRetry}>
            <span aria-hidden="true">🔁 </span>Practice the ❌ words
          </button>
        </>
      )}
    </section>
  );
}

function Completion({ firstTryCorrect, total, rounds }: { firstTryCorrect: number; total: number; rounds: number }) {
  return (
    <section class="summary completion" data-testid="completion">
      <p class="completion__title">
        <span aria-hidden="true">🎉 </span>You did it!
      </p>
      <p class="completion__line">
        {firstTryCorrect} of {total} on the first try!
      </p>
      <p class="completion__line">Rounds: {rounds}</p>
      <HomeButton />
    </section>
  );
}

function Reveal({ item }: { item: ItemData }) {
  return (
    <div class="reveal">
      <div
        class="reveal__target"
        data-testid="target"
        lang="zh-CN"
        style={{ '--scale': Math.max(1, [...item.target].length / 2) }}
      >
        {item.target}
      </div>
      <div class="reveal__pinyin">{item.pinyin}</div>
      {item.clue && <div class="reveal__clue">{item.clue}</div>}
    </div>
  );
}
