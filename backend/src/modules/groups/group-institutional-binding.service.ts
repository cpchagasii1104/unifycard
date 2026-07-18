// backend/src/modules/groups/group-institutional-binding.service.ts
// D9.1 (DECISION-0186/0187) — service INTERNO do vinculo Group interno -> Actor organizacional
// institucional. SEM rota HTTP, SEM frontend, SEM membership, SEM capability nova, SEM Bank.
//
// AUTORIDADE DUAL V1 (DECISION-0187 D7): criar/retirar/reparent exige CUMULATIVAMENTE
//   canRepresentActor(institution_actor_id) E canRepresentActor(group_actor_id) — predicados
//   provados SEPARADAMENTE, server-side, fail-closed. Representar um lado NAO implica o outro.
//   Membership/role/residencia/metadata/actionContext.actorId NAO substituem nenhum predicado.
//   Infra-error NAO e mascarado como negacao: excecoes de authority PROPAGAM (sem catch->false).
// A revalidacao ESTRUTURAL (tenant/tipos/modo raiz-interno/anti-ciclo/unicidade) acontece DENTRO
//   da transacao das funcoes canonicas, sob advisory lock por tenant + FOR UPDATE.
// NAO-HERANCA (DECISION-0187 D9): este service nao cria membership/grant/delegacao/conta/endereco/
//   audience, nao altera owner civil/responsible/actor_type, nao cria Group nem Actor.

import { BadRequestError, NotFoundError } from '@core/errors';
import { HttpError } from '@core/errors/http-error';
import { ensureUserActor } from '@modules/identity/actor-writer.service';
import { authorizationService } from '@core/authorization/authorization.service';
import { runQueryWithTenant } from '@core/database/pool';
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
  /** Resolve o group-actor pelo 1:1 canonico (groups.actor_id). Nunca persiste 2a referencia. */
  private async resolveGroupActorId(tenantId: string, groupId: string): Promise<string> {
    const row = await runQueryWithTenant<GroupActorRow>(
      tenantId,
      `SELECT id::text AS group_id, actor_id::text AS actor_id FROM groups WHERE tenant_id = $1 AND id = $2`,
      [tenantId, groupId]
    );
    if (!row) {
      throw new NotFoundError('GIB_GROUP_NOT_FOUND: group inexistente no tenant.');
    }
    if (!row.actor_id) {
      throw new BadRequestError('GIB_GROUP_ACTOR_MISSING: group sem group-actor materializado.');
    }
    return row.actor_id;
  }

  /**
   * Autoridade dual (DECISION-0187 D7): os DOIS predicados, provados separadamente.
   * canRepresentActor e fail-closed; excecoes de infraestrutura PROPAGAM (nunca viram false aqui).
   */
  private async assertDualAuthority(
    tenantId: string,
    actingUserId: string,
    institutionActorId: string,
    groupActorId: string
  ): Promise<void> {
    const representsInstitution = await authorizationService.canRepresentActor(
      tenantId,
      actingUserId,
      institutionActorId
    );
    if (!representsInstitution) {
      throw HttpError.forbidden(
        'GIB_INSTITUTION_NOT_REPRESENTED: principal nao representa o Actor institucional (canRepresentActor lado instituicao).'
      );
    }
    const representsGroup = await authorizationService.canRepresentActor(tenantId, actingUserId, groupActorId);
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

  /** Cria vinculo Group -> Actor institucional (fn_bind_group_to_institution). */
  async bindGroupToInstitution(input: BindGroupToInstitutionInput): Promise<GroupInstitutionalBinding> {
    const { tenantId, actingUserId, groupId, institutionActorId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId, idempotencyKey);
    if (!groupId?.trim() || !institutionActorId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: groupId e institutionActorId obrigatorios.');
    }

    // principal autenticado -> actor atuante, resolvido server-side pelo writer unico (§4.8.1)
    const actingActor = await ensureUserActor(tenantId, actingUserId);
    const groupActorId = await this.resolveGroupActorId(tenantId, groupId);

    await this.assertDualAuthority(tenantId, actingUserId, institutionActorId, groupActorId);

    const bindingId = await groupInstitutionalBindingRepository.bind(
      tenantId,
      groupId,
      institutionActorId,
      actingActor.actor_id,
      idempotencyKey
    );
    const binding = await groupInstitutionalBindingRepository.findById(tenantId, bindingId);
    if (!binding) {
      throw new Error('GIB_WRITER_NO_RESULT: vinculo criado nao encontrado na releitura.');
    }
    return binding;
  }

  /** Retira vinculo ativo (terminal; historico preservado). */
  async retireBinding(input: RetireGroupInstitutionalBindingInput): Promise<GroupInstitutionalBinding> {
    const { tenantId, actingUserId, bindingId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId, idempotencyKey);
    if (!bindingId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: bindingId obrigatorio.');
    }

    const existing = await groupInstitutionalBindingRepository.findById(tenantId, bindingId);
    if (!existing) {
      throw new NotFoundError('GIB_BINDING_NOT_FOUND: vinculo inexistente no tenant.');
    }

    const actingActor = await ensureUserActor(tenantId, actingUserId);
    const groupActorId = await this.resolveGroupActorId(tenantId, existing.groupId);

    await this.assertDualAuthority(tenantId, actingUserId, existing.institutionActorId, groupActorId);

    const retiredId = await groupInstitutionalBindingRepository.retire(
      tenantId,
      bindingId,
      actingActor.actor_id,
      idempotencyKey
    );
    const binding = await groupInstitutionalBindingRepository.findById(tenantId, retiredId);
    if (!binding) {
      throw new Error('GIB_WRITER_NO_RESULT: vinculo retirado nao encontrado na releitura.');
    }
    return binding;
  }

  /**
   * Reparent = retire + NOVA linha, atomico (fn_reparent_group_institution).
   * Autoridade TRIPLA (mais restritiva): group-actor + parent ATUAL + parent NOVO.
   */
  async reparentGroupInstitution(input: ReparentGroupInstitutionInput): Promise<GroupInstitutionalBinding> {
    const { tenantId, actingUserId, groupId, newInstitutionActorId, idempotencyKey } = input;
    this.assertInputs(tenantId, actingUserId, idempotencyKey);
    if (!groupId?.trim() || !newInstitutionActorId?.trim()) {
      throw new BadRequestError('GIB_INPUT_NULL: groupId e newInstitutionActorId obrigatorios.');
    }

    const current = await groupInstitutionalBindingRepository.findActiveByGroup(tenantId, groupId);
    if (!current) {
      throw new NotFoundError('GIB_NO_ACTIVE_BINDING: reparent exige vinculo ativo.');
    }

    const actingActor = await ensureUserActor(tenantId, actingUserId);
    const groupActorId = await this.resolveGroupActorId(tenantId, groupId);

    // parent ATUAL (retirada) e parent NOVO (criacao) — ambos exigem representacao
    await this.assertDualAuthority(tenantId, actingUserId, current.institutionActorId, groupActorId);
    const representsNew = await authorizationService.canRepresentActor(tenantId, actingUserId, newInstitutionActorId);
    if (!representsNew) {
      throw HttpError.forbidden(
        'GIB_INSTITUTION_NOT_REPRESENTED: principal nao representa o NOVO Actor institucional.'
      );
    }

    const newBindingId = await groupInstitutionalBindingRepository.reparent(
      tenantId,
      groupId,
      newInstitutionActorId,
      actingActor.actor_id,
      idempotencyKey
    );
    const binding = await groupInstitutionalBindingRepository.findById(tenantId, newBindingId);
    if (!binding) {
      throw new Error('GIB_WRITER_NO_RESULT: vinculo reparented nao encontrado na releitura.');
    }
    return binding;
  }

  /** Read-model interno minimo (projecao; ZERO heranca — DECISION-0187 D9/§15). */
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
