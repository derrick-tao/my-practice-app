// Writes the three sound effects into public/sounds/ (committed, so builds never need this script).
//
//   npx tsx scripts/generate-sounds.ts
//
// PROVENANCE: these sounds are synthesized here from plain sine waves (no samples, recordings or third-party
// assets), so they are original to this repo and need no license or attribution. Change the notes below and
// re-run to retune them.
//
//   chime.wav    (a correct word)    two soft rising bell notes, C6 then G6
//   gentle.wav   (a missed word)     one warm, low, falling tone: a quiet "oh", never a buzzer
//   fanfare.wav  (everything right)  a bright rising C major arpeggio ending on a held chord
//
// 22.05 kHz, 16-bit, mono WAV: about 140 KB in total, small enough to precache for offline use.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RATE = 22_050;

interface Note {
  /** Hz. */
  freq: number;
  /** Seconds from the start of the sound. */
  start: number;
  /** Seconds the note rings. */
  length: number;
  gain: number;
  /** Level of the octave above, which makes a sine sound bell-like. */
  shimmer?: number;
}

/** Sum the notes: a short fade-in (no click) and an exponential fade-out (a soft bell, not a beep). */
function render(notes: Note[], seconds: number): Int16Array {
  const samples = new Float32Array(Math.ceil(seconds * RATE));
  for (const note of notes) {
    const first = Math.floor(note.start * RATE);
    const count = Math.floor(note.length * RATE);
    for (let i = 0; i < count && first + i < samples.length; i++) {
      const t = i / RATE;
      const attack = Math.min(1, t / 0.012);
      const decay = Math.exp((-5 * t) / note.length);
      const phase = 2 * Math.PI * note.freq * t;
      const tone = Math.sin(phase) + (note.shimmer ?? 0) * Math.sin(2 * phase);
      samples[first + i]! += note.gain * attack * decay * tone;
    }
  }
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767);
  return out;
}

function wav(pcm: Int16Array): Buffer {
  const data = Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.51;
const G6 = 1567.98;

const sounds: Record<string, Int16Array> = {
  chime: render(
    [
      { freq: C6, start: 0, length: 0.35, gain: 0.35, shimmer: 0.2 },
      { freq: G6, start: 0.12, length: 0.5, gain: 0.35, shimmer: 0.2 },
    ],
    0.7,
  ),
  gentle: render(
    [
      { freq: 392, start: 0, length: 0.3, gain: 0.35 },
      { freq: 330, start: 0.18, length: 0.5, gain: 0.35 },
    ],
    0.75,
  ),
  fanfare: render(
    [
      { freq: C5, start: 0, length: 0.4, gain: 0.3, shimmer: 0.25 },
      { freq: E5, start: 0.16, length: 0.4, gain: 0.3, shimmer: 0.25 },
      { freq: G5, start: 0.32, length: 0.4, gain: 0.3, shimmer: 0.25 },
      { freq: C6, start: 0.48, length: 1.1, gain: 0.28, shimmer: 0.25 },
      { freq: E6, start: 0.48, length: 1.1, gain: 0.2, shimmer: 0.2 },
      { freq: G6, start: 0.48, length: 1.1, gain: 0.2, shimmer: 0.2 },
    ],
    1.7,
  ),
};

const outDir = path.resolve(import.meta.dirname, '..', 'public', 'sounds');
mkdirSync(outDir, { recursive: true });
for (const [name, pcm] of Object.entries(sounds)) {
  const file = path.join(outDir, `${name}.wav`);
  writeFileSync(file, wav(pcm));
  console.log(`wrote ${path.relative(process.cwd(), file)} (${(pcm.length / RATE).toFixed(2)}s)`);
}
