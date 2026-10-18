import { fetchManifest } from '../content/client.ts';
import type { ListSummary } from '../content/types.ts';
import { findActiveSession } from '../practice/resume.ts';
import { currentRound, type Session } from '../practice/session.ts';
import { RoundBadge, StarBar } from '../practice/widgets.tsx';
import { listHref } from '../router.ts';
import { getStorage, NewerSchemaError } from '../storage/index.ts';
import { useLoad } from '../use-async.ts';

function ListCard({ subject, practiceType, list }: { subject: string; practiceType: string; list: ListSummary }) {
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

interface Resume {
  session?: Session;
  /** Saved progress was written by a newer version of the app. */
  newerData?: boolean;
}

/** The active session, if any. Home still works when saved data can't be read. */
async function loadResume(): Promise<Resume> {
  try {
    return { session: await findActiveSession(getStorage()) };
  } catch (error) {
    return error instanceof NewerSchemaError ? { newerData: true } : {};
  }
}

export function HomeScreen() {
  const manifest = useLoad(fetchManifest, []);
  const resume = useLoad(loadResume, []);
  const saved: Resume = resume.status === 'ready' ? resume.value : {};
  const session = saved.session;
  const lists =
    manifest.status === 'ready'
      ? manifest.value.subjects.flatMap((subject) => subject.practiceTypes.flatMap((type) => type.lists))
      : [];
  const resumeList = session && lists.find((list) => list.id === session.listId);
  return (
    <main class="screen">
      <h1 class="screen__title">My Practice</h1>
      {manifest.status === 'loading' && <p class="notice">Loading…</p>}
      {manifest.status === 'error' && <p class="notice">Couldn't load the lists. Check the internet and try again.</p>}
      {saved.newerData && (
        <p class="notice" role="alert">
          Your saved progress is from a newer version of this app. Please update the app.
        </p>
      )}
      {session && resumeList && <KeepGoingCard session={session} list={resumeList} />}
      {manifest.status === 'ready' &&
        manifest.value.subjects.flatMap((subject) =>
          subject.practiceTypes.map((type) => (
            <section class="cards" key={`${subject.id}/${type.id}`}>
              {type.lists.map((list) => (
                <ListCard key={list.id} subject={subject.id} practiceType={type.id} list={list} />
              ))}
            </section>
          )),
        )}
    </main>
  );
}
