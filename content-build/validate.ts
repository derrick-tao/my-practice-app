// Validation of list files. Every problem names the file, the item (when relevant) and the rule.
import { parse as parseYaml } from 'yaml';
import * as OpenCC from 'opencc-js';
import type { PracticeTypeId, Script } from '../src/content/types.ts';

export interface SourceItem {
  target: string;
  clue?: string;
  pinyin?: string;
  lesson?: string;
  say?: string;
}

export interface SourceList {
  id: string;
  title: string;
  subject: string;
  practiceTypes: PracticeTypeId[];
  script: Script;
  testDates?: string;
  items: SourceItem[];
}

export interface Issue {
  /** Path relative to the content dir, with forward slashes. */
  file: string;
  /** 1-based item number, for item-level issues. */
  itemNumber?: number;
  target?: string;
  rule: string;
  message: string;
}

export function formatIssue(issue: Issue): string {
  const item =
    issue.itemNumber === undefined
      ? ''
      : `item ${issue.itemNumber}${issue.target ? ` (${issue.target})` : ''}: `;
  return `${issue.file}: ${item}[${issue.rule}] ${issue.message}`;
}

const SCRIPTS: readonly string[] = ['simplified', 'traditional'];
const PRACTICE_TYPES: readonly string[] = ['dictation'];
const LIST_KEYS = ['id', 'title', 'subject', 'practiceTypes', 'script', 'testDates', 'items'];
const ITEM_KEYS = ['target', 'clue', 'pinyin', 'lesson', 'say'];
const HAN = /^\p{Script=Han}+$/u;

const toTraditional = OpenCC.Converter({ from: 'cn', to: 't' });
const toSimplified = OpenCC.Converter({ from: 't', to: 'cn' });

export interface FileResult {
  list?: SourceList;
  errors: Issue[];
  warnings: Issue[];
}

/** Validate one list file's text. `file` is relative to the content dir. */
export function validateListFile(file: string, text: string): FileResult {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  const fail = (rule: string, message: string, item?: { number: number; target?: string }): void => {
    errors.push({ file, rule, message, ...(item && { itemNumber: item.number, target: item.target }) });
  };

  let doc: unknown;
  try {
    doc = parseYaml(text);
  } catch (error) {
    fail('yaml-syntax', error instanceof Error ? error.message.split('\n')[0]! : String(error));
    return { errors, warnings };
  }
  if (!isRecord(doc)) {
    fail('yaml-syntax', 'the file must contain a mapping of list fields (id, title, subject, ...)');
    return { errors, warnings };
  }

  for (const key of Object.keys(doc)) {
    if (!LIST_KEYS.includes(key)) {
      fail('unknown-key', `unknown list field "${key}" (allowed: ${LIST_KEYS.join(', ')})`);
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

  let practiceTypes: PracticeTypeId[] | undefined;
  if (doc.practiceTypes === undefined || doc.practiceTypes === null) {
    fail('required-field', 'required field "practiceTypes" is missing');
  } else if (!Array.isArray(doc.practiceTypes) || doc.practiceTypes.length === 0) {
    fail('invalid-value', '"practiceTypes" must be a non-empty list, e.g. [dictation]');
  } else {
    const bad = doc.practiceTypes.filter((t) => typeof t !== 'string' || !PRACTICE_TYPES.includes(t));
    if (bad.length > 0) {
      fail('invalid-value', `"practiceTypes" has unsupported value(s) ${bad.map(String).join(', ')} (allowed: ${PRACTICE_TYPES.join(', ')})`);
    } else {
      practiceTypes = doc.practiceTypes as PracticeTypeId[];
    }
  }

  const items: SourceItem[] = [];
  if (doc.items === undefined || doc.items === null) {
    fail('required-field', 'required field "items" is missing');
  } else if (!Array.isArray(doc.items) || doc.items.length === 0) {
    fail('required-field', '"items" must contain at least one item');
  } else {
    const firstSeen = new Map<string, number>();
    doc.items.forEach((raw: unknown, index: number) => {
      const number = index + 1;
      if (!isRecord(raw)) {
        fail('invalid-value', 'each item must be a mapping with a "target"', { number });
        return;
      }
      const rawTarget = typeof raw.target === 'string' ? raw.target : undefined;
      const at = { number, ...(rawTarget ? { target: rawTarget } : {}) };
      const itemFail = (rule: string, message: string): void => fail(rule, message, at);

      for (const key of Object.keys(raw)) {
        if (!ITEM_KEYS.includes(key)) {
          itemFail('unknown-key', `unknown item field "${key}" (allowed: ${ITEM_KEYS.join(', ')})`);
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

      const clue = optionalString(raw, 'clue', itemFail);
      const pinyin = optionalString(raw, 'pinyin', itemFail, true);
      const lesson = optionalString(raw, 'lesson', itemFail);
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
          ...(lesson !== undefined && { lesson }),
          ...(say !== undefined && { say }),
        });
      }

      if (target !== undefined && (script === 'simplified' || script === 'traditional')) {
        if (looksLikeOtherScript(script, `${target}${clue ?? ''}`)) {
          warnings.push({
            file,
            itemNumber: number,
            target,
            rule: 'script-mismatch',
            message: `characters look ${script === 'simplified' ? 'traditional' : 'simplified'}, but the list script is ${script}`,
          });
        }
      }
    });
  }

  if (errors.length > 0 || !id || !title || !subject || !script || !practiceTypes) {
    return { errors, warnings };
  }
  return {
    list: {
      id,
      title,
      subject,
      practiceTypes,
      script: script as Script,
      ...(testDates !== undefined && { testDates }),
      items,
    },
    errors,
    warnings,
  };
}

/** Cross-file rules. */
export function validateAcrossFiles(parsed: Array<{ file: string; list: SourceList }>): Issue[] {
  const errors: Issue[] = [];
  const byId = new Map<string, string>();
  for (const { file, list } of parsed) {
    const other = byId.get(list.id);
    if (other !== undefined) {
      errors.push({
        file,
        rule: 'id-unique',
        message: `id "${list.id}" is also used by ${other}`,
      });
    } else {
      byId.set(list.id, file);
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
