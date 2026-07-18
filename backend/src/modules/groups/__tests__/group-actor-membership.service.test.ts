// backend/src/modules/groups/__tests__/group-actor-membership.service.test.ts
// D9.2-A (DECISION-0188) — regressão PERMANENTE do service interno DORMENTE da membership
// Actor-first. Prova em unidade (mocks ESM; identidade de client por REFERÊNCIA):
// principal resolvido server-side; self usa o PRÓPRIO user-actor (nunca client-declared);
// page/group-raiz exigem canRepresentActor(member) NO client; remove exige canRepresentActor
// (group-actor) NO client; leave self dispensa representação e não-self exige; intents invite
// (lado group) × request (lado candidato); accept com autoridade do lado correto; denial é denial;
// infra-error PROPAGA com ROLLBACK; release único; ordem BEGIN→advisory→writer→COMMIT; nenhum
// fallback entre IDs; shadow validation é leitura pura (sem tx, sem authority, sem escrita).

import { jest } from '@jest/globals';

const log: string[] = [];
const mockClient = {
  query: jest.fn(async (sql: string): Promise<{ rows: unknown[] }> => {
    if (/^BEGIN/.test(sql)) log.push('BEGIN');
    else if (/set_config/.test(sql)) log.push('TENANT');
    else if (/pg_advisory_xact_lock/.test(sql)) log.push('ADVISORY');
    else if (/FROM groups/.test(sql)) { log.push('RESOLVE-GROUP-ACTOR'); return { rows: [{ actor_id: 'GROUP-ACTOR' }] }; }
    else if (/^COMMIT/.test(sql)) log.push('COMMIT');
    else if (/^ROLLBACK/.test(sql)) log.push('ROLLBACK');
    return { rows: [] };
  }),
  release: jest.fn(() => { log.push('RELEASE'); }),
};
const connect = jest.fn(async () => { log.push('CONNECT'); return mockClient; });

jest.unstable_mockModule('@core/database/pool', () => ({
  pool: { connect },
  runQueryWithTenant: jest.fn(async () => null),
  runQueriesWithTenant: jest.fn(async () => []),
}));

const canRepresentActor = jest.fn<(...a: unknown[]) => Promise<boolean>>();
jest.unstable_mockModule('@core/authorization/authorization.service', () => ({
  authorizationService: {
    canRepresentActor: (...a: unknown[]) => { log.push(`AUTH:${String(a[2])}`); return canRepresentActor(...a); },
  },
}));

const ensureUserActorTx = jest.fn(async (...a: unknown[]) => {
  log.push('PRINCIPAL'); txClients.push(a[0]); return { actor_id: 'SELF-ACTOR' };
});
const txClients: unknown[] = [];
jest.unstable_mockModule('@modules/identity/actor-writer.service', () => ({ ensureUserActorTx }));

const enter = jest.fn(async (...a: unknown[]) => { log.push('WRITER'); writerClients.push(a[0]); return 'M-1'; });
const leave = jest.fn(async (...a: unknown[]) => { log.push('WRITER'); writerClients.push(a[0]); return 'M-1'; });
const removeFn = jest.fn(async (...a: unknown[]) => { log.push('WRITER'); writerClients.push(a[0]); return 'M-1'; });
const createIntent = jest.fn(async (...a: unknown[]) => { log.push('WRITER'); writerClients.push(a[0]); return 'I-1'; });
const acceptIntent = jest.fn(async (...a: unknown[]) => { log.push('WRITER'); writerClients.push(a[0]); return 'M-2'; });
const writerClients: unknown[] = [];
const findById = jest.fn<(...a: unknown[]) => Promise<unknown>>();
const findIntent = jest.fn<(...a: unknown[]) => Promise<unknown>>();
jest.unstable_mockModule('../group-actor-membership.repository', () => ({
  groupActorMembershipRepository: {
    enter, leave, remove: removeFn, createIntent, acceptIntent, findById, findIntent,
    listByGroup: jest.fn(async () => []),
  },
}));

const { groupActorMembershipService } = await import('../group-actor-membership.service');

const T = 'T-1'; const U = 'U-1'; const G = 'G-1'; const PAGE = 'PAGE-1';
const MEMBERSHIP = {
  id: 'M-1', tenantId: T, groupId: G, memberActorId: 'SELF-ACTOR', status: 'active',
  entryIdempotencyKey: 'k', createdByActorId: 'SELF-ACTOR', createdAt: 'now',
  sourceIntentId: null, leftByActorId: null, leftAt: null, removedByActorId: null, removedAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  log.length = 0; txClients.length = 0; writerClients.length = 0;
  findById.mockResolvedValue(MEMBERSHIP);
  findIntent.mockResolvedValue({ id: 'I-1', groupId: G, candidateActorId: PAGE, intentKind: 'invite', status: 'pending' });
  canRepresentActor.mockResolvedValue(true);
});

describe('entrada self (user-actor)', () => {
  test('member = PRÓPRIO user-actor server-side; ZERO canRepresentActor; ordem transacional', async () => {
    const out = await groupActorMembershipService.enterMembershipSelf({ tenantId: T, actingUserId: U, groupId: G, idempotencyKey: 'k' });
    expect(out.id).toBe('M-1');
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(enter.mock.calls[0][0]).toBe(mockClient);
    expect(enter.mock.calls[0][3]).toBe('SELF-ACTOR'); // member
    expect(enter.mock.calls[0][4]).toBe('SELF-ACTOR'); // acting
    const i = (e: string) => log.indexOf(e);
    expect(i('BEGIN')).toBeGreaterThan(i('CONNECT'));
    expect(i('ADVISORY')).toBeGreaterThan(i('TENANT'));
    expect(i('WRITER')).toBeGreaterThan(i('PRINCIPAL'));
    expect(i('COMMIT')).toBeGreaterThan(i('WRITER'));
    expect(connect).toHaveBeenCalledTimes(1);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('nenhuma identidade client-declared: input com actionContext é ignorado', async () => {
    await groupActorMembershipService.enterMembershipSelf({
      tenantId: T, actingUserId: U, groupId: G, idempotencyKey: 'k',
      ...( { actionContext: { actorId: 'SPOOFED' } } as object ),
    } as never);
    expect(enter.mock.calls[0][3]).toBe('SELF-ACTOR');
    expect(JSON.stringify(enter.mock.calls[0])).not.toContain('SPOOFED');
  });
});

describe('entrada representada (page | group-raiz)', () => {
  test('exige canRepresentActor(member) NO client; membership pertence ao Actor representado', async () => {
    await groupActorMembershipService.enterMembershipAsRepresentative({
      tenantId: T, actingUserId: U, groupId: G, memberActorId: PAGE, idempotencyKey: 'k',
    });
    expect(canRepresentActor).toHaveBeenCalledTimes(1);
    expect(canRepresentActor.mock.calls[0][2]).toBe(PAGE);
    expect(canRepresentActor.mock.calls[0][3]).toBe(mockClient);
    expect(enter.mock.calls[0][3]).toBe(PAGE);          // membro = a page (nunca o humano)
    expect(enter.mock.calls[0][4]).toBe('SELF-ACTOR');  // autoria = humano atuante
  });

  test('sem representação → Forbidden; writer NUNCA; ROLLBACK; release 1×', async () => {
    canRepresentActor.mockResolvedValueOnce(false);
    await expect(groupActorMembershipService.enterMembershipAsRepresentative({
      tenantId: T, actingUserId: U, groupId: G, memberActorId: PAGE, idempotencyKey: 'k',
    })).rejects.toThrow(/GAM_MEMBER_NOT_REPRESENTED/);
    expect(enter).not.toHaveBeenCalled();
    expect(log).toContain('ROLLBACK');
    expect(log).not.toContain('COMMIT');
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });

  test('infra-error do predicado PROPAGA (não vira denial) com ROLLBACK', async () => {
    canRepresentActor.mockRejectedValueOnce(new Error('DB_DOWN'));
    await expect(groupActorMembershipService.enterMembershipAsRepresentative({
      tenantId: T, actingUserId: U, groupId: G, memberActorId: PAGE, idempotencyKey: 'k',
    })).rejects.toThrow('DB_DOWN');
    expect(log).toContain('ROLLBACK');
    expect(enter).not.toHaveBeenCalled();
  });
});

describe('leave / remove', () => {
  test('leave self (member == user-actor do principal) dispensa canRepresentActor', async () => {
    await groupActorMembershipService.leaveMembership({ tenantId: T, actingUserId: U, membershipId: 'M-1' });
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(leave.mock.calls[0][0]).toBe(mockClient);
  });

  test('leave de membro NÃO-self exige canRepresentActor(member) no client', async () => {
    findById.mockResolvedValue({ ...MEMBERSHIP, memberActorId: PAGE });
    await groupActorMembershipService.leaveMembership({ tenantId: T, actingUserId: U, membershipId: 'M-1' });
    expect(canRepresentActor).toHaveBeenCalledTimes(1);
    expect(canRepresentActor.mock.calls[0][2]).toBe(PAGE);
    expect(canRepresentActor.mock.calls[0][3]).toBe(mockClient);
  });

  test('remove exige canRepresentActor(group-actor) no client — nunca role/membership', async () => {
    await groupActorMembershipService.removeMembership({ tenantId: T, actingUserId: U, membershipId: 'M-1' });
    expect(canRepresentActor).toHaveBeenCalledTimes(1);
    expect(canRepresentActor.mock.calls[0][2]).toBe('GROUP-ACTOR');
    expect(canRepresentActor.mock.calls[0][3]).toBe(mockClient);
    expect(removeFn.mock.calls[0][0]).toBe(mockClient);
  });

  test('remove sem representação do Group → Forbidden + ROLLBACK', async () => {
    canRepresentActor.mockResolvedValueOnce(false);
    await expect(groupActorMembershipService.removeMembership({ tenantId: T, actingUserId: U, membershipId: 'M-1' }))
      .rejects.toThrow(/GAM_GROUP_NOT_REPRESENTED/);
    expect(removeFn).not.toHaveBeenCalled();
    expect(log).toContain('ROLLBACK');
  });
});

describe('intents explícitas', () => {
  test('invite: lado GROUP — canRepresentActor(group-actor); direção declarada', async () => {
    await groupActorMembershipService.createMembershipIntent({
      tenantId: T, actingUserId: U, groupId: G, candidateActorId: PAGE, intentKind: 'invite', idempotencyKey: 'k',
    });
    expect(canRepresentActor.mock.calls[0][2]).toBe('GROUP-ACTOR');
    expect(createIntent.mock.calls[0][5]).toBe('invite');
  });

  test('request self: candidato = user-actor do principal — sem representação extra', async () => {
    await groupActorMembershipService.createMembershipIntent({
      tenantId: T, actingUserId: U, groupId: G, candidateActorId: 'SELF-ACTOR', intentKind: 'request', idempotencyKey: 'k',
    });
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(createIntent.mock.calls[0][5]).toBe('request');
  });

  test('intentKind fora do vocabulário → fail-closed sem transação', async () => {
    await expect(groupActorMembershipService.createMembershipIntent({
      tenantId: T, actingUserId: U, groupId: G, candidateActorId: PAGE,
      intentKind: 'proposal' as never, idempotencyKey: 'k',
    })).rejects.toThrow(/GAM_INTENT_KIND_INVALID/);
    expect(connect).not.toHaveBeenCalled();
  });

  test('accept de INVITE: lado candidato (representante da page) no client; writer atômico', async () => {
    findById.mockResolvedValue({ ...MEMBERSHIP, id: 'M-2', memberActorId: PAGE, sourceIntentId: 'I-1' });
    const out = await groupActorMembershipService.acceptMembershipIntent({ tenantId: T, actingUserId: U, intentId: 'I-1' });
    expect(out.id).toBe('M-2');
    expect(canRepresentActor.mock.calls[0][2]).toBe(PAGE);
    expect(canRepresentActor.mock.calls[0][3]).toBe(mockClient);
    expect(acceptIntent.mock.calls[0][0]).toBe(mockClient);
  });

  test('accept de REQUEST: lado GROUP aprova (canRepresentActor(group-actor))', async () => {
    findIntent.mockResolvedValue({ id: 'I-1', groupId: G, candidateActorId: 'SELF-ACTOR', intentKind: 'request', status: 'pending' });
    await groupActorMembershipService.acceptMembershipIntent({ tenantId: T, actingUserId: U, intentId: 'I-1' });
    expect(canRepresentActor.mock.calls[0][2]).toBe('GROUP-ACTOR');
  });
});

describe('shadow validation — leitura pura', () => {
  test('não abre transação, não chama authority, não chama writer', async () => {
    const poolMod = await import('@core/database/pool');
    (poolMod.runQueriesWithTenant as jest.Mock).mockResolvedValueOnce([] as never);
    const { measureLegacyMembershipConvergence } = await import('../group-membership-shadow.readmodel');
    const report = await measureLegacyMembershipConvergence(T);
    expect(report.totalLegacyRows).toBe(0);
    expect(connect).not.toHaveBeenCalled();
    expect(canRepresentActor).not.toHaveBeenCalled();
    expect(enter).not.toHaveBeenCalled();
  });
});
