// backend/src/modules/groups/__tests__/group-institutional-binding.service.test.ts
// D9.1 (DECISION-0186/0187) — regressão PERMANENTE do service interno de binding institucional.
// Prova em unidade (mocks ESM): AUTORIDADE DUAL (dois predicados canRepresentActor SEPARADOS e
// cumulativos; um lado só NUNCA basta; infra-error PROPAGA — nunca vira false/negação), inputs
// fail-closed, reparent exige o TERCEIRO predicado (novo parent), read-model é projeção pura
// (zero authority, zero side effects) e o service não toca membership/conta/endereço (não-herança).

import { jest } from '@jest/globals';

const canRepresentActor = jest.fn<(...a: unknown[]) => Promise<boolean>>();
jest.unstable_mockModule('@core/authorization/authorization.service', () => ({
  authorizationService: { canRepresentActor },
}));

const ensureUserActor = jest.fn(async () => ({ actor_id: 'ACTING-ACTOR' }));
jest.unstable_mockModule('@modules/identity/actor-writer.service', () => ({
  ensureUserActor,
}));

const runQueryWithTenant = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule('@core/database/pool', () => ({
  runQueryWithTenant,
  runQueriesWithTenant: jest.fn(async () => []),
}));

const bind = jest.fn(async () => 'BINDING-1');
const retire = jest.fn(async () => 'BINDING-1');
const reparent = jest.fn(async () => 'BINDING-2');
const findById = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const findActiveByGroup = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const listByGroup = jest.fn<(...a: unknown[]) => Promise<unknown[]>>(async () => []);
const listActiveChildrenGroupIds = jest.fn<(...a: unknown[]) => Promise<string[]>>(async () => []);
jest.unstable_mockModule('../group-institutional-binding.repository', () => ({
  groupInstitutionalBindingRepository: {
    bind, retire, reparent, findById, findActiveByGroup, listByGroup, listActiveChildrenGroupIds,
  },
}));

const { groupInstitutionalBindingService } = await import('../group-institutional-binding.service');

const TENANT = 'T-1';
const USER = 'U-1';
const GROUP = 'G-1';
const GROUP_ACTOR = 'GA-1';
const INSTITUTION = 'PAGE-1';
const KEY = 'idem-1';

const BINDING = {
  id: 'BINDING-1', tenantId: TENANT, groupId: GROUP, institutionActorId: INSTITUTION,
  status: 'active', createIdempotencyKey: KEY, createdByActorId: 'ACTING-ACTOR',
  createdAt: 'now', retireIdempotencyKey: null, retiredByActorId: null, retiredAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  runQueryWithTenant.mockResolvedValue({ group_id: GROUP, actor_id: GROUP_ACTOR });
  findById.mockResolvedValue(BINDING);
  findActiveByGroup.mockResolvedValue(BINDING);
});

describe('bindGroupToInstitution — autoridade dual', () => {
  test('caminho feliz: DOIS predicados provados separadamente; writer recebe actor atuante server-side', async () => {
    canRepresentActor.mockResolvedValue(true);
    const out = await groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: KEY,
    });
    expect(out.id).toBe('BINDING-1');
    expect(canRepresentActor).toHaveBeenCalledTimes(2);
    expect(canRepresentActor).toHaveBeenNthCalledWith(1, TENANT, USER, INSTITUTION);
    expect(canRepresentActor).toHaveBeenNthCalledWith(2, TENANT, USER, GROUP_ACTOR);
    expect(bind).toHaveBeenCalledWith(TENANT, GROUP, INSTITUTION, 'ACTING-ACTOR', KEY);
  });

  test('lado INSTITUIÇÃO negado → Forbidden; writer NUNCA chamado', async () => {
    canRepresentActor.mockResolvedValueOnce(false);
    await expect(groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: KEY,
    })).rejects.toThrow(/GIB_INSTITUTION_NOT_REPRESENTED/);
    expect(bind).not.toHaveBeenCalled();
  });

  test('lado GROUP negado (instituição OK) → Forbidden; um lado só NUNCA basta', async () => {
    canRepresentActor.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: KEY,
    })).rejects.toThrow(/GIB_GROUP_NOT_REPRESENTED/);
    expect(canRepresentActor).toHaveBeenCalledTimes(2);
    expect(bind).not.toHaveBeenCalled();
  });

  test('infra-error de authority PROPAGA (não vira false nem Forbidden)', async () => {
    canRepresentActor.mockRejectedValueOnce(new Error('DB_DOWN'));
    await expect(groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: KEY,
    })).rejects.toThrow('DB_DOWN');
    expect(bind).not.toHaveBeenCalled();
  });

  test('group sem group-actor materializado → GIB_GROUP_ACTOR_MISSING (fail-closed antes da authority)', async () => {
    runQueryWithTenant.mockResolvedValue({ group_id: GROUP, actor_id: null });
    await expect(groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: KEY,
    })).rejects.toThrow(/GIB_GROUP_ACTOR_MISSING/);
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(bind).not.toHaveBeenCalled();
  });

  test('idempotencyKey ausente → GIB_INPUT_NULL', async () => {
    await expect(groupInstitutionalBindingService.bindGroupToInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: '  ',
    })).rejects.toThrow(/GIB_INPUT_NULL/);
    expect(bind).not.toHaveBeenCalled();
  });
});

describe('retireBinding — autoridade dual sobre o vínculo existente', () => {
  test('caminho feliz: dual sobre instituição do vínculo + group-actor', async () => {
    canRepresentActor.mockResolvedValue(true);
    const out = await groupInstitutionalBindingService.retireBinding({
      tenantId: TENANT, actingUserId: USER, bindingId: 'BINDING-1', idempotencyKey: 'ret-1',
    });
    expect(out.id).toBe('BINDING-1');
    expect(canRepresentActor).toHaveBeenNthCalledWith(1, TENANT, USER, INSTITUTION);
    expect(canRepresentActor).toHaveBeenNthCalledWith(2, TENANT, USER, GROUP_ACTOR);
    expect(retire).toHaveBeenCalledWith(TENANT, 'BINDING-1', 'ACTING-ACTOR', 'ret-1');
  });

  test('representar SÓ o group não retira (lado instituição obrigatório)', async () => {
    canRepresentActor.mockResolvedValueOnce(false);
    await expect(groupInstitutionalBindingService.retireBinding({
      tenantId: TENANT, actingUserId: USER, bindingId: 'BINDING-1', idempotencyKey: 'ret-1',
    })).rejects.toThrow(/GIB_INSTITUTION_NOT_REPRESENTED/);
    expect(retire).not.toHaveBeenCalled();
  });

  test('vínculo inexistente → GIB_BINDING_NOT_FOUND antes de qualquer authority', async () => {
    findById.mockResolvedValueOnce(null);
    await expect(groupInstitutionalBindingService.retireBinding({
      tenantId: TENANT, actingUserId: USER, bindingId: 'X', idempotencyKey: 'ret-1',
    })).rejects.toThrow(/GIB_BINDING_NOT_FOUND/);
    expect(canRepresentActor).not.toHaveBeenCalled();
  });
});

describe('reparentGroupInstitution — autoridade TRIPLA', () => {
  test('exige parent ATUAL + group + parent NOVO; novo negado → Forbidden sem writer', async () => {
    canRepresentActor
      .mockResolvedValueOnce(true)   // parent atual
      .mockResolvedValueOnce(true)   // group
      .mockResolvedValueOnce(false); // parent novo
    await expect(groupInstitutionalBindingService.reparentGroupInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, newInstitutionActorId: 'PAGE-2', idempotencyKey: 'rep-1',
    })).rejects.toThrow(/GIB_INSTITUTION_NOT_REPRESENTED/);
    expect(canRepresentActor).toHaveBeenCalledTimes(3);
    expect(canRepresentActor).toHaveBeenNthCalledWith(3, TENANT, USER, 'PAGE-2');
    expect(reparent).not.toHaveBeenCalled();
  });

  test('caminho feliz: 3 predicados verdadeiros → fn_reparent via repository', async () => {
    canRepresentActor.mockResolvedValue(true);
    findById.mockResolvedValue({ ...BINDING, id: 'BINDING-2' });
    const out = await groupInstitutionalBindingService.reparentGroupInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, newInstitutionActorId: 'PAGE-2', idempotencyKey: 'rep-1',
    });
    expect(out.id).toBe('BINDING-2');
    expect(reparent).toHaveBeenCalledWith(TENANT, GROUP, 'PAGE-2', 'ACTING-ACTOR', 'rep-1');
  });

  test('sem vínculo ativo → GIB_NO_ACTIVE_BINDING', async () => {
    findActiveByGroup.mockResolvedValueOnce(null);
    await expect(groupInstitutionalBindingService.reparentGroupInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, newInstitutionActorId: 'PAGE-2', idempotencyKey: 'rep-1',
    })).rejects.toThrow(/GIB_NO_ACTIVE_BINDING/);
  });
});

describe('read-model — projeção pura (não-herança)', () => {
  test('internal quando há binding ativo; ZERO chamadas de authority; zero writers', async () => {
    listByGroup.mockResolvedValueOnce([BINDING]);
    const view = await groupInstitutionalBindingService.getGroupInstitutionalBindingView(TENANT, GROUP);
    expect(view.mode).toBe('internal');
    expect(view.activeBinding?.id).toBe('BINDING-1');
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(bind).not.toHaveBeenCalled();
    expect(retire).not.toHaveBeenCalled();
  });

  test('root quando sem parent mas com filhos ativos; standalone sem ambos', async () => {
    listByGroup.mockResolvedValueOnce([]);
    listActiveChildrenGroupIds.mockResolvedValueOnce(['G-CHILD']);
    const root = await groupInstitutionalBindingService.getGroupInstitutionalBindingView(TENANT, GROUP);
    expect(root.mode).toBe('root');

    listByGroup.mockResolvedValueOnce([]);
    listActiveChildrenGroupIds.mockResolvedValueOnce([]);
    const alone = await groupInstitutionalBindingService.getGroupInstitutionalBindingView(TENANT, GROUP);
    expect(alone.mode).toBe('standalone');
  });
});
