// backend/src/modules/groups/__tests__/group-institutional-binding.service.test.ts
// D9.1 (DECISION-0186/0187 + remediação AUTHORITY DUAL TRANSACTION BOUNDARY) — regressão PERMANENTE.
// Prova em unidade (mocks ESM, IDENTIDADE de client verificada por referência):
//  (1) bind abre UMA única transação; (2) os dois canRepresentActor recebem EXATAMENTE o mesmo
//  client; (3) o writer recebe o MESMO client; (4) authority ocorre DEPOIS de BEGIN; (5) writer
//  DEPOIS dos dois predicados; (6) COMMIT somente após o writer; (7) denial => ROLLBACK; (8) infra-
//  error => ROLLBACK e PROPAGA; (9) writer failure => ROLLBACK; (10) release exatamente UMA vez;
//  (11) nenhum helper abre client próprio (pool.connect chamado 1×); (12) reparent usa o mesmo
//  client nos TRÊS predicados e no writer composto; (13) retire usa o mesmo client nos DOIS
//  predicados e no writer; (14) actionContext.actorId sem valor probatório; (15) caminho pool de
//  canRepresentActor (3 args, sem client) permanece para callers antigos — provado no E2E H0 e pela
//  assinatura opcional (compile-time); aqui provamos que o service SEMPRE fornece o client.

import { jest } from '@jest/globals';

type Ev = string;
const log: Ev[] = [];

const mockClient = {
  query: jest.fn(async (sql: string): Promise<{ rows: unknown[] }> => {
    if (/^BEGIN/.test(sql)) log.push('BEGIN');
    else if (/set_config/.test(sql)) log.push('TENANT');
    else if (/pg_advisory_xact_lock/.test(sql)) log.push('ADVISORY');
    else if (/FROM groups/.test(sql)) { log.push('RESOLVE-GROUP'); return { rows: [{ group_id: 'G-1', actor_id: 'GA-1' }] }; }
    else if (/^COMMIT/.test(sql)) log.push('COMMIT');
    else if (/^ROLLBACK/.test(sql)) log.push('ROLLBACK');
    return { rows: [] };
  }),
  release: jest.fn(() => { log.push('RELEASE'); }),
};
const connect = jest.fn(async () => { log.push('CONNECT'); return mockClient; });

jest.unstable_mockModule('@core/database/pool', () => ({
  pool: { connect },
  runQueryWithTenant: jest.fn(async () => ({ group_id: 'G-1', actor_id: 'GA-1' })),
  runQueriesWithTenant: jest.fn(async () => []),
}));

const canRepresentActor = jest.fn<(...a: unknown[]) => Promise<boolean>>();
jest.unstable_mockModule('@core/authorization/authorization.service', () => ({
  authorizationService: {
    canRepresentActor: (...a: unknown[]) => {
      log.push(`AUTH:${String(a[2])}`);
      return canRepresentActor(...a);
    },
  },
}));

const ensureUserActorTx = jest.fn(async (client: unknown) => {
  log.push('PRINCIPAL');
  ensureUserActorTxClients.push(client);
  return { actor_id: 'ACTING-ACTOR' };
});
const ensureUserActorTxClients: unknown[] = [];
jest.unstable_mockModule('@modules/identity/actor-writer.service', () => ({ ensureUserActorTx }));

const bind = jest.fn(async (client: unknown) => { log.push('WRITER'); writerClients.push(client); return 'BINDING-1'; });
const retire = jest.fn(async (client: unknown) => { log.push('WRITER'); writerClients.push(client); return 'BINDING-1'; });
const reparent = jest.fn(async (client: unknown) => { log.push('WRITER'); writerClients.push(client); return 'BINDING-2'; });
const writerClients: unknown[] = [];
const findById = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const findActiveByGroup = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const listByGroup = jest.fn(async () => []);
const listActiveChildrenGroupIds = jest.fn(async () => []);
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

const bindInput = { tenantId: TENANT, actingUserId: USER, groupId: GROUP, institutionActorId: INSTITUTION, idempotencyKey: KEY };

beforeEach(() => {
  jest.clearAllMocks();
  log.length = 0;
  writerClients.length = 0;
  ensureUserActorTxClients.length = 0;
  findById.mockResolvedValue(BINDING);
  findActiveByGroup.mockResolvedValue(BINDING);
  canRepresentActor.mockResolvedValue(true);
});

describe('fronteira transacional — bind', () => {
  test('(1)(4)(5)(6) UMA transação; ordem BEGIN→tenant→advisory→principal→authority×2→writer→COMMIT', async () => {
    const out = await groupInstitutionalBindingService.bindGroupToInstitution(bindInput);
    expect(out.id).toBe('BINDING-1');
    expect(connect).toHaveBeenCalledTimes(1);
    expect(log.filter((e) => e === 'BEGIN')).toHaveLength(1);
    expect(log.filter((e) => e === 'COMMIT')).toHaveLength(1);
    const i = (ev: Ev) => log.indexOf(ev);
    expect(i('BEGIN')).toBeGreaterThan(i('CONNECT'));
    expect(i('TENANT')).toBeGreaterThan(i('BEGIN'));
    expect(i('ADVISORY')).toBeGreaterThan(i('TENANT'));
    expect(i('PRINCIPAL')).toBeGreaterThan(i('ADVISORY'));
    expect(i(`AUTH:${INSTITUTION}`)).toBeGreaterThan(i('BEGIN'));            // (4) authority após BEGIN
    expect(i(`AUTH:${GROUP_ACTOR}`)).toBeGreaterThan(i(`AUTH:${INSTITUTION}`));
    expect(i('WRITER')).toBeGreaterThan(i(`AUTH:${GROUP_ACTOR}`));           // (5) writer após os 2 predicados
    expect(i('COMMIT')).toBeGreaterThan(i('WRITER'));                        // (6) COMMIT só após writer
    expect(log).not.toContain('ROLLBACK');
  });

  test('(2)(3)(11) MESMO client (identidade) nos dois predicados, no principal e no writer; pool.connect 1×', async () => {
    await groupInstitutionalBindingService.bindGroupToInstitution(bindInput);
    expect(canRepresentActor).toHaveBeenCalledTimes(2);
    expect(canRepresentActor.mock.calls[0][3]).toBe(mockClient);
    expect(canRepresentActor.mock.calls[1][3]).toBe(mockClient);
    expect(canRepresentActor.mock.calls[0][2]).toBe(INSTITUTION);
    expect(canRepresentActor.mock.calls[1][2]).toBe(GROUP_ACTOR);
    expect(ensureUserActorTxClients[0]).toBe(mockClient);
    expect(writerClients[0]).toBe(mockClient);
    expect(findById.mock.calls[0][2]).toBe(mockClient); // releitura transacional
    expect(connect).toHaveBeenCalledTimes(1);           // (11) nenhum helper abre client próprio
  });

  test('(7)(10) denial de qualquer lado => ROLLBACK, sem COMMIT, sem writer, release 1×', async () => {
    canRepresentActor.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(groupInstitutionalBindingService.bindGroupToInstitution(bindInput))
      .rejects.toThrow(/GIB_GROUP_NOT_REPRESENTED/);
    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(bind).not.toHaveBeenCalled();
    expect(mockClient.release).toHaveBeenCalledTimes(1); // (10)
  });

  test('(8) infra-error do predicado => PROPAGA (não vira false) e ROLLBACK', async () => {
    canRepresentActor.mockRejectedValueOnce(new Error('DB_DOWN'));
    await expect(groupInstitutionalBindingService.bindGroupToInstitution(bindInput)).rejects.toThrow('DB_DOWN');
    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(bind).not.toHaveBeenCalled();
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('(9) writer failure => ROLLBACK e propaga; release 1×', async () => {
    bind.mockRejectedValueOnce(new Error('FN_BOOM'));
    await expect(groupInstitutionalBindingService.bindGroupToInstitution(bindInput)).rejects.toThrow('FN_BOOM');
    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('(14) actionContext.actorId no input NÃO tem valor probatório (ids server-resolved)', async () => {
    await groupInstitutionalBindingService.bindGroupToInstitution({
      ...bindInput,
      ...( { actionContext: { actorId: 'SPOOFED-ACTOR' } } as object ),
    } as typeof bindInput);
    // predicados rodam sobre os ids resolvidos server-side, nunca sobre o hint do cliente
    expect(canRepresentActor.mock.calls[0][2]).toBe(INSTITUTION);
    expect(canRepresentActor.mock.calls[1][2]).toBe(GROUP_ACTOR);
    const spoofed = canRepresentActor.mock.calls.some((c) => c.includes('SPOOFED-ACTOR'));
    expect(spoofed).toBe(false);
    expect(bind.mock.calls[0]).not.toContain('SPOOFED-ACTOR');
  });

  test('group sem group-actor => falha ANTES de qualquer authority, com ROLLBACK', async () => {
    mockClient.query.mockImplementationOnce(async (sql: string) => { log.push('BEGIN'); return { rows: [] }; })
      .mockImplementationOnce(async () => { log.push('TENANT'); return { rows: [] }; })
      .mockImplementationOnce(async () => { log.push('ADVISORY'); return { rows: [] }; })
      .mockImplementationOnce(async () => { log.push('RESOLVE-GROUP'); return { rows: [{ group_id: GROUP, actor_id: null }] }; })
      .mockImplementationOnce(async () => { log.push('ROLLBACK'); return { rows: [] }; });
    await expect(groupInstitutionalBindingService.bindGroupToInstitution(bindInput))
      .rejects.toThrow(/GIB_GROUP_ACTOR_MISSING/);
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(bind).not.toHaveBeenCalled();
  });
});

describe('fronteira transacional — retire (13)', () => {
  test('mesmo client nos DOIS predicados, no findById transacional e no writer', async () => {
    const out = await groupInstitutionalBindingService.retireBinding({
      tenantId: TENANT, actingUserId: USER, bindingId: 'BINDING-1', idempotencyKey: 'ret-1',
    });
    expect(out.id).toBe('BINDING-1');
    expect(canRepresentActor).toHaveBeenCalledTimes(2);
    expect(canRepresentActor.mock.calls[0][3]).toBe(mockClient);
    expect(canRepresentActor.mock.calls[1][3]).toBe(mockClient);
    expect(findById.mock.calls[0][2]).toBe(mockClient);
    expect(writerClients[0]).toBe(mockClient);
    const i = (ev: Ev) => log.indexOf(ev);
    expect(i('WRITER')).toBeGreaterThan(i(`AUTH:${GROUP_ACTOR}`));
    expect(i('COMMIT')).toBeGreaterThan(i('WRITER'));
  });

  test('representar SÓ o group não retira; ROLLBACK', async () => {
    canRepresentActor.mockResolvedValueOnce(false);
    await expect(groupInstitutionalBindingService.retireBinding({
      tenantId: TENANT, actingUserId: USER, bindingId: 'BINDING-1', idempotencyKey: 'ret-1',
    })).rejects.toThrow(/GIB_INSTITUTION_NOT_REPRESENTED/);
    expect(retire).not.toHaveBeenCalled();
    expect(log).toContain('ROLLBACK');
  });
});

describe('fronteira transacional — reparent (12)', () => {
  test('TRÊS predicados no MESMO client + writer composto no MESMO client; ordem preservada', async () => {
    findById.mockResolvedValue({ ...BINDING, id: 'BINDING-2' });
    const out = await groupInstitutionalBindingService.reparentGroupInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, newInstitutionActorId: 'PAGE-2', idempotencyKey: 'rep-1',
    });
    expect(out.id).toBe('BINDING-2');
    expect(canRepresentActor).toHaveBeenCalledTimes(3);
    for (const call of canRepresentActor.mock.calls) expect(call[3]).toBe(mockClient); // (12)
    expect(canRepresentActor.mock.calls[2][2]).toBe('PAGE-2');
    expect(findActiveByGroup.mock.calls[0][2]).toBe(mockClient);
    expect(writerClients[0]).toBe(mockClient);
    const i = (ev: Ev) => log.indexOf(ev);
    expect(i('WRITER')).toBeGreaterThan(i('AUTH:PAGE-2'));
    expect(i('COMMIT')).toBeGreaterThan(i('WRITER'));
  });

  test('terceiro predicado negado => ROLLBACK integral, writer NUNCA chamado', async () => {
    canRepresentActor
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(groupInstitutionalBindingService.reparentGroupInstitution({
      tenantId: TENANT, actingUserId: USER, groupId: GROUP, newInstitutionActorId: 'PAGE-2', idempotencyKey: 'rep-1',
    })).rejects.toThrow(/GIB_INSTITUTION_NOT_REPRESENTED/);
    expect(reparent).not.toHaveBeenCalled();
    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

describe('read-model — projeção pura (sem transação, sem authority)', () => {
  test('view NÃO abre transação e NÃO chama authority', async () => {
    listByGroup.mockResolvedValueOnce([BINDING] as never);
    const view = await groupInstitutionalBindingService.getGroupInstitutionalBindingView(TENANT, GROUP);
    expect(view.mode).toBe('internal');
    expect(connect).not.toHaveBeenCalled();
    expect(canRepresentActor).not.toHaveBeenCalled();
  });
});
