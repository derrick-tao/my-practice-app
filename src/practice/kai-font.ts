import { contentUrl } from '../content/client.ts';

/** The handwriting-style font for revealed characters: a subset built from the content, served by the app. */
export const KAI_FAMILY = 'Practice Kai';
const KAI_FILE = 'fonts/practice-kai.woff2';

let loading: Promise<void> | undefined;

/**
 * Start loading the font (once). Until it is ready, and if it can never load, characters show in the system
 * font from the CSS fallback list, so practice never waits on it.
 */
export function loadKaiFont(): Promise<void> {
  loading ??= (async () => {
    const face = new FontFace(KAI_FAMILY, `url(${contentUrl(KAI_FILE)}) format("woff2")`, { display: 'swap' });
    await face.load();
    document.fonts.add(face);
  })().catch(() => {
    loading = undefined; // try again the next time practice opens
  });
  return loading;
}
