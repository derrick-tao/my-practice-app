// The parent area (#/parent): behind the gate, with one entry per registered section (sections.ts).
import { HOME_HREF, parentHref } from '../router.ts';
import { ParentGate } from './gate.tsx';
import { unlockParentArea, useParentAreaUnlocked } from './gate-state.ts';
import { PARENT_SECTIONS } from './sections.ts';

export function ParentArea({ path }: { path: string[] }) {
  const unlocked = useParentAreaUnlocked();
  if (!unlocked) {
    return (
      <main class="screen">
        <a class="home-button" href={HOME_HREF}>
          <span aria-hidden="true">🏠 </span>Home
        </a>
        <ParentGate onPassed={unlockParentArea} />
      </main>
    );
  }

  const [sectionId, ...rest] = path;
  const section = PARENT_SECTIONS.find((s) => s.id === sectionId);
  return (
    <main class="screen parent">
      <nav class="parent__nav">
        <a class="home-button" href={HOME_HREF}>
          <span aria-hidden="true">🏠 </span>Home
        </a>
        {section && (
          <a class="home-button home-button--quiet" href={parentHref()}>
            <span aria-hidden="true">⬅️ </span>Back
          </a>
        )}
      </nav>
      {section ? (
        <>
          <h1 class="screen__title">{section.title}</h1>
          <section.Component path={rest} />
        </>
      ) : (
        <>
          <h1 class="screen__title">Grown-ups</h1>
          <ul class="parent__entries">
            {PARENT_SECTIONS.map((s) => (
              <li key={s.id}>
                <a class="parent__entry" href={parentHref(s.id)}>
                  <span aria-hidden="true">{s.icon} </span>
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
