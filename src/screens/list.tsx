import { fetchList } from '../content/client.ts';
import { HOME_HREF } from '../router.ts';
import { useLoad } from '../use-async.ts';

// Placeholder until the practice flow lands (ticket 03): shows the list the route points at.
export function ListScreen({ listId }: { subject: string; practiceType: string; listId: string }) {
  const list = useLoad(() => fetchList(listId), [listId]);
  return (
    <main class="screen">
      <a class="home-button" href={HOME_HREF}>
        <span aria-hidden="true">🏠 </span>Home
      </a>
      {list.status === 'loading' && <p class="notice">Loading…</p>}
      {list.status === 'error' && <p class="notice">We couldn't find this list.</p>}
      {list.status === 'ready' && (
        <>
          <h1 class="screen__title">{list.value.title}</h1>
          <p class="notice">{list.value.items.length} characters</p>
        </>
      )}
    </main>
  );
}
