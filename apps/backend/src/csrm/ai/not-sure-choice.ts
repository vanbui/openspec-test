/*
 * D-16, WR-02 and IN-110: every generated choice question offers "Not sure" exactly once, as the canonical choice the
 * Requestor's introduction looks for (its value `not-sure`). A model choice that means the same is that choice, where
 * the model put it, and a second one is dropped; when the model offered none, it is added last. Equivalence is this
 * closed list, compared without regard to case, spacing, hyphens, underscores, apostrophes or a closing full stop, so a
 * model's own `not-sure` value is never offered twice.
 *
 * Phase 15 N-1: moved unchanged from the questionnaire generation provider, so questionnaire generation and questionnaire
 * proposals (D-13's "Not sure ensured last", read as this rule) share the one rule.
 */
export const NOT_SURE_CHOICE = { value: "not-sure", label: "Not sure" } as const;
const NOT_SURE_EQUIVALENTS: ReadonlySet<string> = new Set([
  "not sure", "unsure", "dont know", "do not know", "i dont know", "i do not know", "im not sure", "i am not sure", "unknown",
]);
function comparableChoice(text: string): string {
  return text.toLowerCase().replace(/['‘’ʼ`´]/g, "").replace(/[\s_-]+/g, " ").trim().replace(/[.!?]+$/, "").trim();
}
export function isNotSureEquivalent(choice: string): boolean {
  return NOT_SURE_EQUIVALENTS.has(comparableChoice(choice));
}
export function withCanonicalNotSure(choices: readonly string[]): { value: string; label: string }[] {
  const result: { value: string; label: string }[] = [];
  let offered = false;
  for (const choice of choices) {
    if (!isNotSureEquivalent(choice)) result.push({ value: choice, label: choice });
    else if (!offered) { result.push({ ...NOT_SURE_CHOICE }); offered = true; }
  }
  return offered ? result : [...result, { ...NOT_SURE_CHOICE }];
}
