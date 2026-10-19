import { useAppRecord } from '../app-context.tsx';
import type { ListSummary, PracticeTypeId } from '../content/types.ts';
import { usePublishedLists } from '../content/use-lists.ts';
import { findActiveSession } from '../practice/resume.ts';
import { currentRound, type Session } from '../practice/session.ts';
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { activeProfileOf, setActiveProfile } from '../profiles.ts';
import { applyUpdate, useUpdateReady } from '../pwa/service-worker.ts';
import { listHref, parentHref } from '../router.ts';
import { getStorage } from '../storage/index.ts';
import { useLoad } from '../use-async.ts';

function ListCard({ subject, practiceType, list }: { subject: string; practiceType: PracticeTypeId; list: ListSummary }) {
  return (
    <a class="list-card" href={listHref(subject, practiceType, list.id)}>
      <span class="list-card__title">{list.title}</span>
      {list.testDates && (
        <span class="list-card__meta">
          <span aria-hidden="true">📅 </span>Test: {list.testDates}
        </span>
      )}
      <span class="list-card__meta">
        <span aria-hidden="true">✏️ </span>
        {list.itemCount} {list.itemCount === 1 ? 'character' : 'characters'}
      </span>
    </a>
  );
}

/** Resume the active session exactly where it was left. */
function KeepGoingCard({ session, list }: { session: Session; list: ListSummary }) {
  const round = currentRound(session);
  return (
    <a class="keep-going" href={listHref(session.subject, session.practiceType, session.listId)}>
      <span class="keep-going__label">
        <span aria-hidden="true">▶️ </span>Keep going
      </span>
      <span class="keep-going__title">{list.title}</span>
      <span class="keep-going__progress">
        <RoundBadge index={round.index} />
        <StarBar done={round.position} total={round.itemIds.length} />
      </span>
    </a>
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
  const published = usePublishedLists();
  // Each learner has their own practice in progress: look again whenever the learner changes.
  const resume = useLoad(loadResume, [profile.id]);
  const updateReady = useUpdateReady();
  const session = resume.status === 'ready' ? resume.value : undefined;
  const all = published.status === 'ready' ? published.value : [];
  const assigned = new Set(profile.assignedListIds);
  const shown = all.filter(({ list }) => assigned.has(list.id));
  // The practice in progress stays reachable even when its list has since been unassigned.
  const resumeList = session && all.find(({ list }) => list.id === session.listId)?.list;
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
      {published.status === 'error' && <p class="notice">Couldn't load the lists. Check the internet and try again.</p>}
      {session && resumeList && <KeepGoingCard session={session} list={resumeList} />}
      {published.status === 'ready' && shown.length === 0 && !resumeList && (
        <p class="notice">No lists yet. Ask a grown-up to pick some!</p>
      )}
      {shown.length > 0 && (
        <section class="cards">
          {shown.map(({ subject, practiceType, list }) => (
            <ListCard key={list.id} subject={subject} practiceType={practiceType} list={list} />
          ))}
        </section>
      )}
    </main>
  );
}
