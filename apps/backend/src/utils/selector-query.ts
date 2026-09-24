/**
 * A Requestor selector call and an Administration inventory list share one HTTP
 * path, and are told apart by the shape of the query.
 *
 * The authorization policy uses this to decide which FunctionAPI grant the call
 * requires, and the Administration controller uses it to decide which handler
 * runs. Those two decisions must agree exactly: if the policy ever authorized a
 * call as a bounded selector while the controller ran the full inventory list, a
 * Requestor holding only the selector grant would read the whole inventory.
 * Keeping one predicate is what makes that impossible to get wrong.
 *
 * A call is a selector when it is either an explicit search (`q`) or a bare
 * page, and never when it orders the collection — ordering is the mark of an
 * Administration list. Anything else the caller sends, `populate` included, is
 * an Administration-shaped query and is authorized as one, so a malformed
 * Administration query is still refused before it is parsed.
 */
const SELECTOR_KEYS = ["q", "page", "pageSize"] as const;

export function isSelectorQuery(query: Record<string, unknown>): boolean {
  const keys = Object.keys(query);
  const has = (key: string) => Object.prototype.hasOwnProperty.call(query, key);
  if (has("sort") || has("search")) return false;
  if (has("q")) return true;
  return keys.every((key) => (SELECTOR_KEYS as readonly string[]).includes(key));
}
