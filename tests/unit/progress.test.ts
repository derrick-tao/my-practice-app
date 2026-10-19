// Unit tests for the pure progress computations (src/practice/progress.ts). The numbers asserted here
// are worked out by hand from the sessions written below, not recomputed with the same logic.
import { describe, expect, it } from 'vitest';
import { listProgress, summarizeAttempt } from '../../src/practice/progress.ts';
import type { Mark, Round, Session } from '../../src/practice/session.ts';

/** A finished round: `marks` in presentation order, e.g. [['a','correct'],['b','wrong']]. */
function finished(index: number, marks: Array<[string, Mark]>): Round {
  return {
    index,
    itemIds: marks.map(([id]) => id),
    position: marks.length,
    phase: 'listening',
    heardCurrent: false,
    marks: Object.fromEntries(marks),
    startedAt: '2026-10-01T10:00:00.000Z',
    completedAt: '2026-10-01T10:05:00.000Z',
  };
}

/** A round with `done` marks made out of `itemIds`. */
function underway(index: number, itemIds: string[], done: Array<[string, Mark]>): Round {
  return {
    index,
    itemIds,
    position: done.length,
    phase: 'listening',
    heardCurrent: false,
    marks: Object.fromEntries(done),
    startedAt: '2026-10-01T10:00:00.000Z',
  };
}

function session(id: string, status: Session['status'], startedAt: string, rounds: Round[]): Session {
  return {
    id,
    profileId: 'p',
    subject: 'chinese',
    practiceType: 'dictation',
    listId: 'list',
    contentVersion: 'v',
    status,
    startedAt,
    rounds,
    undo: null,
    marksSinceBreak: 0,
  };
}

// 5 items: round 1 has 2 misses (c, d), round 2 misses d again, round 3 gets d right.
const threeRounds = session('s1', 'completed', '2026-10-01T10:00:00.000Z', [
  finished(1, [['a', 'correct'], ['b', 'correct'], ['c', 'wrong'], ['d', 'wrong'], ['e', 'correct']]),
  finished(2, [['d', 'wrong'], ['c', 'correct']]),
  finished(3, [['d', 'correct']]),
]);

describe('summarizeAttempt', () => {
  it('scores the first try from round 1 and counts the rounds to complete', () => {
    const attempt = summarizeAttempt(threeRounds);
    expect(attempt.status).toBe('completed');
    expect(attempt.firstTry).toEqual({ correct: 3, total: 5 });
    expect(attempt.roundCount).toBe(3);
  });

  it('describes every round: item count, correct, wrong and the missed items in the order shown', () => {
    const { rounds } = summarizeAttempt(threeRounds);
    expect(
      rounds.map(({ index, itemCount, correct, wrong, missed }) => ({ index, itemCount, correct, wrong, missed })),
    ).toEqual([
      { index: 1, itemCount: 5, correct: 3, wrong: 2, missed: ['c', 'd'] },
      { index: 2, itemCount: 2, correct: 1, wrong: 1, missed: ['d'] },
      { index: 3, itemCount: 1, correct: 1, wrong: 0, missed: [] },
    ]);
  });

  it('has no first-try score until round 1 is over, and counts only what is marked so far', () => {
    const attempt = summarizeAttempt(
      session('s2', 'active', '2026-10-02T10:00:00.000Z', [underway(1, ['a', 'b', 'c'], [['a', 'wrong']])]),
    );
    expect(attempt.firstTry).toBeNull();
    expect(attempt.rounds[0]).toMatchObject({ itemCount: 3, correct: 0, wrong: 1, missed: ['a'], finished: false });
  });

  it('scores a first try once round 1 is over, even while later rounds are still going', () => {
    const attempt = summarizeAttempt(
      session('s3', 'active', '2026-10-02T10:00:00.000Z', [
        finished(1, [['a', 'wrong'], ['b', 'correct']]),
        underway(2, ['a'], []),
      ]),
    );
    expect(attempt.firstTry).toEqual({ correct: 1, total: 2 });
    expect(attempt.roundCount).toBe(2);
    expect(attempt.rounds.map((r) => r.finished)).toEqual([true, false]);
  });
});

describe('listProgress', () => {
  it('lists attempts newest first and counts them all', () => {
    const progress = listProgress(
      [
        session('old', 'completed', '2026-10-01T10:00:00.000Z', [finished(1, [['a', 'correct']])]),
        session('new', 'stopped', '2026-10-09T10:00:00.000Z', [underway(1, ['a'], [])]),
        session('mid', 'active', '2026-10-05T10:00:00.000Z', [underway(1, ['a'], [])]),
      ],
      ['a'],
    );
    expect(progress.attempts.map((a) => a.id)).toEqual(['new', 'mid', 'old']);
    expect(progress.attemptCount).toBe(3);
  });

  // Completed first tries 2/4, (stopped 4/4, ignored), 3/4, 4/4 in start order.
  const sequence = [
    session('c3', 'completed', '2026-10-09T10:00:00.000Z', [
      finished(1, [['a', 'correct'], ['b', 'correct'], ['c', 'correct'], ['d', 'correct']]),
    ]),
    session('c1', 'completed', '2026-10-01T10:00:00.000Z', [
      finished(1, [['a', 'correct'], ['b', 'correct'], ['c', 'wrong'], ['d', 'wrong']]),
      finished(2, [['c', 'correct'], ['d', 'correct']]),
    ]),
    session('st', 'stopped', '2026-10-05T10:00:00.000Z', [
      finished(1, [['a', 'correct'], ['b', 'correct'], ['c', 'correct'], ['d', 'correct']]),
    ]),
    session('c2', 'completed', '2026-10-07T10:00:00.000Z', [
      finished(1, [['a', 'correct'], ['b', 'correct'], ['c', 'correct'], ['d', 'wrong']]),
      finished(2, [['d', 'correct']]),
    ]),
  ];

  it('trends the first-try counts of completed attempts, oldest first, leaving out the stopped one', () => {
    expect(listProgress(sequence, ['a', 'b', 'c', 'd']).trend).toEqual([2, 3, 4]);
  });

  it('takes the best first try from completed attempts only', () => {
    const stoppedOnly = listProgress([sequence[2]!], ['a']);
    expect(stoppedOnly.best).toBeNull();
    expect(stoppedOnly.trend).toEqual([]);
    const withStopped = listProgress([sequence[2]!, sequence[1]!], ['a']);
    expect(withStopped.best).toEqual({ correct: 2, total: 4 });
  });

  it('ignores an in-progress attempt in trend and best', () => {
    const progress = listProgress(
      [session('p', 'active', '2026-10-02T10:00:00.000Z', [finished(1, [['a', 'correct']]), underway(2, ['a'], [])])],
      ['a'],
    );
    expect(progress.best).toBeNull();
    expect(progress.trend).toEqual([]);
  });

  it('ranks the trickiest items by total wrong marks over every round of every attempt, stopped ones included', () => {
    // c: wrong in c1 r1; d: wrong in c1 r1, c2 r1, ... ; counts worked out by hand below.
    const many = [
      session('x', 'completed', '2026-10-01T10:00:00.000Z', [
        finished(1, [['a', 'wrong'], ['b', 'wrong'], ['c', 'wrong'], ['d', 'correct']]),
        finished(2, [['a', 'wrong'], ['b', 'correct'], ['c', 'correct']]),
        finished(3, [['a', 'correct']]),
      ]),
      session('y', 'stopped', '2026-10-02T10:00:00.000Z', [
        underway(1, ['a', 'b', 'c', 'd'], [['c', 'wrong'], ['a', 'wrong']]),
      ]),
    ];
    // a: 3, c: 2, b: 1.
    expect(listProgress(many, ['a', 'b', 'c', 'd']).trickiest).toEqual([
      { id: 'a', wrong: 3 },
      { id: 'c', wrong: 2 },
      { id: 'b', wrong: 1 },
    ]);
  });

  it('breaks ties in list order, with items the list no longer has last, and stops at ten', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
    const oneMissEach = session('t', 'completed', '2026-10-01T10:00:00.000Z', [
      finished(1, [...ids.map((id): [string, Mark] => [id, 'wrong']), ['gone', 'wrong']]),
    ]);
    const { trickiest } = listProgress([oneMissEach], ids);
    expect(trickiest.map((t) => t.id)).toEqual(ids.slice(0, 10));
    // Only a and b are still listed: they come first, the rest (removed) follow.
    const onlyTwoListed = listProgress([oneMissEach], ['a', 'b']);
    expect(onlyTwoListed.trickiest.slice(0, 2).map((t) => t.id)).toEqual(['a', 'b']);
    expect(onlyTwoListed.trickiest).toHaveLength(10);
  });
});
