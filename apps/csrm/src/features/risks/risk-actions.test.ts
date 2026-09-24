import { afterEach, describe, expect, it, vi } from 'vitest';

import * as actions from './risk-actions';

const updateRisk = vi.hoisted(() => vi.fn());
const createControlImplementation = vi.hoisted(() => vi.fn());
const updateControlImplementation = vi.hoisted(() => vi.fn());
const deleteControlImplementation = vi.hoisted(() => vi.fn());
const getRiskDetail = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('../assessments/assessment-service', () => ({
  updateRisk,
  createControlImplementation,
  updateControlImplementation,
  deleteControlImplementation,
}));
vi.mock('./risk-service', () => ({ getRiskDetail }));
vi.mock('next/cache', () => ({ revalidatePath }));

afterEach(() => {
  for (const mock of [
    updateRisk, createControlImplementation, updateControlImplementation,
    deleteControlImplementation, getRiskDetail, revalidatePath,
  ]) mock.mockReset();
});

const success = (data: unknown = { documentId: 'result-1' }) => ({ data, error: null });
const failure = (status: number) => ({ data: null, error: { message: 'private failure detail', status } });
const authoritativeDetail = { documentId: 'risk/1', riskNumber: 'RSK-0001', parentLock: 'released' };

describe('Risk detail Server Action boundary', () => {
  it('rejects unknown and server-owned fields while preserving submitted values and field errors', async () => {
    const input = {
      riskId: 'risk-1',
      values: { riskStatement: 'Keep this value', assessment: 'forged', parentLock: 'released', createdBy: 'forged' },
    };

    await expect(actions.updateRiskDetailAction(input)).resolves.toMatchObject({
      ok: false,
      values: input.values,
      fieldErrors: {
        assessment: expect.any(Array), parentLock: expect.any(Array), createdBy: expect.any(Array),
      },
    });
    expect(updateRisk).not.toHaveBeenCalled();
    expect(getRiskDetail).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects forged mitigation ancestry, workflow, identity, and outer fields', async () => {
    const createInput = {
      riskId: 'risk-1',
      values: { control: 'control-1', assessment: 'forged', parentLock: 'mutable', createdBy: 'forged' },
    };
    const updateInput = {
      riskId: 'risk-1', implementationId: 'implementation-1', forgedOuter: true,
      values: { evidence: 'Keep this value' },
    };
    await expect(actions.createMitigationControlAction(createInput)).resolves.toMatchObject({
      ok: false,
      values: createInput.values,
      fieldErrors: { assessment: expect.any(Array), parentLock: expect.any(Array), createdBy: expect.any(Array) },
    });
    await expect(actions.updateMitigationControlAction(updateInput)).resolves.toMatchObject({
      ok: false,
      values: updateInput.values,
      fieldErrors: { forgedOuter: expect.any(Array) },
    });
    expect(createControlImplementation).not.toHaveBeenCalled();
    expect(updateControlImplementation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('routes delta-only Risk and mitigation values through existing services and revalidates exact paths on success', async () => {
    updateRisk.mockResolvedValueOnce(success());
    createControlImplementation.mockResolvedValueOnce(success());
    updateControlImplementation.mockResolvedValueOnce(success());
    deleteControlImplementation.mockResolvedValueOnce(success(undefined));

    const riskResult = await actions.updateRiskDetailAction({ riskId: 'risk/1', values: { riskStatement: 'Changed only' } });
    await actions.createMitigationControlAction({ riskId: 'risk/1', values: { control: 'control-1', controlStatus: 'Planned' } });
    await actions.updateMitigationControlAction({
      riskId: 'risk/1', implementationId: 'implementation-1', values: { evidence: 'Changed evidence' },
    });
    await actions.deleteMitigationControlAction({ riskId: 'risk/1', implementationId: 'implementation-1' });

    expect(updateRisk).toHaveBeenCalledWith('risk/1', { riskStatement: 'Changed only' });
    expect(riskResult).toEqual({ ok: true, data: { documentId: 'result-1' } });
    expect(createControlImplementation).toHaveBeenCalledWith('risk/1', { control: 'control-1', controlStatus: 'Planned' });
    expect(updateControlImplementation).toHaveBeenCalledWith('implementation-1', { evidence: 'Changed evidence' });
    expect(deleteControlImplementation).toHaveBeenCalledWith('implementation-1');
    expect(revalidatePath.mock.calls).toEqual(Array.from({ length: 4 }, () => [
      ['/app/risks'], ['/app/risks/risk%2F1'],
    ]).flat());
    expect(getRiskDetail).not.toHaveBeenCalled();
  });

  it('does not call mutations for empty update deltas', async () => {
    await expect(actions.updateRiskDetailAction({ riskId: 'risk-1', values: {} })).resolves.toMatchObject({ ok: false });
    await expect(actions.updateMitigationControlAction({
      riskId: 'risk-1', implementationId: 'implementation-1', values: {},
    })).resolves.toMatchObject({ ok: false });
    expect(updateRisk).not.toHaveBeenCalled();
    expect(updateControlImplementation).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['update Risk', () => actions.updateRiskDetailAction({ riskId: 'risk/1', values: { comments: 'changed' } }), updateRisk],
    ['create mitigation', () => actions.createMitigationControlAction({ riskId: 'risk/1', values: { control: 'control-1' } }), createControlImplementation],
    ['update mitigation', () => actions.updateMitigationControlAction({ riskId: 'risk/1', implementationId: 'implementation-1', values: { evidence: 'changed' } }), updateControlImplementation],
    ['delete mitigation', () => actions.deleteMitigationControlAction({ riskId: 'risk/1', implementationId: 'implementation-1' }), deleteControlImplementation],
  ])('performs one authoritative detail read after a 409 from %s', async (_name, invoke, mutation) => {
    mutation.mockResolvedValueOnce(failure(409));
    getRiskDetail.mockResolvedValueOnce(success(authoritativeDetail));

    await expect(invoke()).resolves.toEqual({
      ok: false,
      conflict: true,
      authoritativeDetail,
      formError: 'This Risk changed. Your edits were not saved.',
    });
    expect(getRiskDetail).toHaveBeenCalledTimes(1);
    expect(getRiskDetail).toHaveBeenCalledWith('risk/1');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a safe not-available conflict with no Risk projection when authoritative refresh fails', async () => {
    updateRisk.mockResolvedValueOnce(failure(409));
    getRiskDetail.mockResolvedValueOnce(failure(404));
    const input = { riskId: 'risk-1', values: { comments: 'must not leak' } };

    const result = await actions.updateRiskDetailAction(input);
    expect(result).toEqual({
      ok: false,
      conflict: true,
      notAvailable: true,
      formError: 'This Risk is no longer available.',
    });
    expect(JSON.stringify(result)).not.toContain('must not leak');
    expect(getRiskDetail).toHaveBeenCalledTimes(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([400, 403, 404, 503])('normalizes %s safely, preserves values, and does not reload or invalidate', async (status) => {
    const input = { riskId: 'risk-1', values: { comments: 'Keep this value' } };
    updateRisk.mockResolvedValueOnce(failure(status));
    const result = await actions.updateRiskDetailAction(input);
    expect(result).toMatchObject({ ok: false, values: input.values, formError: expect.any(String) });
    expect(JSON.stringify(result)).not.toContain('private failure detail');
    expect(getRiskDetail).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
