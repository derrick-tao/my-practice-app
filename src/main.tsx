import { render } from 'preact';
import { App } from './app.tsx';
import { requestPersistenceOnFirstRun } from './storage/index.ts';
import './styles.css';
import './practice.css';

render(<App />, document.getElementById('app')!);
void requestPersistenceOnFirstRun();
