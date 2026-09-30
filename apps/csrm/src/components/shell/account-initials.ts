const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

/** The first letter-or-digit code point of a word, or undefined when it has none. */
function firstCharacter(word: string): string | undefined {
  return Array.from(word).find((character) => LETTER_OR_DIGIT.test(character));
}

/**
 * Up to two uppercase initials for an account avatar: the first and last words of a name, or of an
 * email address's local part (split on `.`, `_` and `-`). Returns `?` when nothing usable remains.
 */
export function accountInitials(displayName: string): string {
  const trimmed = displayName.trim();
  const isEmail = trimmed.includes('@') && !/\s/.test(trimmed);
  const words = isEmail
    ? (trimmed.split('@')[0] ?? '').split(/[._-]+/)
    : trimmed.split(/\s+/);

  const characters = words
    .map(firstCharacter)
    .filter((character): character is string => character !== undefined);

  const first = characters[0];
  if (first === undefined) return '?';
  const last = characters.length > 1 ? characters[characters.length - 1] : undefined;
  return `${first}${last ?? ''}`.toLocaleUpperCase();
}
