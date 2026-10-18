import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fetchList, fetchManifest } from '../content/client.ts';
import type { ItemData, ListData } from '../content/types.ts';
import { createAudioPlayer } from '../practice/audio.ts';
import { createRandomSource } from '../practice/random.ts';
import {
  createSession,
  currentItemId,
  currentRound,
  isRoundOver,
  mark,
  markCounts,
  markHeard,
  placeOf,
  reveal,
  type Mark,
  type PracticeEnv,
  type Place,
  type Session,
} from '../practice/session.ts';
import { HOME_HREF } from '../router.ts';
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
      <PracticeRun
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

function StarBar({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div class="starbar">
      <div
        class="starbar__track"
        role="progressbar"
        aria-label="Progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div class="starbar__fill" style={{ width: `${percent}%` }} />
      </div>
      <span class="starbar__star" aria-hidden="true">
        ⭐
      </span>
      <span class="starbar__text" data-testid="progress-text">
        {done} / {total}
      </span>
    </div>
  );
}

function PracticeRun({
  list,
  practiceType,
  contentVersion,
}: {
  list: ListData;
  practiceType: string;
  contentVersion: string;
}) {
  const env = useMemo(realEnv, []);
  const player = useMemo(createAudioPlayer, []);
  const itemsById = useMemo(() => new Map(list.items.map((item) => [item.target, item])), [list]);

  const [session, setSessionState] = useState<Session>(() =>
    // Shuffle is on by default; the setting to turn it off arrives with ticket 08.
    createSession(list, { practiceType, contentVersion, shuffle: true }, env),
  );
  // Handlers read the latest session from the ref so a quick double tap cannot act on stale state.
  const latest = useRef(session);
  const setSession = (next: Session): void => {
    latest.current = next;
    setSessionState(next);
  };
  /** Auto-play for this place was rejected by the browser: the Listen button pulses. */
  const [blockedAt, setBlockedAt] = useState<Place | null>(null);

  const round = currentRound(session);
  const itemId = currentItemId(round);
  const item = itemId === undefined ? undefined : itemsById.get(itemId);

  /** Request audio for the item at the current place; the heard flag is set once playback starts. */
  const requestAudio = (target: ItemData, rendition: 'normal' | 'slow', autoplay: boolean): void => {
    const place = placeOf(latest.current);
    void player.play(target.audio[rendition]).then((started) => {
      if (started) {
        setBlockedAt(null);
        setSession(markHeard(latest.current, place));
      } else if (autoplay) {
        setBlockedAt(place);
      }
    });
  };

  // First item of a new session: auto-play on arrival.
  useEffect(() => {
    if (item) requestAudio(item, 'normal', true);
  }, []);

  // Preload the current item's audio and the next item's.
  useEffect(() => {
    const upcoming = [round.itemIds[round.position], round.itemIds[round.position + 1]]
      .map((id) => (id === undefined ? undefined : itemsById.get(id)))
      .filter((x): x is ItemData => x !== undefined);
    player.preload(upcoming.flatMap((x) => [x.audio.normal, x.audio.slow]));
  }, [round.index, round.position]);

  const onCheck = (): void => setSession(reveal(latest.current));

  const onMark = (result: Mark): void => {
    const before = latest.current;
    const after = mark(before, result, env);
    if (after === before) return;
    setSession(after);
    // Auto-play the next item from inside this tap handler so iOS allows the audio.
    const nextRound = currentRound(after);
    const nextId = currentItemId(nextRound);
    const next = nextId === undefined ? undefined : itemsById.get(nextId);
    if (next) requestAudio(next, 'normal', true);
  };

  const place = placeOf(session);
  const pulse = blockedAt?.roundIndex === place.roundIndex && blockedAt.position === place.position;

  return (
    <main class="screen practice">
      <header class="practice__top">
        <HomeButton />
        <StarBar done={round.position} total={round.itemIds.length} />
      </header>
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
                onClick={() => requestAudio(item, 'normal', false)}
              >
                <span aria-hidden="true">🔊 </span>Listen
              </button>
              <button type="button" class="btn btn--audio" onClick={() => requestAudio(item, 'slow', false)}>
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
      {isRoundOver(round) && <RoundSummary {...markCounts(round)} />}
    </main>
  );
}

function RoundSummary({ correct, wrong }: { correct: number; wrong: number }) {
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
