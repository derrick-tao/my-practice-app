// Pieces both real providers share: the default sleep, XML escaping for SSML text, and the retry loop.

export type Sleep = (ms: number) => Promise<void>;

export const defaultSleep: Sleep = (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** What one attempt reports: the finished value, or why it should be tried again and after how long. */
export type Attempt<T> = { value: T } | { retry: { reason: string; waitMs: number } };

/**
 * Run `attempt` up to `maxAttempts` times (it is given the 1-based attempt number), sleeping the wait it
 * asked for between failures but not after the last. An attempt that throws ends the loop: that is how
 * a failure that retrying cannot fix is reported. Returns the value, or the last retry reason.
 */
export async function withRetries<T>(
  maxAttempts: number,
  sleep: Sleep,
  attempt: (n: number) => Promise<Attempt<T>>,
): Promise<{ value: T } | { exhausted: string }> {
  let reason = 'none';
  for (let n = 1; n <= maxAttempts; n++) {
    const result = await attempt(n);
    if ('value' in result) return result;
    reason = result.retry.reason;
    if (n < maxAttempts) await sleep(result.retry.waitMs);
  }
  return { exhausted: reason };
}
