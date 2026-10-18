import { LockKeyhole } from 'lucide-react';

/*
 * The Answered note (X-26; 15-UI-SPEC §7.1; D-05, D-30): an answered question the AI may not change or remove. It says an
 * answer exists, never the answer or whether it is a draft, and renders only from the served `answered` flag, which the
 * server omits while the Requestor is answering a released questionnaire (T-15-44). Server-safe: no directive, no state.
 */
export function AnsweredQuestionNote() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-foreground-secondary" data-answered-note="">
      <LockKeyhole aria-hidden="true" className="size-3" />Answered<span className="sr-only"> - the AI can’t change or remove it</span>
    </span>
  );
}
