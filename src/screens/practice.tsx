import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fetchLessonWithVersion } from '../content/client.ts';
import { isRulesType, type ItemData, type LessonData, type ListTypeId, type PracticeTypeId, type Rendition } from '../content/types.ts';
import { useAudioPlayer } from '../practice/audio.ts';
import { createEffects } from '../practice/effects.ts';
import { loadKaiFont } from '../practice/kai-font.ts';
import { realEnv } from '../practice/real-env.ts';
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
  next,
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
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { HOME_HREF } from '../router.ts';
import { SaveFailed } from '../save-failed.tsx';
import { getStorage } from '../storage/index.ts';
import type { ProfileSettings } from '../storage/types.ts';
import { useLoad } from '../use-async.ts';
import { MathRun } from './math-practice.tsx';
import { flowOf, NoScope, type FlowProps } from './practice-flows.tsx';
import { BreakPrompt, Completion, HomeButton, LessonNotFound, RoundSummary } from './practice-parts.tsx';

export { LessonNotFound };

/** What a practice screen is given by its route. */
export interface PracticeRouteProps {
  subject: string;
  lessonId: string;
}

export const DictationScreen = (props: PracticeRouteProps) => <PracticeScreen {...props} practiceType="dictation" />;
export const StrokeOrderScreen = (props: PracticeRouteProps) => <PracticeScreen {...props} practiceType="stroke-order" />;
export const FactsScreen = (props: PracticeRouteProps) => <PracticeScreen {...props} practiceType="facts" />;
export const MissingNumberScreen = (props: PracticeRouteProps) => <PracticeScreen {...props} practiceType="missing-number" />;
export const PhraseRecognitionScreen = (props: PracticeRouteProps) => (
  <PracticeScreen {...props} practiceType="phrase-recognition" />
);

function PracticeScreen({
  subject,
  practiceType,
  lessonId,
}: PracticeRouteProps & {
  practiceType: PracticeTypeId;
}) {
  const loaded = useLoad(() => fetchLessonWithVersion(lessonId), [lessonId]);
  if (loaded.status === 'ready') {
    const { lesson } = loaded.value;
    // Checked before anything is opened, so a wrong address can never stop the saved practice. A lesson that has
    // lost this practice type still opens: its saved session for it is stopped (see openSession).
    if (lesson.subject !== subject) return <LessonNotFound />;
    return (
      <OpenPractice
        key={lessonId}
        lesson={lesson}
        practiceType={practiceType}
        contentVersion={loaded.value.contentVersion}
      />
    );
  }
  if (loaded.status === 'error') return <LessonNotFound />;
  return (
    <main class="screen">
      <HomeButton />
      <p class="notice">Loading…</p>
    </main>
  );
}

/** Failed audio requests in a row before the "turn up the volume" hint appears. */
const VOLUME_HINT_AFTER = 2;

/** Silence between the end of the ✅/❌ sound and the next item's audio. */
const AFTER_EFFECT_GAP_MS = 50;

/**
 * The longest the next item's audio may wait after a mark. WebKit lets a timer inherit the tap only if it
 * fires within 1 s of it, and that is what lets iOS play the audio without another tap; the rest of the
 * second is headroom for the tap handler and a late timer.
 */
const MAX_HELD_AUDIO_MS = 900;

/** Continues the saved session for this lesson and practice type, or starts and saves a new one, before showing practice. */
function OpenPractice({
  lesson,
  practiceType,
  contentVersion,
}: {
  lesson: LessonData;
  practiceType: PracticeTypeId;
  contentVersion: string;
}) {
  const env = useMemo(realEnv, []);
  const [openTries, setOpenTries] = useState(0);
  const opened = useLoad(
    async () => {
      const storage = getStorage();
      const { breakEvery, shuffle, sounds, strokeSpeed, strokePauseSeconds, learning } = await currentSettings(storage);
      const result = await openSession(storage, lesson, { practiceType, contentVersion, shuffle, learning }, env);
      return result && { ...result, breakEvery, sounds, strokeSpeed, strokePauseSeconds };
    },
    [openTries],
  );
  if (opened.status === 'ready' && !opened.value) return <LessonNotFound />;
  const result = opened.status === 'ready' ? opened.value : undefined;
  if (result) {
    const { session, resumed, breakEvery, sounds, strokeSpeed, strokePauseSeconds } = result;
    if (isRulesType(practiceType)) {
      return <MathRun lesson={lesson} practiceType={practiceType} env={env} initial={session} breakEvery={breakEvery} sounds={sounds} />;
    }
    return (
      <PracticeRun
        lesson={lesson}
        practiceType={practiceType}
        env={env}
        initial={session}
        resumed={resumed}
        breakEvery={breakEvery}
        sounds={sounds}
        strokeSpeed={strokeSpeed}
        strokePauseSeconds={strokePauseSeconds}
      />
    );
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
  lesson,
  practiceType,
  env,
  initial,
  resumed,
  breakEvery,
  sounds,
  strokeSpeed,
  strokePauseSeconds,
}: {
  lesson: LessonData;
  practiceType: ListTypeId;
  env: PracticeEnv;
  initial: Session;
  /** Continuing saved progress: audio must wait for the child's tap (iOS gesture rules). */
  resumed: boolean;
  /** Offer a break every this many marks; 0 is off (the profile's setting). */
  breakEvery: number;
  /** Play sound effects on ✅, ❌ and finishing (the profile's setting). Character audio ignores it. */
  sounds: boolean;
  /** How fast stroke order draws each stroke, and how long it waits after each (the profile's settings). */
  strokeSpeed: ProfileSettings['strokeSpeed'];
  strokePauseSeconds: ProfileSettings['strokePauseSeconds'];
}) {
  // Fixed for the session's lifetime: a learning session stays one even if the setting changes.
  const flow = flowOf(initial);
  const player = useAudioPlayer();
  const effects = useMemo(() => createEffects(sounds), []);
  const itemsById = useMemo(
    () => new Map((lesson.lists[practiceType] ?? []).map((item) => [item.target, item])),
    [lesson, practiceType],
  );
  const listedIds = useMemo(() => new Set(itemsById.keys()), [itemsById]);

  // What is shown is always what is saved: every change goes through `sync`, which saves it first.
  const [view, setView] = useState<SyncState>({ session: initial, saveFailed: false });
  const sync = useMemo(() => createSessionSync(getStorage(), initial, setView), []);
  useEffect(() => () => sync.detach(), []);
  const { session, saveFailed } = view;
  /** Auto-play for this place was rejected by the browser: the Listen button pulses. */
  const [blockedAt, setBlockedAt] = useState<Place | null>(null);
  /** Character-audio requests in a row that the browser refused; any success starts the count again. */
  const [audioFailures, setAudioFailures] = useState(0);
  /** The next item's auto-play, waiting for the ✅/❌ sound to finish (see onMark). */
  const heldAudio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelHeldAudio = (): void => clearTimeout(heldAudio.current);
  // Leaving the screen drops it, so it never plays over another one.
  useEffect(() => cancelHeldAudio, []);

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
    if (!autoplay) {
      cancelHeldAudio(); // the child asked for it now: it is not played twice
      sync.dispatch((s) => markHeard(s, place));
    }
    void player.play(target.audio[rendition]).then((started) => {
      setAudioFailures((count) => (started ? 0 : count + 1));
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
    if (flow.audioFirst && item && !resumed) requestAudio(item, 'normal', true, placeOf(session));
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

  /**
   * Auto-play the current item of `after`. Call it from the tap handler, or from a timer the handler set
   * (see onMark), so iOS allows the audio.
   */
  const autoplayCurrent = (after: Session): void => {
    const id = currentItemId(currentRound(after));
    const next = id === undefined ? undefined : itemsById.get(id);
    if (next) requestAudio(next, 'normal', true, placeOf(after));
  };

  const onCheck = (): void => {
    const after = advance((s) => reveal(s, flow.audioFirst));
    // Reading first: Check is what plays the item. This is the tap handler, so iOS allows the audio.
    if (after && !flow.audioFirst) autoplayCurrent(after);
  };

  const onMark = (result: Mark): void => afterStep(advance((s) => mark(s, result, env)), result === 'correct' ? 'chime' : 'gentle');

  const onNext = (): void => afterStep(advance((s) => next(s, env)), flow.nextEffect);

  /** A mark or Next moved the learner on to `after`: finish with the fanfare, or play the step's sound (if it has one) and then the next item's audio. */
  const afterStep = (after: Session | undefined, effect: 'chime' | 'gentle' | undefined): void => {
    if (!after) return;
    if (after.status === 'completed') {
      effects.play('fanfare');
      return;
    }
    const effectMs = effect ? effects.play(effect) : 0;
    cancelHeldAudio();
    // Reading first: the next item's audio would give its answer away, so nothing plays until Check.
    if (!flow.audioFirst) return;
    if (effectMs === 0) {
      autoplayCurrent(after); // the sounds setting is off: nothing to wait for
      return;
    }
    // The next item's audio follows the ✅/❌ sound instead of playing over it.
    const wait = Math.min(effectMs + AFTER_EFFECT_GAP_MS, MAX_HELD_AUDIO_MS);
    heldAudio.current = setTimeout(() => autoplayCurrent(after), wait);
  };

  const onRetry = (): void => {
    const after = advance((s) => startRetryRound(s, env, listedIds));
    if (!after) return;
    setBlockedAt(null);
    if (flow.audioFirst) autoplayCurrent(after);
  };

  const onUndo = (): void => {
    if (!advance(undo)) return;
    cancelHeldAudio();
    setBlockedAt(null);
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
    // Reconciling with the edited lesson found none of the session's words left: the session is saved as
    // stopped, and the child starts fresh by picking a lesson.
    return (
      <main class="screen practice">
        <HomeButton />
        <h1 class="sr-only">{lesson.title}</h1>
        <p class="notice" data-testid="lesson-changed">
          <span aria-hidden="true">🌟 </span>This lesson changed — pick a lesson
        </p>
      </main>
    );
  }

  if (session.status === 'completed') {
    return (
      <main class="screen practice">
        <h1 class="sr-only">{lesson.title}</h1>
        <Completion lines={flow.completionLines(sessionResult(session))} />
      </main>
    );
  }

  const place = placeOf(session);
  const pulse = blockedAt?.roundIndex === place.roundIndex && blockedAt.position === place.position;

  const onBreakPrompt = breakDue(session, breakEvery);
  const flowProps: FlowProps | undefined = item && {
    item,
    round,
    pulse,
    onListen: (rendition) => requestAudio(item, rendition, false, place),
    onCheck,
    onMark,
    onNext,
  };
  const Scope = flow.Scope ?? NoScope;

  return (
    <main class="screen practice">
      <header class="practice__top">
        <HomeButton />
        {canUndo(session) && (
          <button type="button" class="btn btn--chip" onClick={onUndo}>
            <span aria-hidden="true">↩️ </span>Undo
          </button>
        )}
        <RoundBadge index={round.index} />
        <StarBar done={round.position} total={round.itemIds.length} />
      </header>
      {saveFailed && <SaveFailed onRetry={sync.retry} />}
      <h1 class="sr-only">{lesson.title}</h1>
      {onBreakPrompt && <BreakPrompt onKeepGoing={onKeepGoing} onBreak={onBreak} />}
      {!onBreakPrompt && flowProps && !isRoundOver(round) && (
        <Scope
          key={`${round.index}:${round.position}`}
          item={flowProps.item}
          strokeSpeed={strokeSpeed}
          strokePauseSeconds={strokePauseSeconds}
        >
          <section class="practice__body">
            <div class="practice__stage">
              <flow.Stage {...flowProps} />
            </div>
            <div class="practice__controls">
              <div role="status" class="volume-hint-slot">
                {audioFailures >= VOLUME_HINT_AFTER && (
                  <p class="volume-hint">
                    No sound? Turn up the volume <span aria-hidden="true">🔈</span>
                  </p>
                )}
              </div>
              <flow.Controls {...flowProps} />
            </div>
          </section>
        </Scope>
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

