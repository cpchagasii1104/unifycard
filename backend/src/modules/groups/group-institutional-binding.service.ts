// backend/src/modules/groups/group-institutional-binding.service.ts
// D9.1 (DECISION-0186/0187 + REMEDIAÇÃO AUTHORITY DUAL TRANSACTION BOUNDARY) — service INTERNO do
// vínculo Group interno -> Actor organizacional institucional. SEM rota HTTP, SEM frontend, SEM
// membership, SEM capability nova, SEM Bank.
//
// 🔒 FRONTEIRA TRANSACIONAL ÚNICA (remediação Veredito B): este service é o ÚNICO transaction owner
//   (BEGIN/COMMIT/ROLLBACK/release em withAuthorityTransaction). Dentro de UMA transação, no MESMO
//   client: tenant context -> serialização D9.1 por tenant (mesma chave advisory da fn SQL —
//   reentrante) -> resolução do principal (ensureUserActorTx, writer único §4.8.1 emprestando a
//   transação) -> resolução do Group/group-actor -> canRepresentActor(instituição) E
//   canRepresentActor(group-actor) TRANSACTION-AWARE (evidência FOR SHARE — revogação concorrente
//   serializa: ou espera nosso COMMIT, ou já venceu e a prova enxerga o estado revogado) -> função
//   canônica SQL no MESMO client -> COMMIT. Qualquer falha => ROLLBACK integral (idempotency key
//   NÃO consumida; zero estado parcial).
//
// AUTORIDADE DUAL V1 (DECISION-0187 D7): dois predicados SEPARADOS e cumulativos (reparent = TRÊS:
//   parent atual + group + parent novo). Representar um lado NUNCA implica o outro. Membership/role/
//   residência/metadata/actionContext.actorId NÃO substituem predicado. Infra-error PROPAGA e aborta
//   a transação (nunca vira false). Nenhuma lógica de authority duplicada em SQL de migration — o
//   SSOT (authorizationService §5.16) é reutilizado com `existingClient`.
// NÃO-HERANÇA (DECISION-0187 D9): zero membership/grant/delegação/conta/endereço/audience; não cria
//   Group/Actor; não altera owner civil/responsible/actor_type.

import type { PoolClient } from 'pg';
import { pool, runQueryWithTenant } from '@core/database/pool';
import { BadRequestError, NotFoundError } from '@core/errors';
import { HttpError } from '@core/errors/http-error';
import { ensureUserActorTx } from '@modules/identity/actor-writer.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { groupInstitutionalBindingRepository } from './group-institutional-binding.repository';
import type {
  BindGroupToInstitutionInput,
  GroupInstitutionalBinding,
  GroupInstitutionalBindingView,
  GroupInstitutionalMode,
  ReparentGroupInstitutionInput,
  RetireGroupInstitutionalBindingInput,
} from './group-institutional-binding.types';

interface GroupActorRow {
  group_id: string;
  actor_id: string | null;
}

class GroupInstitutionalBindingService {
  /**
   * TRANSACTION OWNER ÚNICO do D9.1: adquire o client, BEGIN, tenant context transacional,
   * serialização por tenant, executa `fn`, COMMIT. Falha => ROLLBACK. release exatamente UMA vez.
   * Nenhum helper/repository abre client próprio; a authority SÓ roda depois do BEGIN.
   */
  private async withAuthorityTransaction<T>(
    tenantId: string,
    fn: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // tenant context TRANSACIONAL (set_config local=true morre no COMMIT/ROLLBACK — sem vazamento)
      await client.query(`SELECT set_config('app.current_tenant', $1, true)`, [tenantId]);
      // serialização D9.1 por tenant ANTES de qualquer evidência — MESMA chave da fn SQL (reentrante
      // na mesma transação); elimina deadlock entre evidência FOR SHARE e locks do writer.
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtextextended('group_institutional_bindings:' || $1::text, 0))`,
        [tenantId]
      );
      const out = await fn(client);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // conexão possivelmente inutilizada — o release abaixo devolve/destrói o client
      }
      throw e;
    } finally {
      client.release();
    }
  }

  /** Resolve o group-actor pelo 1:1 canônico (groups.actor_id) NO client da transação (FOR SHARE). */
  private async resolveGroupActorIdOnClient(
    client: PoolClient,
    tenantId: string,
    groupId: string
  ): Promise<string> {
    const res = await client.query(
      `SELECT id::text AS group_id, actor_id::text AS actor_id FROM groups WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
      [tenantId, groupId]
    );
    const row = res.rows[0] as GroupActorRow | undefined;
    if (!row) {
      throw new NotFoundError('GIB_GROUP_NOT_FOUND: group inexistente no tenant.');
    }
    if (!row.actor_id) {
      throw new BadRequestError('GIB_GROUP_ACTOR_MISSING: group sem group-actor materializado.');
    }
    return row.actor_id;
  }

  /**
   * Autoridade dual (DECISION-0187 D7) DENTRO da transação: os DOIS predicados, provados
   * separadamente, no MESMO client (canRepresentActor transaction-aware, evidência FOR SHARE).
   * Exceções de infraestrutura PROPAGAM (abortam a transação); false = negação legítima.
   */
  private async assertDualAuthority(
    client: PoolClient,
    tenantId: string,
    actingUserId: string,
    institutionActorId: string,
    groupActorId: string
  ): Promise<void> {
    const representsInstitution = await authorizationService.canRepresentActor(
      tenantId,
      actingUserId,
      institutionActorId,
      client
    );
    if (!representsInstitution) {
      throw HttpError.forbidden(
        'GIB_INSTITUTION_NOT_REPRESENTED: principal nao representa o Actor institucional (canRepresentActor lado instituicao).'
      );
    }
    const representsGroup = await authorizationService.canRepresentActor(
      tenantId,
      actingUserId,
      groupActorId,
      client
    );
    if (!representsGroup) {
      throw HttpError.forbidden(
        'GIB_GROUP_NOT_REPRESENTED: principal nao representa o group-actor (canRepresentActor lado group).'
      );
    }
  }

  private assertInputs(tenantId: string, actingUserId: string, idempotencyKey: string): void {
    if (!tenantId?.trim() || !actingUserId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: tenant e principal autenticado sao obrigatorios (server-side).');
    }
    if (!idempotencyKey?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: idempotencyKey obrigatoria.');
    }
  }

  /** Cria vínculo Group -> Actor institucional — transação única (authority + writer + commit). */
  async bindGroupToInstitution(input: BindGroupToInstitutionInput): Promise<GroupInstitutionalBinding> {
    const { tenantId, actingUserId, groupId, institutionActorId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId, idempotencyKey);
    if (!groupId?.trim() || !institutionActorId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: groupId e institutionActorId obrigatorios.');
    }

    return this.withAuthorityTransaction(tenantId, async (client) => {
      // principal autenticado -> actor atuante, resolvido server-side pelo writer único NA transação
      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      const groupActorId = await this.resolveGroupActorIdOnClient(client, tenantId, groupId);

      await this.assertDualAuthority(client, tenantId, actingUserId, institutionActorId, groupActorId);

      const bindingId = await groupInstitutionalBindingRepository.bind(
        client,
        tenantId,
        groupId,
        institutionActorId,
        actingActor.actor_id,
        idempotencyKey
      );
      const binding = await groupInstitutionalBindingRepository.findById(tenantId, bindingId, client);
      if (!binding) {
        throw new Error('GIB_WRITER_NO_RESULT: vinculo criado nao encontrado na releitura transacional.');
      }
      return binding;
    });
  }

  /** Retira vínculo (terminal; histórico preservado) — transação única. */
  async retireBinding(input: RetireGroupInstitutionalBindingInput): Promise<GroupInstitutionalBinding> {
    const { tenantId, actingUserId, bindingId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId, idempotencyKey);
    if (!bindingId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: bindingId obrigatorio.');
    }

    return this.withAuthorityTransaction(tenantId, async (client) => {
      const existing = await groupInstitutionalBindingRepository.findById(tenantId, bindingId, client);
      if (!existing) {
        throw new NotFoundError('GIB_BINDING_NOT_FOUND: vinculo inexistente no tenant.');
      }

      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      const groupActorId = await this.resolveGroupActorIdOnClient(client, tenantId, existing.groupId);

      await this.assertDualAuthority(client, tenantId, actingUserId, existing.institutionActorId, groupActorId);

      const retiredId = await groupInstitutionalBindingRepository.retire(
        client,
        tenantId,
        bindingId,
        actingActor.actor_id,
        idempotencyKey
      );
      const binding = await groupInstitutionalBindingRepository.findById(tenantId, retiredId, client);
      if (!binding) {
        throw new Error('GIB_WRITER_NO_RESULT: vinculo retirado nao encontrado na releitura transacional.');
      }
      return binding;
    });
  }

  /**
   * Reparent = retire + NOVA linha, atômico (fn_reparent_group_institution) — transação única com
   * autoridade TRIPLA no MESMO client: parent ATUAL + group-actor + parent NOVO.
   */
  async reparentGroupInstitution(input: ReparentGroupInstitutionInput): Promise<GroupInstitutionalBinding> {
    const { tenantId, actingUserId, groupId, newInstitutionActorId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId, idempotencyKey);
    if (!groupId?.trim() || !newInstitutionActorId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: groupId e newInstitutionActorId obrigatorios.');
    }

    return this.withAuthorityTransaction(tenantId, async (client) => {
      const current = await groupInstitutionalBindingRepository.findActiveByGroup(tenantId, groupId, client);
      if (!current) {
        throw new NotFoundError('GIB_NO_ACTIVE_BINDING: reparent exige vinculo ativo.');
      }

      const actingActor = await ensureUserActorTx(client, tenantId, actingUserId);
      const groupActorId = await this.resolveGroupActorIdOnClient(client, tenantId, groupId);

      // parent ATUAL (retirada) + group — e o TERCEIRO predicado: parent NOVO (criação)
      await this.assertDualAuthority(client, tenantId, actingUserId, current.institutionActorId, groupActorId);
      const representsNew = await authorizationService.canRepresentActor(
        tenantId,
        actingUserId,
        newInstitutionActorId,
        client
      );
      if (!representsNew) {
        throw HttpError.forbidden(
          'GIB_INSTITUTION_NOT_REPRESENTED: principal nao representa o NOVO Actor institucional.'
        );
      }

      const newBindingId = await groupInstitutionalBindingRepository.reparent(
        client,
        tenantId,
        groupId,
        newInstitutionActorId,
        actingActor.actor_id,
        idempotencyKey
      );
      const binding = await groupInstitutionalBindingRepository.findById(tenantId, newBindingId, client);
      if (!binding) {
        throw new Error('GIB_WRITER_NO_RESULT: vinculo reparented nao encontrado na releitura transacional.');
      }
      return binding;
    });
  }

  /** Read-model interno mínimo (projeção; ZERO herança — DECISION-0187 D9/§15). Leitura pura, sem tx. */
  async getGroupInstitutionalBindingView(tenantId: string, groupId: string): Promise<GroupInstitutionalBindingView> {
    if (!tenantId?.trim() || !groupId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: tenant e groupId obrigatorios.');
    }
    const row = await runQueryWithTenant<GroupActorRow>(
      tenantId,
      `SELECT id::text AS group_id, actor_id::text AS actor_id FROM groups WHERE tenant_id = $1 AND id = $2`,
      [tenantId, groupId]
    );
    if (!row) {
      throw new NotFoundError('GIB_GROUP_NOT_FOUND: group inexistente no tenant.');
    }

    const history = await groupInstitutionalBindingRepository.listByGroup(tenantId, groupId);
    const activeBinding = history.find((b) => b.status === 'active') ?? null;
    const activeChildrenGroupIds = row.actor_id
      ? await groupInstitutionalBindingRepository.listActiveChildrenGroupIds(tenantId, row.actor_id)
      : [];

    let mode: GroupInstitutionalMode = 'standalone';
    if (activeBinding) {
      mode = 'internal';
    } else if (activeChildrenGroupIds.length > 0) {
      mode = 'root';
    }

    return {
      groupId,
      groupActorId: row.actor_id,
      mode,
      activeBinding,
      history,
      activeChildrenGroupIds,
    };
  }
}

export const groupInstitutionalBindingService = new GroupInstitutionalBindingService();
