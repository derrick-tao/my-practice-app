// The parent area (#/parent): behind the gate, with one entry per registered section (sections.ts).
import { HOME_HREF, parentHref } from '../router.ts';
import { ParentGate } from './gate.tsx';
import { unlockParentArea, useParentAreaUnlocked } from './gate-state.ts';
import { AddToHomeScreenTip } from '../pwa/install-tip.tsx';
import { UpdateDot } from '../pwa/update-dot.tsx';
import { PARENT_SECTIONS, type ParentSection } from './sections.ts';

/** A section's entry in the menu; a section that has something waiting (What's new: an update) carries the dot. */
function SectionEntry({ section }: { section: ParentSection }) {
  const attention = section.useAttention?.() ?? false;
  return (
    <li>
      <a
        class="parent__entry"
        href={parentHref(section.id)}
        aria-label={attention ? `${section.title}, update waiting` : undefined}
      >
        <span aria-hidden="true">{section.icon} </span>
        {section.title}
        {attention && <UpdateDot />}
      </a>
    </li>
  );
}

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
          <AddToHomeScreenTip />
          <ul class="parent__entries">
            {PARENT_SECTIONS.map((s) => (
              <SectionEntry key={s.id} section={s} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
