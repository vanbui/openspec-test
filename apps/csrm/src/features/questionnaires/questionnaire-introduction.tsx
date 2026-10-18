import { useId } from 'react';

export interface QuestionnaireIntroductionProps {
  /** The questionnaire's own description, when it has one. */
  description?: string | null;
  /** The number of questions shown when the page loads: the count the completion card starts from. */
  questionCount: number;
  /** Whether any question appears only for certain answers. */
  hasConditionalQuestions: boolean;
  /** D-23: a Security Analyst used AI to help write the questions. */
  aiAssisted?: boolean;
  /** D-16: whether any question offers a `Not sure` choice. */
  offersNotSure?: boolean;
}

/*
 * What a Requestor reads before the first question (10-CONTEXT D-13, UI-SPEC §5.2): why she is being asked,
 * how many questions there are, that her answers save, and what to do when she is unsure. It is built only
 * from facts the page already has, and it promises no "Not sure" choice the form does not offer.
 */
export function QuestionnaireIntroduction({ aiAssisted = false, description, hasConditionalQuestions, offersNotSure = false, questionCount }: QuestionnaireIntroductionProps) {
  const headingId = useId();
  const count = `${questionCount} ${questionCount === 1 ? 'question' : 'questions'}`;
  return (
    <section aria-labelledby={headingId} className="grid w-full min-w-0 max-w-3xl gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-heading-sm text-foreground" id={headingId}>About this questionnaire</h2>
      {description ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground">{description}</p> : null}
      <p className="text-sm text-foreground">
        {`A Security Analyst has sent you ${count} about this request so they can assess its cyber risk.`}
        {hasConditionalQuestions ? ' Depending on your answers, a few more may appear.' : null}
      </p>
      {aiAssisted ? <p className="text-sm text-foreground">A Security Analyst used AI to help write these questions and reviewed them before sending them to you.</p> : null}
      <p className="text-sm text-foreground">Your answers save automatically, so you can stop and finish later. Answer every question marked (required) before you submit. The Security Analyst sees your answers only after you submit.</p>
      <p className="text-sm text-foreground">{offersNotSure
        ? 'Not sure of an answer? Choose “Not sure” where it’s offered. Elsewhere, give your best answer, and where a question asks for text, say what you don’t know. The Security Analyst can send the questionnaire back to you if they need more detail.'
        : 'Not sure of an answer? Give your best answer, and where a question asks for text, say what you don’t know. The Security Analyst can send the questionnaire back to you if they need more detail.'}</p>
    </section>
  );
}
