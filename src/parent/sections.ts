// The parent area's sections. REGISTERING A SECTION = adding one file in `src/parent/sections/` that
// exports `section: ParentSection`. Nothing else is edited (no list to extend, no route to add), so
// tickets building different sections never touch the same lines.
//
//   // src/parent/sections/settings.tsx
//   export const section: ParentSection = {
//     id: 'settings',          // URL segment: #/parent/settings
//     title: 'Settings',       // the entry's label in the parent area (and the section's heading)
//     icon: '⚙️',
//     order: 30,               // position among the entries (see below)
//     Component: SettingsSection,
//   };
//
// Suggested `order` values (the spec's order): Profiles 10, Assign lessons 20, Settings 30, Progress 40,
// Lesson preview 50, Backup 60, What's new 65, Danger zone 70.
//
// A section reads and changes the app record with `useAppRecord()` (src/app-context.tsx). The gate is
// already passed and the idle timer is managed by the parent area; a section does nothing about locking.
// `path` is the part of the URL after the section id, so a section can have its own pages:
// `#/parent/progress/fixture-three` renders the progress section with `path = ['fixture-three']`.
import type { ComponentType } from 'preact';

export interface ParentSection {
  id: string;
  title: string;
  icon: string;
  order: number;
  Component: ComponentType<{ path: string[] }>;
}

const modules = import.meta.glob<{ section: ParentSection }>('./sections/*.tsx', { eager: true });

/** All registered sections, in display order. */
export const PARENT_SECTIONS: readonly ParentSection[] = Object.values(modules)
  .map((module) => module.section)
  .sort((x, y) => x.order - y.order || x.id.localeCompare(y.id));
