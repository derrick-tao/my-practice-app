import { useEffect, useMemo, useState } from 'preact/hooks';
import { fetchList, fetchManifest } from '../content/client.ts';
import type { ItemData, ListData, PracticeTypeId, Rendition } from '../content/types.ts';
import { createAudioPlayer } from '../practice/audio.ts';
import { createEffects } from '../practice/effects.ts';
import { loadKaiFont } from '../practice/kai-font.ts';
import { createRandomSource } from '../practice/random.ts';
import { currentSettings, openSession } from '../practice/resume.ts';
import { createSessionSync, type SyncState } from '../practice/session-sync.ts';
import {
  breakDue,
  canRetry,
  canUndo,
  currentItemId,
  currentRound,
  isRoundOver,
  mark,
  markCounts,
  markHeard,
  placeOf,
  reconcileWithList,
  resetBreakCount,
  reveal,
  sessionResult,
  startRetryRound,
  undo,
  wrongItemIds,
  type Mark,
  type PracticeEnv,
  type Place,
  type Session,
} from '../practice/session.ts';
import { ConfirmYesNo } from '../confirm.tsx';
import { ParentGate } from '../parent/gate.tsx';
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

/** The address named no list we have (unknown list, or a subject / practice type it does not belong to). */
export function ListNotFound() {
  return (
    <main class="screen">
      <HomeButton />
      <p class="notice">We couldn't find this list.</p>
    </main>
  );
}

export function PracticeScreen({
  subject,
  practiceType,
  listId,
}: {
  subject: string;
  practiceType: PracticeTypeId;
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
    const { list } = loaded.value;
    // Checked before anything is opened, so a wrong address can never stop the saved practice.
    if (list.subject !== subject || !list.practiceTypes.includes(practiceType)) return <ListNotFound />;
    return (
      <OpenPractice
        key={listId}
        list={list}
        practiceType={practiceType}
        contentVersion={loaded.value.contentVersion}
      />
    );
  }
  if (loaded.status === 'error') return <ListNotFound />;
  return (
    <main class="screen">
      <HomeButton />
      <p class="notice">Loading…</p>
    </main>
  );
}

const realEnv = (): PracticeEnv => ({
  random: createRandomSource(),
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
});

export function SaveFailed({ onRetry }: { onRetry: () => void }) {
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
  practiceType: PracticeTypeId;
  contentVersion: string;
}) {
  const env = useMemo(realEnv, []);
  const [openTries, setOpenTries] = useState(0);
  // Another list's practice is active: the child confirms, then a grown-up passes the gate, before it is stopped.
  const [stopStep, setStopStep] = useState<'ask' | 'gate' | 'done'>('ask');
  const stopActive = stopStep === 'done';
  const opened = useLoad(
    async () => {
      const storage = getStorage();
      const { breakEvery, shuffle, sounds } = await currentSettings(storage);
      const result = await openSession(storage, list, { practiceType, contentVersion, shuffle, stopActive }, env);
      return 'blockedBy' in result ? result : { ...result, breakEvery, sounds };
    },
    [openTries, stopActive],
  );
  if (opened.status === 'ready' && 'blockedBy' in opened.value) {
    return (
      <main class="screen">
        <HomeButton />
        {stopStep === 'gate' ? (
          // A one-off check: it lets this practice be stopped and does not unlock the parent area.
          <ParentGate onPassed={() => setStopStep('done')} />
        ) : (
          <ConfirmYesNo
            question="Stop your current practice?"
            onYes={() => setStopStep('gate')}
            onNo={() => void (location.hash = HOME_HREF)}
          />
        )}
      </main>
    );
  }
  if (opened.status === 'ready') {
    const { session, resumed, breakEvery, sounds } = opened.value as Exclude<typeof opened.value, { blockedBy: unknown }>;
    return <PracticeRun list={list} env={env} initial={session} resumed={resumed} breakEvery={breakEvery} sounds={sounds} />;
  }
  return (
    <main class="screen">
      <HomeButton />
      {opened.status === 'loading' ? (
        <p class="notice">Loading…</p>
      ) : (
        <SaveFailed onRetry={() => setOpenTries((n) => n + 1)} />
      )}
    </main>
  );
}

function PracticeRun({
  list,
  env,
  initial,
  resumed,
  breakEvery,
  sounds,
}: {
  list: ListData;
  env: PracticeEnv;
  initial: Session;
  /** Continuing saved progress: audio must wait for the child's tap (iOS gesture rules). */
  resumed: boolean;
  /** Offer a break every this many marks; 0 is off (the profile's setting). */
  breakEvery: number;
  /** Play sound effects on ✅, ❌ and finishing (the profile's setting). Character audio ignores it. */
  sounds: boolean;
}) {
  const player = useMemo(createAudioPlayer, []);
  const effects = useMemo(() => createEffects(sounds), []);
  const itemsById = useMemo(() => new Map(list.items.map((item) => [item.target, item])), [list]);
  const listedIds = useMemo(() => new Set(itemsById.keys()), [itemsById]);

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
   * Request audio for the item at `place`. The heard flag (which unlocks Check) is saved (dropped if the
   * learner has moved on by then):
   *  - for a tap, as soon as it is requested, even if play() then fails, so missing or undecodable
   *    audio never strands the child;
   *  - for auto-play, only once playback actually starts, so a browser-blocked auto-play does not.
   */
  const requestAudio = (target: ItemData, rendition: Rendition, autoplay: boolean, place: Place): void => {
    if (!autoplay) sync.dispatch((s) => markHeard(s, place));
    void player.play(target.audio[rendition]).then((started) => {
      if (started) {
        setBlockedAt(null);
        if (autoplay) sync.dispatch((s) => markHeard(s, place));
      } else if (autoplay) {
        setBlockedAt(place);
      }
    });
  };

  // The handwriting font is fetched as practice opens, so it is ready by the first reveal.
  useEffect(() => void loadKaiFont(), []);

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
   * quick double tap cannot act twice. Items no longer in the list are skipped over, so the child is
   * never stuck on one. Returns the session it will show once saved.
   */
  const advance = (step: (from: Session) => Session): Session | undefined => {
    if (sync.busy()) return undefined;
    const before = sync.state().session;
    const after = reconcileWithList(step(before), listedIds, env);
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
    if (!after) return;
    effects.play(after.status === 'completed' ? 'fanfare' : result === 'correct' ? 'chime' : 'gentle');
    autoplayCurrent(after);
  };

  const onRetry = (): void => {
    const after = advance((s) => startRetryRound(s, env, listedIds));
    if (!after) return;
    setBlockedAt(null);
    autoplayCurrent(after);
  };

  const onUndo = (): void => {
    if (advance(undo)) setBlockedAt(null);
  };

  const onKeepGoing = (): void => void advance(resetBreakCount);

  /** Break: the prompt is answered and saved, and only then does the child go home. */
  const [leaving, setLeaving] = useState(false);
  const onBreak = (): void => {
    if (advance(resetBreakCount)) setLeaving(true);
  };
  useEffect(() => {
    if (leaving && !saveFailed && session.marksSinceBreak === 0) location.hash = HOME_HREF;
  }, [leaving, saveFailed, session.marksSinceBreak]);

  if (session.status === 'stopped') {
    // Reconciling with the edited list found none of the session's words left: the session is saved as
    // stopped, and the child starts fresh by picking a list.
    return (
      <main class="screen practice">
        <HomeButton />
        <h1 class="sr-only">{list.title}</h1>
        <p class="notice" data-testid="list-changed">
          <span aria-hidden="true">🌟 </span>This list changed — pick a list
        </p>
      </main>
    );
  }

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

  const onBreakPrompt = breakDue(session, breakEvery);

  return (
    <main class="screen practice">
      <header class="practice__top">
        <HomeButton />
        {canUndo(session) && !onBreakPrompt && (
          <button type="button" class="btn btn--chip" onClick={onUndo}>
            <span aria-hidden="true">↩️ </span>Undo
          </button>
        )}
        <RoundBadge index={round.index} />
        <StarBar done={round.position} total={round.itemIds.length} />
      </header>
      {saveFailed && <SaveFailed onRetry={sync.retry} />}
      <h1 class="sr-only">{list.title}</h1>
      {onBreakPrompt && <BreakPrompt onKeepGoing={onKeepGoing} onBreak={onBreak} />}
      {!onBreakPrompt && item && !isRoundOver(round) && (
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
        <RoundSummary
          {...markCounts(round)}
          retryCount={canRetry(session, listedIds) ? wrongItemIds(round, listedIds).length : 0}
          onRetry={onRetry}
        />
      )}
    </main>
  );
}

function BreakPrompt({ onKeepGoing, onBreak }: { onKeepGoing: () => void; onBreak: () => void }) {
  return (
    <section class="break-prompt" data-testid="break-prompt">
      <p class="break-prompt__title">
        <span aria-hidden="true">🌟 </span>Great job! Take a break?
      </p>
      <div class="row row--primary">
        <button type="button" class="btn btn--primary" onClick={onKeepGoing}>
          <span aria-hidden="true">▶️ </span>Keep going
        </button>
        <button type="button" class="btn" onClick={onBreak}>
          <span aria-hidden="true">🏠 </span>Break
        </button>
      </div>
    </section>
  );
}

function RoundSummary({
  correct,
  wrong,
  retryCount,
  onRetry,
}: {
  correct: number;
  wrong: number;
  /** Missed words that can be practiced again (a miss on a since-removed word cannot). */
  retryCount: number;
  onRetry: () => void;
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
      {retryCount > 0 && (
        <>
          <p class="summary__more">Let's practice {retryCount} more!</p>
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
