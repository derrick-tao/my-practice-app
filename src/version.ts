import type { Release } from './content/types.ts';

// The app's own version (package.json), fixed into the bundle by vite.config.ts.
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;

// The newest release in the log when this build was made (vite.config.ts); null when the log was empty.
declare const __RELEASE__: Release | null;

/** The release this build is, or undefined when it was built without a release log. */
export const INSTALLED_RELEASE: Release | undefined = __RELEASE__ ?? undefined;

/** Which release this build is: match it against the published release log to tell installed from newer. '' when unknown. */
export const INSTALLED_RELEASE_ID: string = INSTALLED_RELEASE?.id ?? '';
