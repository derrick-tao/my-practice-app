import { render } from 'preact';
import { App } from './app.tsx';
import { registerServiceWorker } from './pwa/service-worker.ts';
import { requestPersistenceOnFirstRun } from './storage/index.ts';
import { INSTALLED_RELEASE_ID } from './version.ts';
import './styles.css';
import './practice.css';

render(<App />, document.getElementById('app')!);
void requestPersistenceOnFirstRun();
registerServiceWorker();
// The running build says which release it is (also what lets a test read it off the page).
document.documentElement.dataset.release = INSTALLED_RELEASE_ID;

// iOS Safari ignores user-scalable=no for pinch, so cancel the pinch gesture itself.
document.addEventListener('gesturestart', (event) => event.preventDefault());
