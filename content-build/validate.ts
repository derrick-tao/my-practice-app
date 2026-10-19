// Validation of lesson files. Every problem names the file, the practice type and item (when relevant) and the rule.
import { parse as parseYaml } from 'yaml';
import * as OpenCC from 'opencc-js';
import { PRACTICE_TYPE_IDS, type PracticeTypeId, type Script } from '../src/content/types.ts';

export interface SourceItem {
  target: string;
  clue?: string;
  pinyin?: string;
  say?: string;
}

export interface SourceLesson {
  id: string;
  title: string;
  subject: string;
  script: Script;
  testDates?: string;
  /** The lesson's lists, one per practice type it offers (each non-empty). */
  lists: Partial<Record<PracticeTypeId, SourceItem[]>>;
}

export interface Issue {
  /** Path relative to the content dir, with forward slashes. */
  file: string;
  /** The practice type (list) the issue is in, when it is in one. */
  practiceType?: string;
  /** 1-based item number within that list, for item-level issues. */
  itemNumber?: number;
  target?: string;
  rule: string;
  message: string;
}

export function formatIssue(issue: Issue): string {
  const item =
    issue.itemNumber === undefined
      ? ''
      : `item ${issue.itemNumber}${issue.target ? ` (${issue.target})` : ''}`;
  const scope = [issue.practiceType, item].filter(Boolean).join(' ');
  return `${issue.file}: ${scope ? `${scope}: ` : ''}[${issue.rule}] ${issue.message}`;
}

const SCRIPTS: readonly string[] = ['simplified', 'traditional'];
const LESSON_KEYS: readonly string[] = ['id', 'title', 'subject', 'script', 'testDates'];
/** The fields an item may have, per practice type. A lesson's keys are LESSON_KEYS plus one list key per practice type. */
const ITEM_KEYS: Record<PracticeTypeId, readonly string[]> = {
  dictation: ['target', 'clue', 'pinyin', 'say'],
  'phrase-recognition': ['target', 'pinyin', 'say'],
};
const HAN = /^\p{Script=Han}+$/u;

const toTraditional = OpenCC.Converter({ from: 'cn', to: 't' });
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

export interface FileResult {
  lesson?: SourceLesson;
  errors: Issue[];
  warnings: Issue[];
}

/** Validate one lesson file's text. `file` is relative to the content dir. */
export function validateLessonFile(file: string, text: string): FileResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const fail = (rule: string, message: string, at?: Place): void => {
    errors.push({ file, rule, message, ...at });
  };

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (error) {
    fail('yaml-syntax', error instanceof Error ? error.message.split('\n')[0]! : String(error));
    return { errors, warnings };
  }
  if (!isRecord(doc)) {
    fail('yaml-syntax', 'the file must contain a mapping of lesson fields (id, title, subject, ...)');
    return { errors, warnings };
  }

  const allowed = [...LESSON_KEYS, ...PRACTICE_TYPE_IDS];
  for (const key of Object.keys(doc)) {
    if (!allowed.includes(key)) {
      fail(
        'unknown-key',
        `unknown lesson field "${key}" (allowed: ${LESSON_KEYS.join(', ')}, and a list per practice type: ${PRACTICE_TYPE_IDS.join(', ')})`,
        Array.isArray(doc[key]) ? { practiceType: key } : undefined,
      );
    }
  }

  const id = requiredString(doc, 'id', fail);
  const title = requiredString(doc, 'title', fail);
  const subject = requiredString(doc, 'subject', fail);
  const script = requiredString(doc, 'script', fail);
  const testDates = optionalString(doc, 'testDates', fail);

  const expectedId = file.replace(/^.*\//, '').replace(/\.yaml$/, '');
  if (id !== undefined && id !== expectedId) {
    fail('id-matches-filename', `id "${id}" must equal the file name "${expectedId}"`);
  }
  if (script !== undefined && !SCRIPTS.includes(script)) {
    fail('invalid-value', `"script" must be one of ${SCRIPTS.join(', ')} (got "${script}")`);
  }
  if (subject !== undefined && !/^[a-z][a-z0-9-]*$/.test(subject)) {
    fail('invalid-value', `"subject" must be a lowercase word such as "chinese" (got "${subject}")`);
  }

  const lists: SourceLesson['lists'] = {};
  const present = PRACTICE_TYPE_IDS.filter((type) => doc[type] !== undefined);
  if (present.length === 0) {
    fail('no-lists', `a lesson needs at least one list of items: ${PRACTICE_TYPE_IDS.map((t) => `"${t}"`).join(' or ')}`);
  }
  for (const type of present) {
    const raw = doc[type];
    if (!Array.isArray(raw) || raw.length === 0) {
      fail('empty-list', `the "${type}" list must contain at least one item`, { practiceType: type });
      continue;
    }
    lists[type] = validateList(type, raw, { subject, script, fail, warnings, file });
  }

  if (errors.length > 0 || !id || !title || !subject || !script) {
    return { errors, warnings };
  }
  return {
    lesson: {
      id,
      title,
      subject,
      script: script as Script,
      ...(testDates !== undefined && { testDates }),
      lists,
    },
    errors,
    warnings,
  };
}

interface Place {
  practiceType?: string;
  itemNumber?: number;
  target?: string;
}

interface ListContext {
  file: string;
  subject: string | undefined;
  script: string | undefined;
  fail: (rule: string, message: string, at?: Place) => void;
  warnings: Issue[];
}

/** Validate one practice type's list; returns the items that are usable (the caller only keeps them when the file has no errors). */
function validateList(type: PracticeTypeId, rawItems: unknown[], context: ListContext): SourceItem[] {
  const { file, subject, script, fail, warnings } = context;
  const itemKeys = ITEM_KEYS[type];
  const items: SourceItem[] = [];
  const firstSeen = new Map<string, number>();

  rawItems.forEach((raw: unknown, index: number) => {
    const number = index + 1;
    if (!isRecord(raw)) {
      fail('invalid-value', 'each item must be a mapping with a "target"', { practiceType: type, itemNumber: number });
      return;
    }
    const rawTarget = typeof raw.target === 'string' ? raw.target : undefined;
    const at: Place = { practiceType: type, itemNumber: number, ...(rawTarget ? { target: rawTarget } : {}) };
    const itemFail = (rule: string, message: string): void => fail(rule, message, at);

    for (const key of Object.keys(raw)) {
      if (!itemKeys.includes(key)) {
        itemFail('unknown-key', `unknown item field "${key}" (allowed: ${itemKeys.join(', ')})`);
      }
    }

    let target: string | undefined;
    if (raw.target === undefined || raw.target === null) {
      itemFail('required-field', 'required field "target" is missing');
    } else if (typeof raw.target !== 'string') {
      itemFail('invalid-value', '"target" must be text (put quotes around it if needed)');
    } else if (raw.target.trim() === '') {
      itemFail('target-empty', 'the target must not be empty');
    } else {
      target = raw.target.trim();
      if (subject === 'chinese' && !HAN.test(target)) {
        itemFail('target-cjk', `target "${target}" must contain only Chinese characters`);
      }
      const first = firstSeen.get(target);
      if (first !== undefined) {
        itemFail('target-duplicate', `target "${target}" repeats item ${first}`);
      } else {
        firstSeen.set(target, number);
      }
    }

    const clue = itemKeys.includes('clue') ? optionalString(raw, 'clue', itemFail) : undefined;
    const pinyin = optionalString(raw, 'pinyin', itemFail, true);
    const say = optionalString(raw, 'say', itemFail);

    if (target !== undefined && clue !== undefined && !clue.includes(target)) {
      itemFail('clue-contains-target', `clue "${clue}" must contain the target "${target}"`);
    }
    if (pinyin !== undefined) {
      const problem = pinyinProblem(pinyin);
      if (problem) {
        itemFail('pinyin-format', problem);
      } else if (target !== undefined) {
        const syllables = pinyin.normalize('NFC').trim().split(/\s+/).length;
        const length = [...target].length;
        if (syllables !== length) {
          itemFail(
            'pinyin-syllable-count',
            `pinyin "${pinyin}" has ${syllables} syllable(s) but the target "${target}" has ${length} character(s)`,
          );
        }
      }
    }

    if (target !== undefined) {
      items.push({
        target,
        ...(clue !== undefined && { clue }),
        ...(pinyin !== undefined && { pinyin: pinyin.normalize('NFC').trim() }),
        ...(say !== undefined && { say }),
      });
    }

    if (target !== undefined && (script === 'simplified' || script === 'traditional')) {
      if (looksLikeOtherScript(script, `${target}${clue ?? ''}`)) {
        warnings.push({
          file,
          practiceType: type,
          itemNumber: number,
          target,
          rule: 'script-mismatch',
          message: `characters look ${script === 'simplified' ? 'traditional' : 'simplified'}, but the lesson script is ${script}`,
        });
      }
    }
  });
  return items;
}

/** Cross-file rules. */
export function validateAcrossFiles(parsed: Array<{ file: string; lesson: SourceLesson }>): Issue[] {
  const errors: Issue[] = [];
  const byId = new Map<string, string>();
  for (const { file, lesson } of parsed) {
    const other = byId.get(lesson.id);
    if (other !== undefined) {
      errors.push({
        file,
        rule: 'id-unique',
        message: `id "${lesson.id}" is also used by ${other}`,
      });
    } else {
      byId.set(lesson.id, file);
    }
  }
  return errors;
}

function looksLikeOtherScript(script: Script, text: string): boolean {
  return script === 'simplified' ? toSimplified(text) !== text : toTraditional(text) !== text;
}

const TONED = 'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ';
const SYLLABLE = new RegExp(`^[a-zü${TONED}]+$`, 'i');
const VOWEL = new RegExp(`[aeiouü${TONED}]`, 'i');

function pinyinProblem(pinyin: string): string | undefined {
  const syllables = pinyin.normalize('NFC').trim().split(/\s+/);
  if (syllables.length === 0 || syllables[0] === '') {
    return 'pinyin must not be empty (omit it to have it generated)';
  }
  for (const syllable of syllables) {
    const tones = [...syllable].filter((c) => TONED.includes(c.toLowerCase())).length;
    if (!SYLLABLE.test(syllable) || !VOWEL.test(syllable) || tones > 1 || syllable.length > 7) {
      return `pinyin syllable "${syllable}" is malformed; use tone marks and spaces, e.g. "zuò yè"`;
    }
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Fail = (rule: string, message: string) => void;

function requiredString(source: Record<string, unknown>, key: string, fail: Fail): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) {
    fail('required-field', `required field "${key}" is missing`);
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    fail('invalid-value', `"${key}" must be non-empty text`);
    return undefined;
  }
  return value.trim();
}

/** `allowEmpty` lets an empty string through so the caller can report a field-specific rule. */
function optionalString(
  source: Record<string, unknown>,
  key: string,
  fail: Fail,
  allowEmpty = false,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    fail('invalid-value', `"${key}" must be text (put quotes around it if needed)`);
    return undefined;
  }
  if (value.trim() === '' && !allowEmpty) return undefined;
  return value.trim();
}
