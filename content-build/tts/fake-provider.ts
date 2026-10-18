import type { TtsProvider, TtsRequest } from './types.ts';

export interface FakeProvider extends TtsProvider {
  /** Every request made, in order. Seam 2 asserts on this. */
  readonly requests: TtsRequest[];
}

const FRAME_HEADER = [0xff, 0xfb, 0x90, 0x64]; // MPEG-1 Layer III, 128 kbps, 44.1 kHz
const FRAME_BYTES = 417; // 144 * 128000 / 44100, no padding
const FRAME_COUNT = 10; // about a quarter of a second

/** A short, valid, silent MP3 (zeroed frames decode as silence). */
export function silentMp3(): Uint8Array {
  const bytes = new Uint8Array(FRAME_BYTES * FRAME_COUNT);
  for (let frame = 0; frame < FRAME_COUNT; frame++) bytes.set(FRAME_HEADER, frame * FRAME_BYTES);
  return bytes;
}

/** Records requests and returns silent placeholder audio. Never touches the network. */
export function createFakeProvider(): FakeProvider {
  const requests: TtsRequest[] = [];
  return {
    id: 'fake',
    extension: 'mp3',
    requests,
    async synthesize(request) {
      requests.push(request);
      return silentMp3();
    },
  };
}
