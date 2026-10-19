import { useEffect } from 'preact/hooks';
import { AppRecordProvider, useAppState } from './app-context.tsx';
import { lockParentArea } from './parent/gate-state.ts';
import { ParentArea } from './parent/area.tsx';
import { FirstRun } from './screens/first-run.tsx';
import { HomeScreen } from './screens/home.tsx';
import { ListNotFound, PracticeScreen } from './screens/practice.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  const { state, api } = useAppState();

  // Leaving the parent area locks the gate again.
  useEffect(() => {
    if (route.name !== 'parent') lockParentArea();
  }, [route.name]);

  if (!api) {
    return (
      <main class="screen">
        {state.status === 'newer' && (
          <p class="notice" role="alert">
            Your saved progress is from a newer version of this app. Please update the app.
          </p>
        )}
        {state.status === 'error' && <p class="notice">Couldn't open the app's saved data. Please reload.</p>}
        {state.status === 'loading' && <p class="notice">Loading…</p>}
      </main>
    );
  }

  // No profile yet (a brand-new device): whatever the address, a grown-up has to set the app up first.
  if (api.app.profiles.length === 0) {
    return (
      <AppRecordProvider api={api}>
        <FirstRun />
      </AppRecordProvider>
    );
  }

  return <AppRecordProvider api={api}>{screenFor(route)}</AppRecordProvider>;
}

function screenFor(route: ReturnType<typeof useRoute>) {
  switch (route.name) {
    case 'list':
      return <PracticeScreen subject={route.subject} practiceType={route.practiceType} listId={route.listId} />;
    case 'parent':
      return <ParentArea path={route.path} />;
    case 'not-found':
      return <ListNotFound />;
    case 'home':
      return <HomeScreen />;
  }
}
