import { render } from 'preact';
import { App } from './app.tsx';
import { registerServiceWorker } from './pwa/service-worker.ts';
import { requestPersistenceOnFirstRun } from './storage/index.ts';
import './styles.css';
import './practice.css';

render(<App />, document.getElementById('app')!);
void requestPersistenceOnFirstRun();
registerServiceWorker();

// iOS Safari ignores user-scalable=no for pinch, so cancel the pinch gesture itself.
document.addEventListener('gesturestart', (event) => event.preventDefault());
