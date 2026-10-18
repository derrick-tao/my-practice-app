import { HomeScreen } from './screens/home.tsx';
import { ListScreen } from './screens/list.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'list':
      return <ListScreen subject={route.subject} practiceType={route.practiceType} listId={route.listId} />;
    case 'home':
      return <HomeScreen />;
  }
}
