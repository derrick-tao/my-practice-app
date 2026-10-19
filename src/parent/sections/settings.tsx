// Parent area section: the active learner's settings (shuffle, break cadence, sounds). Each control
// shows the SAVED value: it changes only after the write, and a failed write offers a retry.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { activeProfileOf, setSettings } from '../../profiles.ts';
import type { ProfileSettings } from '../../storage/types.ts';
import type { ParentSection } from '../sections.ts';

const BREAK_CHOICES: ReadonlyArray<{ value: ProfileSettings['breakEvery']; label: string }> = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
];

function Toggle({
  on,
  title,
  meta,
  onToggle,
}: {
  on: boolean;
  title: string;
  meta: string;
  onToggle: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        class={`switch${on ? ' switch--on' : ''}`}
        onClick={onToggle}
      >
        <span class="switch__label">
          <span class="switch__title">{title}</span>
          <span class="switch__meta">{meta}</span>
        </span>
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </li>
  );
}

function Settings() {
  const { app, update } = useAppRecord();
  const profile = activeProfileOf(app);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<Partial<ProfileSettings> | null>(null);

  if (!profile) return null;
  const { shuffle, breakEvery, sounds } = profile.settings;

  const save = async (change: Partial<ProfileSettings>): Promise<void> => {
    if (saving) return;
    setFailed(null);
    setSaving(true);
    try {
      await update((current) => setSettings(current, profile.id, change));
    } catch {
      setFailed(change);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p class="notice">
        Settings for {profile.avatar} {profile.name}:
      </p>
      <ul class="switches">
        <Toggle
          on={shuffle}
          title="Shuffle the first round"
          meta="Off: the first round follows the list's order"
          onToggle={() => void save({ shuffle: !shuffle })}
        />
        <Toggle
          on={sounds}
          title="Sound effects"
          meta="The voice always plays"
          onToggle={() => void save({ sounds: !sounds })}
        />
      </ul>
      <div class="field">
        <span class="field__label" id="break-label">
          Break every
        </span>
        <div class="choices" role="radiogroup" aria-labelledby="break-label">
          {BREAK_CHOICES.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              role="radio"
              aria-checked={breakEvery === value}
              class={`choice${breakEvery === value ? ' choice--chosen' : ''}`}
              onClick={() => void save({ breakEvery: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {failed && (
        <div role="alert" class="save-failed">
          <button type="button" class="btn btn--primary btn--bad" onClick={() => void save(failed)}>
            <span aria-hidden="true">⚠️ </span>Couldn't save — tap to retry
          </button>
        </div>
      )}
    </>
  );
}

export const section: ParentSection = {
  id: 'settings',
  title: 'Settings',
  icon: '🎚️',
  order: 30,
  Component: Settings,
};
