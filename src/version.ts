// The app's own version (package.json), fixed into the bundle by vite.config.ts.
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;

// The id of the newest release in the log when this build was made (vite.config.ts); '' when the log was empty.
declare const __RELEASE_ID__: string;

/** Which release this build is: match it against the published release log to tell installed from newer. */
export const INSTALLED_RELEASE_ID: string = __RELEASE_ID__;
