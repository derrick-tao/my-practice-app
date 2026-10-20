// Parent area section: the active learner's settings (shuffle, break cadence, sounds, and the stroke order
// speed and pause). Each control shows the SAVED value: it changes only after the write, and a failed write
// offers a retry.
import { useState } from 'preact/hooks';
import { useAppRecord } from '../../app-context.tsx';
import { activeProfileOf, setSettings } from '../../profiles.ts';
import { SaveFailed } from '../../save-failed.tsx';
import type { ProfileSettings } from '../../storage/types.ts';
import { useSave } from '../../use-save.ts';
import type { ParentSection } from '../sections.ts';
import { SwitchRow } from '../switch-row.tsx';

const BREAK_CHOICES: ReadonlyArray<{ value: ProfileSettings['breakEvery']; label: string }> = [
  { value: 0, label: 'Off' },
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
];

const STROKE_SPEED_CHOICES: ReadonlyArray<{ value: ProfileSettings['strokeSpeed']; label: string }> = [
  { value: 'slow', label: 'Slow' },
  { value: 'normal', label: 'Normal' },
  { value: 'fast', label: 'Fast' },
];

const STROKE_PAUSE_CHOICES: ReadonlyArray<{ value: ProfileSettings['strokePauseSeconds']; label: string }> = [
  { value: 2, label: '2 s' },
  { value: 3, label: '3 s' },
  { value: 5, label: '5 s' },
  { value: 8, label: '8 s' },
];

function Settings() {
  const { app, update } = useAppRecord();
  const profile = activeProfileOf(app);
  const { failed, run } = useSave();
  const [lastChange, setLastChange] = useState<Partial<ProfileSettings>>({});

  if (!profile) return null;
  const { shuffle, breakEvery, sounds, strokeSpeed, strokePauseSeconds } = profile.settings;

  const save = (change: Partial<ProfileSettings>): Promise<void> => {
    setLastChange(change);
    return run(() => update((current) => setSettings(current, profile.id, change)));
  };

  return (
    <>
      <p class="notice">
        Settings for {profile.avatar} {profile.name}:
      </p>
      <ul class="switches">
        <SwitchRow
          on={shuffle}
          title="Shuffle the first round"
          meta="Off: the first round follows the list's order"
          onToggle={() => void save({ shuffle: !shuffle })}
        />
        <SwitchRow
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
      <div class="field">
        <span class="field__label" id="stroke-speed-label">
          Stroke speed
        </span>
        <div class="choices" role="radiogroup" aria-labelledby="stroke-speed-label">
          {STROKE_SPEED_CHOICES.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              role="radio"
              aria-checked={strokeSpeed === value}
              class={`choice${strokeSpeed === value ? ' choice--chosen' : ''}`}
              onClick={() => void save({ strokeSpeed: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div class="field">
        <span class="field__label" id="stroke-pause-label">
          Pause after each stroke
        </span>
        <div class="choices" role="radiogroup" aria-labelledby="stroke-pause-label">
          {STROKE_PAUSE_CHOICES.map(({ value, label }) => (
            <button
              type="button"
              key={value}
              role="radio"
              aria-checked={strokePauseSeconds === value}
              class={`choice${strokePauseSeconds === value ? ' choice--chosen' : ''}`}
              onClick={() => void save({ strokePauseSeconds: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {failed && <SaveFailed onRetry={() => void save(lastChange)} />}
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
