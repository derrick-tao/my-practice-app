// Validation of the release log (content/releases.json). Every problem names the file, the release and the rule.
import { MAX_RELEASE_BULLETS, type Release } from '../src/content/types.ts';
import type { Issue } from './validate.ts';

export const RELEASES_FILE = 'releases.json';

const RELEASE_KEYS: readonly string[] = ['id', 'date', 'title', 'bullets'];
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface ReleasesResult {
  releases: Release[];
  errors: Issue[];
}

/** Validate the release log's text: a JSON list of releases, newest first, with unique ids. */
export function validateReleases(source: string): ReleasesResult {
  const errors: Issue[] = [];
  const fail = (rule: string, message: string, at?: Partial<Issue>): void => {
    errors.push({ file: RELEASES_FILE, rule, message, ...at });
  };

  let doc: unknown;
  try {
    doc = JSON.parse(source);
  } catch (error) {
    fail('release-log-shape', error instanceof Error ? error.message : String(error));
    return { releases: [], errors };
  }
  if (!Array.isArray(doc)) {
    fail('release-log-shape', 'the file must be a list of releases, newest first');
    return { releases: [], errors };
  }

  const releases: Release[] = [];
  const seenIds = new Set<string>();
  let previousDate: string | undefined;
  for (const [index, entry] of doc.entries()) {
    const id = isRecord(entry) && typeof entry.id === 'string' ? entry.id : undefined;
    const at = { practiceType: 'release', itemNumber: index + 1, ...(id && { target: id }) };
    const failHere = (rule: string, message: string): void => fail(rule, message, at);
    if (!isRecord(entry)) {
      failHere('release-log-shape', 'a release must be an object with id, date, title and bullets');
      continue;
    }

    for (const key of Object.keys(entry)) {
      if (!RELEASE_KEYS.includes(key)) {
        failHere('unknown-key', `unknown release field "${key}" (allowed: ${RELEASE_KEYS.join(', ')})`);
      }
    }
    const text = (key: string): string | undefined => {
      const value = entry[key];
      if (typeof value !== 'string' || value.trim() === '') {
        failHere('required-field', `required field "${key}" is missing or empty`);
        return undefined;
      }
      return value;
    };
    const title = text('title');
    const date = text('date');
    const idText = text('id');

    if (idText !== undefined) {
      if (!ID.test(idText)) failHere('invalid-value', `"id" must be lowercase words joined by dashes (got "${idText}")`);
      if (seenIds.has(idText)) failHere('unique-id', `id "${idText}" is already used by an earlier release`);
      seenIds.add(idText);
    }

    if (date !== undefined) {
      if (!isRealDate(date)) {
        failHere('date-format', `"date" must be a real day written YYYY-MM-DD (got "${date}")`);
      } else {
        if (previousDate !== undefined && date > previousDate) {
          failHere('newest-first', `date ${date} is later than the release above it (${previousDate}); list the newest release first`);
        }
        previousDate = date;
      }
    }

    const bullets = entry.bullets;
    let goodBullets: string[] | undefined;
    if (!Array.isArray(bullets) || bullets.length < 1 || bullets.length > MAX_RELEASE_BULLETS) {
      const count = Array.isArray(bullets) ? bullets.length : 0;
      failHere('bullet-count', `a release needs 1 to ${MAX_RELEASE_BULLETS} bullets (found ${count})`);
    } else {
      goodBullets = [];
      for (const [bulletIndex, bullet] of bullets.entries()) {
        if (typeof bullet !== 'string' || bullet.trim() === '') {
          failHere('required-field', `bullet ${bulletIndex + 1} is empty`);
          goodBullets = undefined;
          break;
        }
        goodBullets.push(bullet);
      }
    }

    if (idText !== undefined && date !== undefined && title !== undefined && goodBullets !== undefined) {
      releases.push({ id: idText, date, title, bullets: goodBullets });
    }
  }
  return { releases, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRealDate(value: string): boolean {
  const match = DATE.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}
