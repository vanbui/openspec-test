/*
 * The web's validation copy (direction section 4 Forms: a message says what is wrong and how to fix it).
 * Input schemas attach these to each bound they enforce, so a message reads the same whether the browser
 * or a Server Action raises it, and no validation library default ever reaches the person typing.
 */

const characterCount = new Intl.NumberFormat('en-AU');

function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

/** A required field left blank, or holding only spaces: `Enter a name.`, the field's label in lower case. */
export function enterFieldMessage(fieldLabel: string): string {
  return `Enter ${withArticle(fieldLabel.toLocaleLowerCase('en-AU'))}.`;
}

/**
 * An optional field holding only spaces, where the field refuses an empty value: `Enter a control
 * reference, or leave it empty.` Forms submit such a field as empty before this can apply.
 */
export function enterOrLeaveEmptyMessage(fieldLabel: string): string {
  return `Enter ${withArticle(fieldLabel.toLocaleLowerCase('en-AU'))}, or leave it empty.`;
}

/** Text longer than its field allows: `Use 255 characters or fewer.` */
export function maxCharactersMessage(maxLength: number): string {
  return `Use ${characterCount.format(maxLength)} characters or fewer.`;
}

/** A required relation left unchosen, named as the product names it: `Choose a control.` (UI-SPEC §13.1) */
export function chooseRelationMessage(relation: string): string {
  return `Choose ${withArticle(relation)}.`;
}
