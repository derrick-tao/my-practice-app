import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReleases } from '../../src/content/client.ts';
import type { Release } from '../../src/content/types.ts';

const log: Release[] = [{ id: 'a', date: '2026-10-21', title: 'A', bullets: ['One.'] }];

/** Stand in for the network (and the service worker's answer): fetch resolves with `response` or rejects. */
function network(response: Response | Error): void {
  vi.stubGlobal('fetch', () => (response instanceof Error ? Promise.reject(response) : Promise.resolve(response)));
}

afterEach(() => vi.unstubAllGlobals());

describe('reading the release log', () => {
  it('returns the published releases, newest first', async () => {
    network(Response.json(log));
    expect(await fetchReleases()).toEqual(log);
  });

  it('returns nothing, without throwing, when neither the network nor a cached copy answers', async () => {
    network(new TypeError('Failed to fetch'));
    expect(await fetchReleases()).toBeUndefined();
  });

  it('returns nothing when the file is missing or is not a list', async () => {
    network(new Response('nope', { status: 404 }));
    expect(await fetchReleases()).toBeUndefined();
    network(Response.json({ releases: [] }));
    expect(await fetchReleases()).toBeUndefined();
    network(new Response('<html>', { status: 200 }));
    expect(await fetchReleases()).toBeUndefined();
  });
});
