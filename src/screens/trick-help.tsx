// The trick's badge with its "?" button, and the help sheet the button opens: a native modal <dialog> over the practice
// screen, so the number pad and the problem never move. It closes with the big "Got it" button, or by tapping outside
// it (or Esc). The sheet holds no learner state: opening and closing it leaves the score, tries and saved session alone.
import { useRef } from 'preact/hooks';
import type { TrickHelp } from '../math/types.ts';

export function TrickBadge({ title, help }: { title: string; help?: TrickHelp }) {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    <div class="math__badge-row">
      <p class="math__badge" data-testid="title">
        💡 {title}
      </p>
      {help && (
        <>
          <button type="button" class="math__help" aria-label={`Help: ${title}`} onClick={() => sheet.current?.showModal()}>
            <span aria-hidden="true">?</span>
          </button>
          <dialog
            ref={sheet}
            class="help-sheet"
            aria-labelledby="help-sheet-title"
            // A tap on the dimmed area outside the sheet lands on the dialog itself, as do taps on its own scrollbar and
            // padding, so tell them apart by where the tap is: outside the sheet's box means close.
            onClick={(event) => {
              if (event.target !== event.currentTarget) return;
              const box = event.currentTarget.getBoundingClientRect();
              const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
              if (!inside) sheet.current?.close();
            }}
          >
            <div class="help-sheet__content">
              <h2 class="help-sheet__title" id="help-sheet-title">
                💡 {title}
              </h2>
              <section class="help-sheet__part" data-testid="help-what-it-is">
                <h3>What it is</h3>
                <p>{help.whatItIs}</p>
              </section>
              <section class="help-sheet__part" data-testid="help-why-it-helps">
                <h3>Why it helps</h3>
                <p>{help.whyItHelps}</p>
              </section>
              <section class="help-sheet__part" data-testid="help-example">
                <h3>Example</h3>
                <div class="help-sheet__example">
                  {help.example.map((line, i) => (
                    <p key={i} data-testid="help-example-line">
                      {line}
                    </p>
                  ))}
                </div>
              </section>
              <button type="button" class="btn btn--primary help-sheet__close" onClick={() => sheet.current?.close()}>
                Got it
              </button>
            </div>
          </dialog>
        </>
      )}
    </div>
  );
}
