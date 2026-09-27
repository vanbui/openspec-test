import { z } from 'zod';

export const questionnaireAnswerTypes = [
  'Text',
  'Long text',
  'Boolean',
  'Single select',
  'Multi select',
  'Date',
  'File upload',
] as const;

export const questionnaireAnswerTypeSchema = z.enum(questionnaireAnswerTypes);
export type QuestionnaireAnswerType = z.infer<typeof questionnaireAnswerTypeSchema>;

export const questionnaireSectionSchema = z.object({
  key: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(255),
  description: z.string().trim().min(1).max(2_000).optional(),
  order: z.number().int().nonnegative(),
}).strict();

export const questionnaireChoiceSchema = z.object({
  value: z.string().trim().min(1).max(255),
  label: z.string().trim().min(1).max(255),
}).strict();

export const visibilityConditionSchema = z.object({
  questionKey: z.string().trim().min(1).max(120),
  operator: z.enum(['equals', 'notEquals', 'includes', 'notIncludes']),
  value: z.union([z.string().max(65_535), z.boolean()]),
}).strict();

export const questionDeletionSchema = z.object({
  deletedAt: z.iso.datetime({ offset: true }),
  deletedBy: z.string().trim().min(1).max(255),
}).strict();

/*
 * Version 2 adds the deletion marker an Analyst sets when a question leaves the
 * active questionnaire but has to stay in its history. Version 1 envelopes
 * predate that marker and never carry one, so the two versions are parsed as a
 * discriminated union rather than by loosening version 1.
 */
export const questionOptionsSchema = z.discriminatedUnion('schemaVersion', [
  z.object({
    schemaVersion: z.literal(1),
    questionKey: z.string().trim().min(1).max(120),
    section: questionnaireSectionSchema,
    order: z.number().int().nonnegative(),
    required: z.boolean(),
    visibility: visibilityConditionSchema.optional(),
    choices: z.array(questionnaireChoiceSchema).min(1).max(1_000).optional(),
  }).strict(),
  z.object({
    schemaVersion: z.literal(2),
    questionKey: z.string().trim().min(1).max(120),
    section: questionnaireSectionSchema,
    order: z.number().int().nonnegative(),
    required: z.boolean(),
    visibility: visibilityConditionSchema.optional(),
    choices: z.array(questionnaireChoiceSchema).min(1).max(1_000).optional(),
    deleted: questionDeletionSchema.optional(),
  }).strict(),
]);

const timestampSchema = z.iso.datetime({ offset: true });

function valueSchemaFor(answerType: QuestionnaireAnswerType) {
  switch (answerType) {
    case 'Text':
    case 'Long text':
    case 'Single select':
      return z.union([z.string().max(65_535), z.null()]);
    case 'Boolean':
      return z.union([z.boolean(), z.null()]);
    case 'Multi select':
      return z.union([z.array(z.string().max(255)).max(1_000), z.null()]);
    case 'Date':
      return z.union([z.iso.date(), z.null()]);
    case 'File upload':
      return z.null();
  }
}

export function answerEnvelopeSchema(answerType: QuestionnaireAnswerType) {
  const value = valueSchemaFor(answerType);
  return z.discriminatedUnion('state', [
    z.object({
      schemaVersion: z.literal(1),
      value,
      state: z.literal('draft'),
      updatedAt: timestampSchema,
    }).strict(),
    z.object({
      schemaVersion: z.literal(1),
      value,
      state: z.literal('submitted'),
      updatedAt: timestampSchema,
      submittedAt: timestampSchema,
    }).strict(),
  ]);
}

export type QuestionnaireAnswer = z.infer<ReturnType<typeof answerEnvelopeSchema>>;

export const questionnaireAnswerInputSchema = z.object({
  questionKey: z.string().trim().min(1).max(120),
  value: z.union([
    z.string().max(65_535),
    z.boolean(),
    z.array(z.string().max(255)).max(1_000),
    z.null(),
  ]),
});

export type QuestionnaireAnswerInput = z.infer<typeof questionnaireAnswerInputSchema>;

const questionnaireQuestionTransportSchema = z.object({
  documentId: z.string().trim().min(1).max(255).optional(),
  questionText: z.string().trim().min(1).max(65_535),
  answerType: questionnaireAnswerTypeSchema,
  options: questionOptionsSchema,
  answer: z.unknown().nullable().optional(),
}).strict().superRefine((question, context) => {
  const choices = question.options.choices;
  const isChoiceQuestion = question.answerType === 'Single select' || question.answerType === 'Multi select';

  if (isChoiceQuestion !== Boolean(choices)) {
    context.addIssue({
      code: 'custom',
      path: ['options', 'choices'],
      message: isChoiceQuestion
        ? 'Select questions require choices.'
        : 'Choices are allowed only for select questions.',
    });
  }

  if (choices && new Set(choices.map(({ value }) => value)).size !== choices.length) {
    context.addIssue({
      code: 'custom',
      path: ['options', 'choices'],
      message: 'Choice values must be unique.',
    });
  }

  if (question.answer !== null && question.answer !== undefined) {
    const parsedAnswer = answerEnvelopeSchema(question.answerType).safeParse(question.answer);
    if (!parsedAnswer.success) {
      // Each rejection keeps its own path inside the envelope, and a refused key
      // its name, so the contract parity guard can tell a narrowing of one
      // envelope field from drift in another (G2). The answer is refused in
      // exactly the same cases as before.
      for (const issue of parsedAnswer.error.issues) {
        context.addIssue({ ...issue, path: ['answer', ...issue.path] });
      }
    } else if (choices && parsedAnswer.data.value !== null) {
      const allowedValues = new Set(choices.map(({ value }) => value));
      const values = Array.isArray(parsedAnswer.data.value)
        ? parsedAnswer.data.value
        : [parsedAnswer.data.value];
      if (values.some((value) => typeof value !== 'string' || !allowedValues.has(value))) {
        context.addIssue({
          code: 'custom',
          path: ['answer', 'value'],
          message: 'Answer contains a value outside the configured choices.',
        });
      }
    }
  }
});

function compareQuestionOrder(
  left: z.infer<typeof questionnaireQuestionTransportSchema>,
  right: z.infer<typeof questionnaireQuestionTransportSchema>,
) {
  return left.options.section.order - right.options.section.order
    || left.options.order - right.options.order;
}

function conditionMatchesTargetType(
  condition: z.infer<typeof visibilityConditionSchema>,
  targetType: QuestionnaireAnswerType,
) {
  if (condition.operator === 'includes' || condition.operator === 'notIncludes') {
    return targetType === 'Multi select' && typeof condition.value === 'string';
  }
  if (targetType === 'Boolean') return typeof condition.value === 'boolean';
  if (targetType === 'Multi select' || targetType === 'File upload') return false;
  return typeof condition.value === 'string';
}

export const questionnaireDefinitionSchema = z.array(questionnaireQuestionTransportSchema)
  .min(1)
  .max(10_000)
  .superRefine((questions, context) => {
    const questionsByKey = new Map<string, (typeof questions)[number]>();
    const sectionByKey = new Map<string, (typeof questions)[number]['options']['section']>();
    const sectionKeysByOrder = new Map<number, string>();
    const questionOrders = new Set<string>();

    for (const [index, question] of questions.entries()) {
      const { questionKey, section, order, visibility } = question.options;
      if (questionsByKey.has(questionKey)) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'questionKey'], message: 'Question keys must be unique.' });
      }
      questionsByKey.set(questionKey, question);

      const knownSection = sectionByKey.get(section.key);
      if (knownSection && JSON.stringify(knownSection) !== JSON.stringify(section)) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'section'], message: 'Section metadata must be consistent.' });
      }
      sectionByKey.set(section.key, section);

      const keyAtOrder = sectionKeysByOrder.get(section.order);
      if (keyAtOrder && keyAtOrder !== section.key) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'section', 'order'], message: 'Section order must be unique.' });
      }
      sectionKeysByOrder.set(section.order, section.key);

      const orderKey = `${section.key}:${order}`;
      if (questionOrders.has(orderKey)) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'order'], message: 'Question order must be unique within a section.' });
      }
      questionOrders.add(orderKey);

      if (visibility?.questionKey === questionKey) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'visibility'], message: 'A question cannot depend on itself.' });
      }
    }

    const ordered = [...questions].sort(compareQuestionOrder);
    const orderByKey = new Map(ordered.map((question, index) => [question.options.questionKey, index]));

    for (const [index, question] of questions.entries()) {
      const condition = question.options.visibility;
      if (!condition) continue;

      const target = questionsByKey.get(condition.questionKey);
      if (!target) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'visibility', 'questionKey'], message: 'Condition target does not exist.' });
        continue;
      }
      if ((orderByKey.get(condition.questionKey) ?? Number.MAX_SAFE_INTEGER) >= (orderByKey.get(question.options.questionKey) ?? -1)) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'visibility', 'questionKey'], message: 'Conditions may reference only earlier questions.' });
      }
      if (!conditionMatchesTargetType(condition, target.answerType)) {
        context.addIssue({ code: 'custom', path: [index, 'options', 'visibility'], message: 'Condition operator or value is incompatible with its target.' });
      }
    }

    for (const question of questions) {
      const visited = new Set<string>();
      let current: (typeof questions)[number] | undefined = question;
      while (current?.options.visibility) {
        const currentKey = current.options.questionKey;
        if (visited.has(currentKey)) {
          context.addIssue({ code: 'custom', path: ['options', 'visibility'], message: 'Conditional graph must not contain cycles.' });
          break;
        }
        visited.add(currentKey);
        current = questionsByKey.get(current.options.visibility.questionKey);
      }
    }
  })
  .transform((questions) => questions.map((question) => {
    const parsedAnswer = question.answer === null || question.answer === undefined
      ? null
      : answerEnvelopeSchema(question.answerType).parse(question.answer);
    return {
      ...(question.documentId ? { documentId: question.documentId } : {}),
      questionText: question.questionText,
      answerType: question.answerType,
      ...question.options,
      answer: parsedAnswer,
      support: question.answerType === 'File upload'
        ? { status: 'unsupported' as const, reason: 'file-upload-deferred' as const }
        : { status: 'supported' as const },
    };
  }));

export type QuestionnaireQuestion = z.output<typeof questionnaireDefinitionSchema>[number];
export type QuestionnaireDefinition = z.output<typeof questionnaireDefinitionSchema>;
