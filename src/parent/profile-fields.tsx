// The name and avatar fields of a learner profile: used by first-run set-up and the Profiles section.
import { AVATARS, NAME_MAX_LENGTH } from '../profiles.ts';

export function ProfileFields({
  name,
  avatar,
  onName,
  onAvatar,
}: {
  name: string;
  avatar: string;
  onName: (name: string) => void;
  onAvatar: (avatar: string) => void;
}) {
  return (
    <>
      <label class="field">
        <span class="field__label">Name</span>
        <input
          class="field__input"
          type="text"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          autoComplete="off"
          onInput={(e) => onName(e.currentTarget.value)}
        />
      </label>
      <div class="field">
        <span class="field__label" id="avatar-label">
          Avatar
        </span>
        <div class="avatars" role="group" aria-labelledby="avatar-label">
          {AVATARS.map((emoji) => (
            <button
              type="button"
              key={emoji}
              class={`avatar${emoji === avatar ? ' avatar--chosen' : ''}`}
              aria-label={emoji}
              aria-pressed={emoji === avatar}
              onClick={() => onAvatar(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
