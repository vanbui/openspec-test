import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  findSharedListStateViolations,
  listStateTargets,
} from '../../scripts/verify-shared-list-states.mjs';

const target = 'src/features/requests/request-table.tsx';

const sharedSource = `
  import { EmptyState } from '@/components/states/states';
  export function RequestTable() {
    return <DataTable stateSlots={{ empty: <EmptyState noun="requests" /> }} />;
  }
`;

const localListStateSource = `
  function RequestListEmptyState() {
    return <section className="rounded-md text-center"><h2>No requests</h2></section>;
  }
  export function RequestTable() {
    return <DataTable stateSlots={{ empty: <RequestListEmptyState /> }} />;
  }
`;

const detailAlertSource = `
  export function AssessmentDetail() {
    return <section role="alert">A domain-specific release fact is unavailable.</section>;
  }
`;

const detailAlertInTargetSource = `${sharedSource}
  export function RequestDetailNotice() {
    return <section className="rounded-md text-center" role="alert"><h2>Release facts unavailable</h2></section>;
  }
`;

const inlineSlotMarkupSource = `
  import { EmptyState } from '@/components/states/states';
  export function RequestTable() {
    return <DataTable stateSlots={{ empty: <EmptyState noun="requests" />, error: <section role="alert"><h2>Failed</h2></section> }} />;
  }
`;

const spreadSlotMarkupSource = `
  import { EmptyState } from '@/components/states/states';
  export function RequestTable() {
    return <DataTable {...{ stateSlots: { empty: <div className="text-center">No requests</div> } }} />;
  }
`;

const neutralLocalComponentSource = `
  import { EmptyState } from '@/components/states/states';
  const Notice = () => <section className="text-center"><h2>No requests</h2></section>;
  export function RequestTable() {
    return <DataTable stateSlots={{ empty: <EmptyState noun="requests" />, error: <Notice /> }} />;
  }
`;

const importedComponentSource = `
  import { EmptyState } from '@/components/states/states';
  import { RequestProblem } from './request-problem';
  export function RequestTable() {
    return <DataTable stateSlots={{ empty: <EmptyState noun="requests" />, error: <RequestProblem /> }} />;
  }
`;

const primitiveWrapperSource = `
  import { EmptyState, PermissionDeniedState } from '@/components/states/states';
  export function RequestAccessDenied({ area }: { area: string }) {
    return <PermissionDeniedState area={area} />;
  }
  export function RequestTable() {
    return <DataTable stateSlots={{ empty: <EmptyState noun="requests" />, permission: <RequestAccessDenied area="requests" /> }} />;
  }
`;

function sourcesForTargets(): Record<string, string> {
  return Object.fromEntries(
    listStateTargets.map((file) => [file, readFileSync(resolve(process.cwd(), file), 'utf8')]),
  );
}

describe('shared list-state guard', () => {
  it('accepts every real list-state target', () => {
    expect(findSharedListStateViolations(sourcesForTargets())).toEqual([]);
  });

  it('keeps the detector fixture coverage', () => {
    expect(findSharedListStateViolations({ [target]: sharedSource })).toEqual([]);
    expect(findSharedListStateViolations({ [target]: localListStateSource }).join('\n')).toMatch(
      /feature-owned|shared state primitive/,
    );
    expect(findSharedListStateViolations({
      'src/features/assessments/assessment-detail.tsx': detailAlertSource,
    })).toEqual([]);
    expect(findSharedListStateViolations({ [target]: detailAlertInTargetSource })).toEqual([]);
    expect(findSharedListStateViolations({ [target]: inlineSlotMarkupSource }).join('\n')).toMatch(
      /direct list-state container/,
    );
    expect(findSharedListStateViolations({ [target]: spreadSlotMarkupSource }).join('\n')).toMatch(
      /direct list-state container/,
    );
  });

  it('resolves components rendered in state slots instead of trusting their names', () => {
    expect(findSharedListStateViolations({ [target]: neutralLocalComponentSource }).join('\n')).toMatch(
      /direct list-state container/,
    );
    expect(findSharedListStateViolations({ [target]: importedComponentSource }).join('\n')).toMatch(
      /direct list-state container/,
    );
    expect(findSharedListStateViolations({ [target]: primitiveWrapperSource })).toEqual([]);
  });
});
