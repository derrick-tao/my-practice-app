// A problem kind's name for a grown-up reading Progress and the lesson preview. Kinds are kebab-case ids
// ("subtract-across-ten"); the label is the same words spaced out ("subtract across ten"), so a new practice type
// only has to pick readable kind ids.
export const kindLabel = (kind: string): string => kind.replaceAll('-', ' ');
