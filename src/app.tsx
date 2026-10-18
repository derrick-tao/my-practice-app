import { HomeScreen } from './screens/home.tsx';
import { ListNotFound, PracticeScreen } from './screens/practice.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'list':
      return <PracticeScreen subject={route.subject} practiceType={route.practiceType} listId={route.listId} />;
    case 'not-found':
      return <ListNotFound />;
    case 'home':
      return <HomeScreen />;
  }
}
