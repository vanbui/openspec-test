'use client';

import { useCallback, useEffect, useState } from 'react';
import type { FieldValues, UseFormWatch } from 'react-hook-form';

import type { SaveStatusValue } from '@/components/csrm/save-status';

/** Whether a confirmation reports a save or a create (`{Record} saved at` or `{Record} added at`, UI-SPEC §13.4). */
export type RecordSaveVerb = 'saved' | 'added';

type RecordSaveConfirmation = { status: SaveStatusValue; verb: RecordSaveVerb };

const idle: RecordSaveConfirmation = { status: { kind: 'idle' }, verb: 'saved' };

/**
 * The save confirmation of one assessment-editor form (D-33, design direction X-1). A successful save confirms
 * with the time it was confirmed; `No changes to save.` is a note in the same region; any change to the form, and
 * any failed save, clears it. A record just created passes `addedAt`, and its new form confirms the create once it
 * has mounted, so the polite region announces the change rather than arriving already filled.
 */
export function useRecordSaveStatus<T extends FieldValues>(watch: UseFormWatch<T>, addedAt?: string) {
  const [confirmation, setConfirmation] = useState<RecordSaveConfirmation>(idle);

  useEffect(() => {
    if (addedAt) setConfirmation({ status: { kind: 'saved', at: addedAt }, verb: 'added' });
  }, [addedAt]);

  useEffect(() => {
    const subscription = watch(() => setConfirmation((current) => (current.status.kind === 'idle' ? current : idle)));
    return () => subscription.unsubscribe();
  }, [watch]);

  const saved = useCallback(() => setConfirmation({ status: { kind: 'saved', at: new Date().toISOString() }, verb: 'saved' }), []);
  const note = useCallback((message: string) => setConfirmation({ status: { kind: 'note', message }, verb: 'saved' }), []);
  const clear = useCallback(() => setConfirmation(idle), []);

  return { status: confirmation.status, verb: confirmation.verb, saved, note, clear };
}
