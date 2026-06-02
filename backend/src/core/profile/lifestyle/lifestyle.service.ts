// backend/src/core/profile/lifestyle/lifestyle.service.ts
//
// F2 (DECISION-0071) — regras do SSOT Lifestyle actor-first. SEM SQL cru (delega ao repository).
// Invariantes: (a) guarda de identidade do actor; (b) key/value governados (sem texto livre); (c)
// CONSENTIMENTO EXPLÍCITO obrigatório para declarar; (d) visibility SEMPRE private (não exposta como
// parâmetro → não-private é impossível pelo service, além do CHECK do schema); (e) remoção ANONIMIZA o
// valor (attribute_value → NULL); (f) TODA mutação grava audit SEM valor sensível.
// PROIBIÇÕES: zero global_users.metadata; zero ensureUserActor; zero saúde; zero targeting; zero blob.

import { HttpError } from '@core/errors/http-error';
import { lifestyleRepository } from './lifestyle.repository';
import {
  LIFESTYLE_ALLOWED_VALUES,
  LIFESTYLE_ATTRIBUTE_KEYS,
  type LifestyleAttributeKey,
  type LifestyleAttributeRow,
  type LifestyleAttributeDTO,
  type LifestyleProfileDTO,
  type DeclareLifestyleAttributeInput,
  type PersistAttributeInput,
  type LifestyleAuditAction,
} from './lifestyle.types';

const AUDIT_SOURCE = 'lifestyle_service' as const;

function toDTO(row: LifestyleAttributeRow): LifestyleAttributeDTO {
  return {
    attributeKey: row.attribute_key,
    attributeValue: row.attribute_value,
    visibility: row.visibility,
    isActive: row.is_active,
    consentedAt: row.consented_at ? row.consented_at.toISOString() : null,
    declaredAt: row.declared_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    retiredAt: row.retired_at ? row.retired_at.toISOString() : null,
  };
}

function isLifestyleKey(key: string): key is LifestyleAttributeKey {
  return (LIFESTYLE_ATTRIBUTE_KEYS as readonly string[]).includes(key);
}

class LifestyleService {
  private async resolveActorGuarded(tenantId: string, actorId: string): Promise<void> {
    const identity = await lifestyleRepository.getActorIdentityCheck(tenantId, actorId);
    if (!identity) {
      throw HttpError.notFound('Actor não encontrado');
    }
    if (identity.id !== identity.actor_id) {
      throw new HttpError('ACTOR_ID_INVARIANT_BROKEN', 500);
    }
  }

  // key governada + valor governado por key. `sexual_orientation` / health / texto livre ⇒ 400.
  private assertKeyAndValue(attributeKey: string, attributeValue: string): asserts attributeKey is LifestyleAttributeKey {
    if (!isLifestyleKey(attributeKey)) {
      throw HttpError.badRequest(
        `attributeKey inválido. Permitidos: ${LIFESTYLE_ATTRIBUTE_KEYS.join(', ')}`
      );
    }
    const allowed = LIFESTYLE_ALLOWED_VALUES[attributeKey];
    if (!allowed.includes(attributeValue)) {
      throw HttpError.badRequest(
        `attributeValue inválido para '${attributeKey}'. Permitidos: ${allowed.join(', ')}`
      );
    }
  }

  async getLifestyle(tenantId: string, actorId: string): Promise<LifestyleProfileDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    const rows = await lifestyleRepository.listActive(tenantId, actorId);
    return { attributes: rows.map(toDTO) };
  }

  // Declara/atualiza um atributo. CONSENTIMENTO EXPLÍCITO obrigatório. Idempotente: inativo → reativa
  // com novo consentimento; ativo → atualiza valor (+ re-consentimento); inexistente → insere.
  async declareAttribute(
    tenantId: string,
    actorId: string,
    input: DeclareLifestyleAttributeInput,
    performedByActorId?: string | null
  ): Promise<LifestyleAttributeDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    this.assertKeyAndValue(input.attributeKey, input.attributeValue);

    if (!input.consent || input.consent.granted !== true) {
      throw HttpError.badRequest('Consentimento explícito é obrigatório para declarar atributo de lifestyle');
    }

    const persist: PersistAttributeInput = {
      attributeValue: input.attributeValue,
      consentedAt: new Date(),
      consentSource: input.consent.source ?? null,
      consentVersion: input.consent.version ?? null,
    };

    const existing = await lifestyleRepository.findByKey(tenantId, actorId, input.attributeKey);

    let row: LifestyleAttributeRow | undefined;
    let action: LifestyleAuditAction;
    if (!existing) {
      row = await lifestyleRepository.insertActive(tenantId, actorId, input.attributeKey, persist);
      action = 'declare';
    } else if (!existing.is_active) {
      row = await lifestyleRepository.reactivate(tenantId, actorId, input.attributeKey, persist);
      action = 'declare'; // re-declarar um atributo retirado = reativação com novo consentimento
    } else {
      row = await lifestyleRepository.updateActive(tenantId, actorId, input.attributeKey, persist);
      action = 'update';
    }
    if (!row) throw new HttpError('LIFESTYLE_PERSIST_RACE', 500);

    await lifestyleRepository.insertAudit(tenantId, actorId, {
      attributeKey: input.attributeKey,
      action,
      performedByActorId: performedByActorId ?? actorId,
      source: AUDIT_SOURCE,
      reason: null,
    });

    return toDTO(row);
  }

  // Remove (desativa) um atributo ATIVO + ANONIMIZA o valor (attribute_value → NULL). Audit sem valor.
  async retireAttribute(
    tenantId: string,
    actorId: string,
    attributeKey: string,
    performedByActorId?: string | null
  ): Promise<LifestyleAttributeDTO> {
    await this.resolveActorGuarded(tenantId, actorId);
    if (!isLifestyleKey(attributeKey)) {
      throw HttpError.badRequest(`attributeKey inválido. Permitidos: ${LIFESTYLE_ATTRIBUTE_KEYS.join(', ')}`);
    }

    const row = await lifestyleRepository.retire(tenantId, actorId, attributeKey);
    if (!row) throw HttpError.notFound('Atributo de lifestyle ativo não encontrado');

    await lifestyleRepository.insertAudit(tenantId, actorId, {
      attributeKey,
      action: 'retire',
      performedByActorId: performedByActorId ?? actorId,
      source: AUDIT_SOURCE,
      reason: 'anonymize',
    });

    return toDTO(row);
  }
}

export const lifestyleService = new LifestyleService();
