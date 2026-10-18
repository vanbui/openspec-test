import { Sparkles } from 'lucide-react';

/*
 * The Requestor's disclosure (12-UI-SPEC §10, X-11; D-23): AI helped and a Security Analyst reviewed. It names no
 * provider, model or marker, and it prints with the assessment.
 */
export function AiAssistanceNotice() {
  return (
    <p className="flex items-start gap-2 text-sm text-foreground-secondary">
      <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.</span>
    </p>
  );
}
