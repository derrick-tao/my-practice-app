import { HomeScreen } from './screens/home.tsx';
import { PracticeScreen } from './screens/practice.tsx';
import { useRoute } from './router.ts';

export function App() {
  const route = useRoute();
  switch (route.name) {
    case 'list':
      return <PracticeScreen subject={route.subject} practiceType={route.practiceType} listId={route.listId} />;
    case 'home':
      return <HomeScreen />;
  }
}
