export const QUESTIONNAIRE_ANSWER_TYPES = [
  "Text",
  "Long text",
  "Boolean",
  "Single select",
  "Multi select",
  "Date",
  "File upload",
] as const;

export type QuestionnaireAnswerType = (typeof QUESTIONNAIRE_ANSWER_TYPES)[number];
export type QuestionnaireValue = string | boolean | string[] | null;
export type VisibilityOperator = "equals" | "notEquals" | "includes" | "notIncludes";
type RecordValue = Record<string, unknown>;

export type QuestionnaireDefinitionQuestion = {
  documentId: string;
  questionText: string;
  answerType: QuestionnaireAnswerType;
  questionKey: string;
  section: { key: string; title: string; description?: string; order: number };
  order: number;
  required: boolean;
  visibility?: { questionKey: string; operator: VisibilityOperator; value: string | boolean };
  choices?: Array<{ value: string; label: string }>;
  /** Version of the persisted options envelope, retained for lossless writes. */
  schemaVersion: 1 | 2;
  deleted?: { deletedAt: string; deletedBy: string };
  answer: unknown;
};

export class QuestionnaireDefinitionError extends Error {
  constructor(message = "CSRM questionnaire definition is invalid.") {
    super(message);
    this.name = "QuestionnaireDefinitionError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exactKeys(value: RecordValue, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new QuestionnaireDefinitionError();
}

function nonEmptyString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseQuestionnaireSection(value: unknown): QuestionnaireDefinitionQuestion["section"] {
  if (!isRecord(value)) throw new QuestionnaireDefinitionError();
  exactKeys(value, ["key", "title", "description", "order"]);
  if (!nonEmptyString(value.key, 120) || !nonEmptyString(value.title, 255) || !nonNegativeInteger(value.order)) {
    throw new QuestionnaireDefinitionError();
  }
  if (value.description !== undefined && !nonEmptyString(value.description, 2_000)) {
    throw new QuestionnaireDefinitionError();
  }
  return {
    key: value.key.trim(),
    title: value.title.trim(),
    ...(typeof value.description === "string" ? { description: value.description.trim() } : {}),
    order: value.order,
  };
}

export function parseQuestionnaireVisibility(value: unknown): QuestionnaireDefinitionQuestion["visibility"] {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new QuestionnaireDefinitionError();
  exactKeys(value, ["questionKey", "operator", "value"]);
  if (!nonEmptyString(value.questionKey, 120)
    || !["equals", "notEquals", "includes", "notIncludes"].includes(String(value.operator))
    || (typeof value.value !== "string" && typeof value.value !== "boolean")) {
    throw new QuestionnaireDefinitionError();
  }
  return {
    questionKey: value.questionKey.trim(),
    operator: value.operator as VisibilityOperator,
    value: value.value,
  };
}

export function parseQuestionnaireChoices(value: unknown): QuestionnaireDefinitionQuestion["choices"] {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > 1_000) throw new QuestionnaireDefinitionError();
  const choices = value.map((entry) => {
    if (!isRecord(entry)) throw new QuestionnaireDefinitionError();
    exactKeys(entry, ["value", "label"]);
    if (!nonEmptyString(entry.value, 255) || !nonEmptyString(entry.label, 255)) {
      throw new QuestionnaireDefinitionError();
    }
    return { value: entry.value.trim(), label: entry.label.trim() };
  });
  if (new Set(choices.map(({ value: choice }) => choice)).size !== choices.length) {
    throw new QuestionnaireDefinitionError();
  }
  return choices;
}

function parseDeletion(value: unknown): NonNullable<QuestionnaireDefinitionQuestion["deleted"]> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new QuestionnaireDefinitionError();
  exactKeys(value, ["deletedAt", "deletedBy"]);
  if (typeof value.deletedAt !== "string" || Number.isNaN(Date.parse(value.deletedAt))
    || !nonEmptyString(value.deletedBy, 255)) throw new QuestionnaireDefinitionError();
  return { deletedAt: value.deletedAt, deletedBy: value.deletedBy.trim() };
}

function parseQuestion(value: unknown): QuestionnaireDefinitionQuestion {
  if (!isRecord(value) || !isRecord(value.options)) throw new QuestionnaireDefinitionError();
  const { documentId, questionText, answerType, options, answer } = value;
  if (!nonEmptyString(documentId, 255)
    || !nonEmptyString(questionText, 65_535)
    || !QUESTIONNAIRE_ANSWER_TYPES.includes(answerType as QuestionnaireAnswerType)) {
    throw new QuestionnaireDefinitionError();
  }
  const schemaVersion = options.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) throw new QuestionnaireDefinitionError();
  exactKeys(options, schemaVersion === 1
    ? ["schemaVersion", "questionKey", "section", "order", "required", "visibility", "choices"]
    : ["schemaVersion", "questionKey", "section", "order", "required", "visibility", "choices", "deleted"]);
  if (!nonEmptyString(options.questionKey, 120)
    || !nonNegativeInteger(options.order)
    || typeof options.required !== "boolean") {
    throw new QuestionnaireDefinitionError();
  }
  const choices = parseQuestionnaireChoices(options.choices);
  const isChoice = answerType === "Single select" || answerType === "Multi select";
  if (isChoice !== Boolean(choices)) throw new QuestionnaireDefinitionError();
  return {
    documentId,
    questionText: questionText.trim(),
    answerType: answerType as QuestionnaireAnswerType,
    questionKey: options.questionKey.trim(),
    section: parseQuestionnaireSection(options.section),
    order: options.order,
    required: options.required,
    ...(parseQuestionnaireVisibility(options.visibility) ? { visibility: parseQuestionnaireVisibility(options.visibility) } : {}),
    ...(choices ? { choices } : {}),
    schemaVersion,
    ...(schemaVersion === 2 && parseDeletion(options.deleted) ? { deleted: parseDeletion(options.deleted) } : {}),
    answer,
  };
}

/** Returns the persisted questions which remain part of the active questionnaire. */
export function activeQuestionnaireDefinition(
  definition: QuestionnaireDefinitionQuestion[],
): QuestionnaireDefinitionQuestion[] {
  return definition.filter((question) => question.deleted === undefined);
}

function compareOrder(left: QuestionnaireDefinitionQuestion, right: QuestionnaireDefinitionQuestion): number {
  return left.section.order - right.section.order || left.order - right.order;
}

function conditionMatchesType(
  condition: NonNullable<QuestionnaireDefinitionQuestion["visibility"]>,
  target: QuestionnaireDefinitionQuestion,
): boolean {
  if (condition.operator === "includes" || condition.operator === "notIncludes") {
    return target.answerType === "Multi select" && typeof condition.value === "string";
  }
  if (target.answerType === "Boolean") return typeof condition.value === "boolean";
  if (target.answerType === "Multi select" || target.answerType === "File upload") return false;
  return typeof condition.value === "string";
}

export function parseQuestionnaireDefinition(input: unknown): QuestionnaireDefinitionQuestion[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 10_000) throw new QuestionnaireDefinitionError();
  const questions = input.map(parseQuestion);
  const byKey = new Map<string, QuestionnaireDefinitionQuestion>();
  const sections = new Map<string, string>();
  const sectionOrders = new Map<number, string>();
  const questionOrders = new Set<string>();
  for (const question of questions) {
    if (byKey.has(question.questionKey)) throw new QuestionnaireDefinitionError();
    byKey.set(question.questionKey, question);
    const sectionJson = JSON.stringify(question.section);
    if (sections.has(question.section.key) && sections.get(question.section.key) !== sectionJson) {
      throw new QuestionnaireDefinitionError();
    }
    sections.set(question.section.key, sectionJson);
    const sectionAtOrder = sectionOrders.get(question.section.order);
    if (sectionAtOrder && sectionAtOrder !== question.section.key) throw new QuestionnaireDefinitionError();
    sectionOrders.set(question.section.order, question.section.key);
    const orderKey = `${question.section.key}:${question.order}`;
    if (questionOrders.has(orderKey)) throw new QuestionnaireDefinitionError();
    questionOrders.add(orderKey);
  }
  const orderByKey = new Map([...questions].sort(compareOrder).map((question, index) => [question.questionKey, index]));
  for (const question of questions) {
    if (!question.visibility) continue;
    const target = byKey.get(question.visibility.questionKey);
    if (!target
      || (orderByKey.get(target.questionKey) ?? Number.MAX_SAFE_INTEGER) >= (orderByKey.get(question.questionKey) ?? -1)
      || !conditionMatchesType(question.visibility, target)) {
      throw new QuestionnaireDefinitionError();
    }
  }
  return [...questions].sort(compareOrder);
}

export function isQuestionnaireValueValid(question: QuestionnaireDefinitionQuestion, value: unknown): value is QuestionnaireValue {
  if (value === null) return true;
  switch (question.answerType) {
    case "Text":
    case "Long text":
      return typeof value === "string" && value.length <= 65_535;
    case "Boolean":
      return typeof value === "boolean";
    case "Single select":
      return typeof value === "string" && Boolean(question.choices?.some((choice) => choice.value === value));
    case "Multi select":
      return Array.isArray(value)
        && value.length <= 1_000
        && value.every((entry) => typeof entry === "string" && question.choices?.some((choice) => choice.value === entry));
    case "Date":
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      return new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
    case "File upload":
      return false;
  }
}

function conditionMet(question: QuestionnaireDefinitionQuestion, values: Record<string, QuestionnaireValue>): boolean {
  if (!question.visibility) return true;
  const controller = values[question.visibility.questionKey];
  switch (question.visibility.operator) {
    case "equals": return controller === question.visibility.value;
    case "notEquals": return controller !== question.visibility.value;
    case "includes": return Array.isArray(controller) && controller.includes(String(question.visibility.value));
    case "notIncludes": return !Array.isArray(controller) || !controller.includes(String(question.visibility.value));
  }
}

export function getVisibleQuestionKeys(
  definition: QuestionnaireDefinitionQuestion[],
  values: Record<string, QuestionnaireValue>,
): string[] {
  const visible = new Set<string>();
  for (const question of definition) {
    const controllerVisible = !question.visibility || visible.has(question.visibility.questionKey);
    if (controllerVisible && conditionMet(question, values)) visible.add(question.questionKey);
  }
  return [...visible].filter((key) => definition.find((question) => question.questionKey === key)?.deleted === undefined);
}
