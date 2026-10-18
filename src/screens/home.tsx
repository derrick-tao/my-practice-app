import { fetchManifest } from '../content/client.ts';
import type { ListSummary } from '../content/types.ts';
import { listHref } from '../router.ts';
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

export function HomeScreen() {
  const manifest = useLoad(fetchManifest, []);
  return (
    <main class="screen">
      <h1 class="screen__title">My Practice</h1>
      {manifest.status === 'loading' && <p class="notice">Loading…</p>}
      {manifest.status === 'error' && <p class="notice">Couldn't load the lists. Check the internet and try again.</p>}
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
