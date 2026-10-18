const STOP_WORDS = new Set(["and", "are", "for", "from", "has", "have", "into", "its", "not", "the", "their", "this", "that", "was", "were", "with"]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((word) => !STOP_WORDS.has(word));
}

export function rankByRelevance<T>(query: string, documents: readonly T[], limit: number, text: (document: T) => string, id: (document: T) => string): T[] {
  const terms = new Set(tokenize(query));
  const indexed = documents.map((document) => ({ document, words: new Set(tokenize(text(document))) }));
  const frequency = new Map<string, number>();
  for (const { words } of indexed) for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1);
  return indexed.map(({ document, words }) => ({
    document,
    score: [...terms].reduce((score, word) => score + (words.has(word) ? Math.log(1 + (documents.length + 1) / ((frequency.get(word) ?? 0) + 1)) : 0), 0),
  })).sort((left, right) => right.score - left.score || (id(left.document) < id(right.document) ? -1 : id(left.document) > id(right.document) ? 1 : 0))
    .slice(0, limit).map(({ document }) => document);
}
