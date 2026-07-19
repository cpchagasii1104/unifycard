// backend/src/core/authorization/authorization.service.ts
// CONTINUOUS PRODUCTION: Authorization Service Centralizado
// Centraliza lógica de permissões sem espalhar ifs

import { socialPortsRegistry } from '@core/social/ports-registry';
import type { TxQueryClient } from '@core/social/ports';
import { actorRegistryService, type ActorRegistryEntry } from '../actor-registry/actor-registry.service';
import { actorDelegationRepository } from '../actor-delegation/actor-delegation.repository';
import { resolveGlobalUserId } from '@core/identity/identity.utils';
import { runQueryWithTenant } from '@core/database/pool';
import { canonicalLogger } from '@core/logging/canonical-logger';
import type { PermissionKey } from './permission-keys';
import { PERMISSION_CAPABILITIES, isValidPermissionKey } from './permission-keys';
import { COMPANY_POLICY_REGISTRY } from './company-policy-registry';
import { shadowAuthorizationService } from './shadow-authorization.service';
import type { ShadowAuthDivergenceLog } from './shadow-auth.types';

export type AuthoritySource = 'ownership' | 'delegation' | 'system' | 'membership_grant';

export interface AuthorizationResult {
  allowed: boolean;
  authoritySource?: AuthoritySource;
  reason?: string;
}

class AuthorizationService {
  /**
   * 🔴 GUARD CANÔNICO: Validação explícita de inputs críticos
   * Nenhuma resolução de permissão ocorre sem contexto completo e válido
   */
  private validateInputs(
    tenantId: string | undefined | null,
    userId: string | undefined | null,
    actorId: string | undefined | null,
    permissionKey: PermissionKey | undefined | null
  ): void {
    if (!tenantId || typeof tenantId !== 'string' || tenantId.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: tenantId is required and must be a non-empty string');
    }

    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: userId is required and must be a non-empty string');
    }

    if (!actorId || typeof actorId !== 'string' || actorId.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: actorId is required and must be a non-empty string');
    }

    if (!permissionKey || typeof permissionKey !== 'string' || permissionKey.trim() === '') {
      throw new Error('PERMISSION_RESOLUTION_ERROR: permissionKey is required and must be a non-empty string');
    }

    if (!isValidPermissionKey(permissionKey)) {
      throw new Error(
        `PERMISSION_RESOLUTION_ERROR: permissionKey "${permissionKey}" is not defined in canonical map. ` +
        `See MAPA_CANONICO_PERMISSIONS_v1.md for valid permissions.`
      );
    }
  }

  /**
   * Verifica se user pode atuar como actor
   * 
   * 🔴 GARANTIAS CANÔNICAS:
   * - tenantId obrigatório (não-null, não-vazio)
   * - userId obrigatório (não-null, não-vazio)
   * - actorId obrigatório (não-null, não-vazio)
   * - permissionKey obrigatório e válido (deve existir no mapa canônico)
   * - Resolução determinística (mesmos inputs = mesmo resultado)
   * - Logs canônicos para todas as decisões de deny
   * 
   * Ordem de verificação:
   * 1. Ownership (user é o próprio actor ou owner da entidade)
   * 2. Delegation (user tem delegação ativa)
   * 3. Ramo legado: capability no registry sem vínculo → deny (não é allow implícito)
   *
   * Antes de qualquer `allowed: true`, se {@link PERMISSION_CAPABILITIES} exige string,
   * exige linha em `actor_registry` com `capabilities_json[cap] === true`.
   */
  async canActAs(
    tenantId: string,
    userId: string,
    actorId: string,
    permissionKey: PermissionKey,
    scope?: string
  ): Promise<AuthorizationResult> {
    // 🔴 GUARD CANÔNICO: Validar inputs críticos antes de qualquer resolução
    this.validateInputs(tenantId, userId, actorId, permissionKey);

    // 🔴 LOG CANÔNICO: Início da resolução (para observabilidade)
    canonicalLogger.debug(null, 'Iniciando resolução de permissão', {
      tenantId,
      userId,
      actorId,
      permissionKey,
      scope: scope || 'N/A',
    });

    // 1. Buscar actor
    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      const result: AuthorizationResult = { 
        allowed: false, 
        reason: 'Actor not found',
      };
      
      // 🔴 LOG CANÔNICO: Decisão de deny (actor não encontrado)
      canonicalLogger.authzDeny(null, 'Permissão negada: Actor não encontrado', {
        tenantId,
        userId,
        actorId,
        permissionKey,
        reason: result.reason,
      });
      
      // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
      this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
        .catch(() => {}); // Engolir erros silenciosamente
      
      return result;
    }

    const registry = await actorRegistryService.findByActorId(tenantId, actorId);

    // 🔒 DECISION-0189 (F3) — DISPATCH DO REGISTRY DE POLICIES EMPRESARIAIS.
    // Chaves company_grant_terminal CURTO-CIRCUITAM AQUI (allow por subject grant OU deny
    // terminal) — NUNCA caem nos ramos de ownership/role/is_primary/delegation abaixo.
    // Chaves company_grant (não-terminais) ganham o ramo de grant ADITIVO (fallback legado
    // permanece até o cutover F4). manage_members com actor de GRUPO = FAIL-CLOSED (R6).
    const dispatched = await this.dispatchCompanyPolicy(
      tenantId, userId, actorId,
      { company_id: (actor as { company_id?: string | null }).company_id ?? null,
        group_id: (actor as { group_id?: string | null }).group_id ?? null },
      registry,
      permissionKey
    );
    if (dispatched) {
      if (dispatched.allowed) {
        canonicalLogger.authzAllow(null, 'Permissão concedida: subject grant de membership (DECISION-0189)', {
          tenantId, userId, actorId, permissionKey, authoritySource: dispatched.authoritySource,
        });
      } else {
        canonicalLogger.authzDeny(null, 'Permissão negada: policy empresarial terminal (DECISION-0189)', {
          tenantId, userId, actorId, permissionKey, reason: dispatched.reason,
        });
      }
      return dispatched;
    }

    // 2. Verificar ownership (user é o próprio actor)
    // Inclui actor_human / person (schema 0064) além do canónico 'user' (LEI §4.8.7).
    //
    // 🔴 FIX (2026-07-05, achado ao testar a Fatia 3 — Clayton não conseguia criar NENHUM post
    // como PF; zero posts existiam em dev): `ActorRegistryType` ('company'|'event'|'group'|
    // 'service'|'project') EXCLUI 'user'/'actor_human'/'person' por design — o registry só é
    // populado (lazy) para actors INSTITUCIONAIS (`actorRegistryService.register`, ver
    // company-members.service.ts). Um actor PF nunca ganha linha em `actor_registry`. Antes,
    // este branch (ownership direto de si mesmo) exigia `denyIfMissingRequiredRegistryCapability`
    // — que SEMPRE nega (registry null) para QUALQUER PF, em QUALQUER permissão com capability
    // requerida (ex.: publish_feed→can_publish_feed). Isso bloqueava toda pessoa física de postar,
    // criar evento, criar grupo etc. — desde sempre (dev tinha 0 posts). O primitivo irmão
    // `canRepresentActor` (mesma condição de ownership, linha ~345) já é documentado como
    // "registry-INDEPENDENTE" — a inconsistência era só aqui. Fix: dono do PRÓPRIO actor (já
    // provado via `actor.user_id === userId`) não passa pelo modelo de capability do registry
    // institucional — não introduz autoridade sobre OUTRO actor (zero risco de IDOR/impersonação;
    // a igualdade `user_id === userId` já é a prova). Institucional (ramo 3) e delegação (ramo 4)
    // seguem exigindo a capability normalmente.
    if (
      actor.user_id === userId &&
      (actor.actor_type === 'user' ||
        actor.actor_type === 'actor_human' ||
        actor.actor_type === 'person')
    ) {
      const result: AuthorizationResult = {
        allowed: true,
        authoritySource: 'ownership',
      };
      
      // 🔴 LOG CANÔNICO: Decisão de allow (ownership direto)
      canonicalLogger.authzAllow(null, 'Permissão concedida: Ownership direto', {
        tenantId,
        userId,
        actorId,
        permissionKey,
        authoritySource: result.authoritySource,
      });
      
      // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
      this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
        .catch(() => {}); // Engolir erros silenciosamente
      
      return result;
    }

    // 3. Verificar se é owner da entidade (para actors institucionais)
    if (registry) {
      const isOwner = await this.checkOwnership(tenantId, userId, registry.entityTable, registry.entityId);
      if (isOwner) {
        const capDeny = this.denyIfMissingRequiredRegistryCapability(permissionKey, registry);
        if (capDeny) {
          canonicalLogger.authzDeny(null, 'Permissão negada: capability obrigatória ausente no registry', {
            tenantId,
            userId,
            actorId,
            permissionKey,
            reason: capDeny.reason,
          });
          this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, capDeny)
            .catch(() => {});
          return capDeny;
        }

        const result: AuthorizationResult = { 
          allowed: true, 
          authoritySource: 'ownership',
        };
        
        // 🔴 LOG CANÔNICO: Decisão de allow (ownership de entidade)
        canonicalLogger.authzAllow(null, 'Permissão concedida: Ownership de entidade', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          entityTable: registry.entityTable,
          entityId: registry.entityId,
          authoritySource: result.authoritySource,
        });
        
        // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
          .catch(() => {}); // Engolir erros silenciosamente
        
        return result;
      }
    }

    // 4. Verificar delegação
    const delegation = await this.findActiveDelegation(tenantId, userId, actorId);
    if (delegation) {
      const hasPermission = this.checkDelegationPermission(delegation.scopes, permissionKey);
      if (hasPermission) {
        const capDeny = this.denyIfMissingRequiredRegistryCapability(permissionKey, registry);
        if (capDeny) {
          canonicalLogger.authzDeny(null, 'Permissão negada: capability obrigatória ausente no registry', {
            tenantId,
            userId,
            actorId,
            permissionKey,
            reason: capDeny.reason,
          });
          this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, capDeny)
            .catch(() => {});
          return capDeny;
        }

        const result: AuthorizationResult = { 
          allowed: true, 
          authoritySource: 'delegation',
        };
        
        // 🔴 LOG CANÔNICO: Decisão de allow (delegação)
        canonicalLogger.authzAllow(null, 'Permissão concedida: Delegação', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          delegationScopes: delegation.scopes,
          authoritySource: result.authoritySource,
        });
        
        // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
          .catch(() => {}); // Engolir erros silenciosamente
        
        return result;
      } else {
        // 🔴 LOG CANÔNICO: Delegação existe mas não cobre a permissão
        canonicalLogger.authzDeny(null, 'Delegação existe mas não cobre permissão', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          delegationScopes: delegation.scopes,
        });
      }
    }

    // 5. Verificar capabilities do actor (system)
    if (registry) {
      const hasCapability = this.checkCapability(registry.capabilities, permissionKey);
      if (hasCapability) {
        // Mas user precisa ter acesso (ownership ou delegation)
        // Se chegou aqui, não tem acesso
        const result: AuthorizationResult = { 
          allowed: false, 
          reason: 'Actor has capability but user lacks access (no ownership or delegation)',
        };
        
        // 🔴 LOG CANÔNICO: Decisão de deny (capability sem acesso)
        canonicalLogger.authzDeny(null, 'Permissão negada: Capability sem acesso', {
          tenantId,
          userId,
          actorId,
          permissionKey,
          requiredCapability: PERMISSION_CAPABILITIES[permissionKey],
          actorCapabilities: registry.capabilities,
          reason: result.reason,
        });
        
        // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
        this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
          .catch(() => {}); // Engolir erros silenciosamente
        
        return result;
      }
    }

    // 🔴 LOG CANÔNICO: Decisão de deny (nenhuma autorização encontrada)
    const result: AuthorizationResult = { 
      allowed: false, 
      reason: 'No valid authorization found (checked: ownership, delegation, capabilities)',
    };
    
    canonicalLogger.authzDeny(null, 'Permissão negada: Nenhuma autorização válida', {
      tenantId,
      userId,
      actorId,
      permissionKey,
      actorType: actor.actor_type,
      hasRegistry: !!registry,
      hasDelegation: !!delegation,
      reason: result.reason,
    });
    
    // 🔀 SHADOW AUTHORIZATION (Fase 2B) - Execução não-bloqueante
    this.calculateAndLogShadowDivergence(tenantId, userId, actorId, permissionKey, scope, result)
      .catch(() => {}); // Engolir erros silenciosamente
    
    return result;
  }

  /**
   * DECISION-0189 (F3) — resolve a TRÍADE empresarial para a PermissionKey:
   * classificação do COMPANY_POLICY_REGISTRY × capability do actor (registry) × subject grant
   * (coluna allowlisted de company_users, membership ATIVA). Retorna:
   *   AuthorizationResult → decisão FINAL (allow por grant; deny TERMINAL; deny grupo fail-closed);
   *   null → chave/actor fora do domínio empresarial OU chave não-terminal sem grant (fallback legado até F4).
   * NUNCA monta SQL a partir de texto do cliente: coluna vem da allowlist tipada do registry.
   */
  private async dispatchCompanyPolicy(
    tenantId: string,
    userId: string,
    actorId: string,
    actor: { company_id: string | null; group_id: string | null },
    registry: ActorRegistryEntry | null,
    permissionKey: PermissionKey
  ): Promise<AuthorizationResult | null> {
    const entry = COMPANY_POLICY_REGISTRY[permissionKey];
    if (!entry) {
      // impossível com boot fail-closed (assertCompanyPolicyRegistryExhaustive) — defesa em profundidade
      return { allowed: false, reason: `PermissionKey sem classificação no policy registry: ${permissionKey}` };
    }

    // R6: contexto GRUPO com substrato dormente → fail-closed (nunca cai no fallback antigo).
    if (actor.group_id && entry.groupBehavior === 'fail_closed') {
      return { allowed: false, reason: 'Group substrate dormant: permission fail-closed for group actors (DECISION-0189 R6)' };
    }

    const isCompanyGrant =
      entry.classification === 'company_grant' || entry.classification === 'company_grant_terminal';
    if (!actor.company_id || !isCompanyGrant || !entry.grantColumn) {
      return null;
    }
    const terminal = entry.classification === 'company_grant_terminal';

    // Perna capability (tríade): o TIPO do actor suporta a ação?
    const requiredCapability = entry.companyActorCapability ?? PERMISSION_CAPABILITIES[permissionKey];
    const capabilityOk =
      requiredCapability === null ||
      requiredCapability === undefined ||
      registry?.capabilities?.[requiredCapability] === true;

    // Perna subject grant: ESTE usuário pode NESTE actor? (membership ativa + coluna true)
    let granted = false;
    const globalUserId = await this.safeResolveGlobalUserId(userId, tenantId);
    if (globalUserId) {
      const row = await runQueryWithTenant<{ granted: boolean }>(
        tenantId,
        `SELECT ${entry.grantColumn} AS granted FROM company_users
          WHERE tenant_id = $1 AND company_id = $2 AND global_user_id = $3::uuid
            AND member_status = 'active'
          LIMIT 1`,
        [tenantId, actor.company_id, globalUserId]
      );
      granted = row?.granted === true;
    }

    if (granted && capabilityOk) {
      return { allowed: true, authoritySource: 'membership_grant' };
    }

    // 🔒 CUTOVER F4 (DECISION-0189 R8): para actor de EMPRESA, TODA chave company_grant*
    // é decidida AQUI — ownership/role/is_primary NUNCA mais autorizam chave empresarial.
    // Representante EXTERNO (não-membership) segue válido para chaves DELEGÁVEIS, via
    // actor_delegations (exclusividade §6.3 garante que membership e delegação não coexistem
    // na mesma relação — trigger ativo desde a migration F4).
    if (entry.delegable === true) {
      const delegation = await this.findActiveDelegation(tenantId, userId, actorId);
      if (delegation && this.checkDelegationPermission(delegation.scopes, permissionKey) && capabilityOk) {
        return { allowed: true, authoritySource: 'delegation' };
      }
    }
    return {
      allowed: false,
      reason: granted
        ? 'Missing required capability (company policy)'
        : terminal
          ? 'Missing required subject grant (terminal company policy — no ownership/role fallback)'
          : 'Missing required subject grant (company policy — ownership fallback retired in F4 cutover)',
    };
  }

  /**
   * REPRESENTABILIDADE (DECISION-0113): "este `userId` pode VESTIR este `actorId`?"
   *
   * Primitivo **permission-agnóstico** e **registry-INDEPENDENTE**, distinto de `canActAs`
   * (que mistura representabilidade + autorização de uma `PermissionKey`). O RBAC (`rbac.plugin`)
   * precisa SÓ desta pergunta antes de decidir role/permission — `actionContext.actorId` é hint
   * não-soberano; a autoridade real exige que o principal autenticado possa representar o actor.
   *
   * Fontes (todas server-side, fail-closed):
   *  1. ownership direto — `actors.user_id === userId` (user/actor_human/person);
   *  2. empresa/page-actor — `actors.company_id → company_users` (via `checkOwnership('companies')`,
   *     **sem** depender de `actor_registry`, que é populado lazy — só em add-member);
   *  3. grupo — `actors.group_id → groups.owner_actor_id` (via `checkOwnership('groups')`);
   *  4. registry-bônus — se houver linha em `actor_registry`, `checkOwnership(entityTable,entityId)`
   *     cobre casos adicionais (ex.: events) quando o registro existir;
   *  5. delegação ativa — `actor_delegations` (via `findActiveDelegation`, já valida ativa/expira/revoga).
   *
   * NÃO decide role/permission/capability. NÃO infere actorId. Retorna apenas true/false.
   *
   * 🔒 TRANSACTION-AWARE (remediação D9.1 · AUTHORITY DUAL TRANSACTION BOUNDARY): quando o caller
   * fornece `existingClient` (client transacional JÁ aberto, com tenant context estabelecido), TODA
   * a cadeia de evidência roda NESSE client e as linhas DECISIVAS são lidas `FOR SHARE` — o que
   * serializa esta prova contra os writers canônicos de revogação (UPDATE em company_users /
   * actor_delegations / groups / users bloqueia até o COMMIT do caller; se a revogação commitou
   * antes, esta leitura JÁ enxerga o estado revogado → deny). Sem `existingClient`, o caminho
   * pool/autocommit permanece BYTE-IDÊNTICO em semântica (callers atuais inalterados).
   * No caminho transacional, erros de infraestrutura PROPAGAM (dentro de transação, engolir erro
   * mascararia uma tx abortada como negação — o fail-closed real é abortar a transação inteira).
   */
  async canRepresentActor(
    tenantId: string,
    userId: string,
    actorId: string,
    existingClient?: TxQueryClient
  ): Promise<boolean> {
    // Inputs inválidos → fail-closed (deny).
    if (!tenantId?.trim() || !userId?.trim() || !actorId?.trim()) {
      return false;
    }

    if (existingClient) {
      return this.canRepresentActorOnClient(tenantId, userId, actorId, existingClient);
    }

    const actorRepository = socialPortsRegistry.getActorRepository();
    const actor = await actorRepository.findById(tenantId, actorId);
    if (!actor) {
      return false; // actor inexistente no tenant → deny
    }

    // 1. Ownership direto (actor humano do próprio user) — registry-independente.
    if (
      actor.user_id === userId &&
      (actor.actor_type === 'user' ||
        actor.actor_type === 'actor_human' ||
        actor.actor_type === 'person')
    ) {
      return true;
    }

    // 2. Empresa / page-actor — registry-INDEPENDENTE, via o check CANÔNICO `canManageCompany`
    //    (`can_manage_company OR role='owner'`), NÃO o `checkOwnership` legado (que só vê
    //    `is_primary`/`role='admin'` e ignora o dono `role='owner'`). `resolveGlobalUserId` é
    //    fail-closed: principal desconhecido → null → deny.
    if (actor.company_id) {
      const globalUserId = await this.safeResolveGlobalUserId(userId, tenantId);
      if (globalUserId) {
        const { companiesService } = await import('@core/companies/companies.service');
        if (await companiesService.canManageCompany(tenantId, actor.company_id, globalUserId)) {
          return true;
        }
      }
    }

    // 3. Grupo — registry-INDEPENDENTE (actors.group_id → groups.owner_actor_id).
    if (actor.group_id && (await this.safeCheckOwnership(tenantId, userId, 'groups', actor.group_id))) {
      return true;
    }

    // 4. Registry-bônus: cobre entidades cujo vínculo não vive em coluna do actor (ex.: events),
    //    quando a linha de registry existir. Não é pré-requisito (2/3 já cobrem empresa/grupo).
    const registry = await actorRegistryService.findByActorId(tenantId, actorId);
    if (
      registry?.entityTable &&
      registry?.entityId &&
      (await this.safeCheckOwnership(tenantId, userId, registry.entityTable, registry.entityId))
    ) {
      return true;
    }

    // 5. Delegação ativa (não-expirada/não-revogada — garantido pelo repositório).
    // 🔴 SCOPE-CONTAINMENT FIX (DT-AUTHORITY-LATENTS-PASSO-3 ①; ratifica DECISION-0125 §escopo:
    // "autoridade é ESCOPADA, blanket-sem-escopo = fail-closed"). REPRESENTAÇÃO (vestir o actor,
    // permission-agnostic) só é concedida por delegação FULL (`scopes` inclui '*'). Uma delegação
    // ESCOPADA (ex.: ['post:create']) NÃO concede representação em branco — concede APENAS aquelas
    // permissões, via checkPermission/canActAs (checkDelegationPermission, scope-aware). Antes, QUALQUER
    // delegação ativa retornava true aqui, tornando um delegado de escopo estreito over-privileged em
    // TODA rota canRepresentActor-gated (inclui eventos/vitrine/social/etc). Fail-closed: escopo estreito
    // fica limitado às rotas que checam a PermissionKey específica (canActAs), não à representação ampla.
    // Latente hoje (0 delegações ativas). O afrouxamento correto por-rota (canActAs com PermissionKey)
    // é a frente F-CANREPRESENTACTOR-SCOPE-AWARE / PORTA-3.
    const delegation = await this.findActiveDelegation(tenantId, userId, actorId);
    if (delegation && Array.isArray(delegation.scopes) && delegation.scopes.includes('*')) {
      return true;
    }

    return false;
  }

  /**
   * Caminho TRANSACIONAL de canRepresentActor (remediação D9.1). MESMAS 5 fontes, MESMA ordem e
   * MESMOS predicados do caminho pool — executados no client do caller, com a evidência decisiva
   * lida FOR SHARE. Nenhuma fonte nova; nenhuma lógica movida para SQL de migration; a fachada de
   * authority (SSOT §5.16) continua a ÚNICA dona da pergunta. Erros PROPAGAM (tx do caller aborta).
   */
  private async canRepresentActorOnClient(
    tenantId: string,
    userId: string,
    actorId: string,
    client: TxQueryClient
  ): Promise<boolean> {
    // Actor alvo (evidência raiz) — FOR SHARE: revogar/mutar o actor concorre com esta prova.
    const aRes = await client.query(
      `SELECT id::text AS id, actor_type, user_id::text AS user_id,
              company_id::text AS company_id, group_id::text AS group_id
         FROM actors WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
      [tenantId, actorId]
    );
    const actor = aRes.rows[0] as
      | { id: string; actor_type: string; user_id: string | null; company_id: string | null; group_id: string | null }
      | undefined;
    if (!actor) {
      return false;
    }

    // 1. Ownership direto (mesmo predicado do caminho pool).
    if (
      actor.user_id === userId &&
      (actor.actor_type === 'user' || actor.actor_type === 'actor_human' || actor.actor_type === 'person')
    ) {
      return true;
    }

    // 2. Empresa/page — canManageCompany CANÔNICO no MESMO client (evidência company_users FOR SHARE).
    if (actor.company_id) {
      const globalUserId = await resolveGlobalUserId(userId, tenantId, client).catch((e) => {
        // 'não encontrado' é negação legítima (paridade com safeResolveGlobalUserId);
        // erro de tx abortada/infra NÃO pode virar deny — propaga.
        if (e instanceof Error && /resolveGlobalUserId/.test(e.message)) return null;
        throw e;
      });
      if (globalUserId) {
        const { companiesService } = await import('@core/companies/companies.service');
        if (await companiesService.canManageCompany(tenantId, actor.company_id, globalUserId, client)) {
          return true;
        }
      }
    }

    // 3. Grupo — owner civil no MESMO client (groups + owner actor FOR SHARE).
    if (actor.group_id) {
      const gRes = await client.query(
        `SELECT owner_actor_id::text AS owner_actor_id FROM groups
          WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
        [tenantId, actor.group_id]
      );
      const ownerActorId = (gRes.rows[0] as { owner_actor_id: string } | undefined)?.owner_actor_id;
      if (ownerActorId) {
        const oRes = await client.query(
          `SELECT user_id::text AS user_id FROM actors WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
          [tenantId, ownerActorId]
        );
        if ((oRes.rows[0] as { user_id: string | null } | undefined)?.user_id === userId) {
          return true;
        }
      }
    }

    // 4. Registry-bônus no MESMO client (mesma consulta do actorRegistryService).
    const registry = await actorRegistryService.findByActorId(tenantId, actorId, client);
    if (registry?.entityTable && registry?.entityId) {
      if (await this.checkOwnershipOnClient(tenantId, userId, registry.entityTable, registry.entityId, client)) {
        return true;
      }
    }

    // 5. Delegação FULL no MESMO client — a linha da delegação é a evidência REVOGÁVEL: FOR SHARE
    //    serializa contra o writer de revogação (mesmo predicado ativo/expira do repositório canônico).
    const uaRes = await client.query(
      `SELECT id::text AS id FROM actors
        WHERE tenant_id = $1 AND user_id = $2 AND actor_type = 'user' LIMIT 1`,
      [tenantId, userId]
    );
    const userActorId = (uaRes.rows[0] as { id: string } | undefined)?.id;
    if (userActorId) {
      const dRes = await client.query(
        `SELECT scopes_json FROM actor_delegations
          WHERE tenant_id = $1 AND user_actor_id = $2 AND institutional_actor_id = $3
            AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())
          ORDER BY created_at DESC LIMIT 1 FOR SHARE`,
        [tenantId, userActorId, actorId]
      );
      const scopes = (dRes.rows[0] as { scopes_json: unknown } | undefined)?.scopes_json;
      if (Array.isArray(scopes) && scopes.includes('*')) {
        return true;
      }
    }

    return false;
  }

  /**
   * Variante transacional de checkOwnership (mesmos ramos companies/groups/events do caminho pool),
   * evidência FOR SHARE, erros propagam (usada só pelo ramo registry do caminho transacional).
   */
  private async checkOwnershipOnClient(
    tenantId: string,
    userId: string,
    entityTable: string,
    entityId: string,
    client: TxQueryClient
  ): Promise<boolean> {
    if (entityTable === 'companies') {
      const globalUserId = await resolveGlobalUserId(userId, tenantId, client).catch((e) => {
        if (e instanceof Error && /resolveGlobalUserId/.test(e.message)) return null;
        throw e;
      });
      if (!globalUserId) return false;
      // 🔒 DECISION-0189 (F4): 'is_primary'/'role=admin' MORRERAM como autoridade (§5 — rótulos
      // de UI). Gestão de empresa = EXCLUSIVAMENTE can_manage_company (canManageCompany canônico).
      const { companiesService } = await import('@core/companies/companies.service');
      return companiesService.canManageCompany(tenantId, entityId, globalUserId, client);
    }
    if (entityTable === 'groups') {
      const g = await client.query(
        `SELECT owner_actor_id::text AS owner_actor_id FROM groups WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
        [tenantId, entityId]
      );
      const ownerActorId = (g.rows[0] as { owner_actor_id: string } | undefined)?.owner_actor_id;
      if (!ownerActorId) return false;
      const o = await client.query(
        `SELECT user_id::text AS user_id FROM actors WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
        [tenantId, ownerActorId]
      );
      return (o.rows[0] as { user_id: string | null } | undefined)?.user_id === userId;
    }
    if (entityTable === 'events') {
      const ev = await client.query(
        `SELECT actor_id::text AS actor_id FROM events WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
        [tenantId, entityId]
      );
      const evActorId = (ev.rows[0] as { actor_id: string } | undefined)?.actor_id;
      if (!evActorId) return false;
      const ea = await client.query(
        `SELECT user_id::text AS user_id FROM actors WHERE tenant_id = $1 AND id = $2 FOR SHARE`,
        [tenantId, evActorId]
      );
      return (ea.rows[0] as { user_id: string | null } | undefined)?.user_id === userId;
    }
    return false;
  }

  /** resolveGlobalUserId fail-closed: principal desconhecido/erro → null (deny), nunca propaga. */
  private async safeResolveGlobalUserId(userId: string, tenantId: string): Promise<string | null> {
    try {
      return await resolveGlobalUserId(userId, tenantId);
    } catch {
      return null;
    }
  }

  /** checkOwnership fail-closed: qualquer erro de resolução → false (deny), nunca propaga. */
  private async safeCheckOwnership(
    tenantId: string,
    userId: string,
    entityTable: string,
    entityId: string
  ): Promise<boolean> {
    try {
      return await this.checkOwnership(tenantId, userId, entityTable, entityId);
    } catch {
      return false;
    }
  }

  /**
   * Se o mapa canónico exige capability em `actor_registry`, falha fechada sem linha ou sem flag `true`.
   */
  private denyIfMissingRequiredRegistryCapability(
    permissionKey: PermissionKey,
    registry: ActorRegistryEntry | null
  ): AuthorizationResult | null {
    const requiredCapability = PERMISSION_CAPABILITIES[permissionKey];
    if (requiredCapability === null || requiredCapability === undefined) {
      return null;
    }
    if (!registry || registry.capabilities?.[requiredCapability] !== true) {
      return {
        allowed: false,
        reason: 'Missing required capability',
      };
    }
    return null;
  }

  /**
   * Verifica se user é owner da entidade
   */
  private async checkOwnership(
    tenantId: string,
    userId: string,
    entityTable: string,
    entityId: string
  ): Promise<boolean> {
    // Para companies: verificar se user é owner via company_users ou company_members
    if (entityTable === 'companies') {
      // Resolver global_user_id do userId
      const globalUserId = await resolveGlobalUserId(userId, tenantId);
      if (!globalUserId) {
        return false;
      }

      // 🔒 DECISION-0189 (F4): autoridade de gestão = EXCLUSIVAMENTE can_manage_company
      // (canManageCompany canônico). Os ramos legados 'is_primary=true' e "role='admin'"
      // MORRERAM (§5/§12 — role/is_primary são rótulos de UI, nunca authority).
      const { companiesService } = await import('@core/companies/companies.service');
      if (await companiesService.canManageCompany(tenantId, entityId, globalUserId)) {
        return true;
      }
    }

    // Para groups: verificar owner_actor_id
    if (entityTable === 'groups') {
      const group = await runQueryWithTenant<{ owner_actor_id: string }>(
        tenantId,
        `
          SELECT owner_actor_id
          FROM groups
          WHERE id = $1
          LIMIT 1
        `,
        [entityId]
      );

      if (group) {
        const actorRepository = socialPortsRegistry.getActorRepository();
        const ownerActor = await actorRepository.findById(tenantId, group.owner_actor_id);
        if (ownerActor && ownerActor.user_id === userId) {
          return true;
        }
      }
    }

    // Para events: verificar actor_id do evento
    if (entityTable === 'events') {
      const event = await runQueryWithTenant<{ actor_id: string }>(
        tenantId,
        `
          SELECT actor_id
          FROM events
          WHERE id = $1
          LIMIT 1
        `,
        [entityId]
      );

      if (event) {
        const actorRepository = socialPortsRegistry.getActorRepository();
        const eventActor = await actorRepository.findById(tenantId, event.actor_id);
        if (eventActor && eventActor.user_id === userId) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Busca delegação ativa
   */
  private async findActiveDelegation(
    tenantId: string,
    userId: string,
    actorId: string
  ): Promise<{ scopes: string[] } | null> {
    // Buscar actor do user
    const actorRepository = socialPortsRegistry.getActorRepository();
    const userActor = await actorRepository.findByUserId(tenantId, userId);
    if (!userActor) {
      return null;
    }

    // Buscar delegações ativas
    const delegations = await actorDelegationRepository.findActiveByUserActor(
      tenantId,
      userActor.actor_id
    );

    // Encontrar delegação para o actor específico
    const delegation = delegations.find((d) => d.institutionalActorId === actorId);
    if (!delegation) {
      return null;
    }

    return {
      scopes: delegation.scopes,
    };
  }

  /**
   * Verifica se delegação tem permissão
   */
  private checkDelegationPermission(scopes: string[], permissionKey: PermissionKey): boolean {
    return scopes.includes(permissionKey) || scopes.includes('*');
  }

  /**
   * Verifica se capability permite permissão
   * Usa PERMISSION_CAPABILITIES do mapa canônico
   */
  private checkCapability(capabilities: any, permissionKey: PermissionKey): boolean {
    const requiredCapability = PERMISSION_CAPABILITIES[permissionKey];
    
    // Se não requer capability específica, ownership/delegação é suficiente
    if (requiredCapability === null) {
      return true;
    }
    
    // Verificar se actor tem a capability requerida
    return capabilities?.[requiredCapability] === true;
  }

  /**
   * Calcula shadow authorization e loga divergência (Fase 2B)
   * Execução não-bloqueante, erros nunca propagam
   */
  private async calculateAndLogShadowDivergence(
    tenantId: string,
    userId: string,
    actorId: string,
    permissionKey: PermissionKey,
    scope: string | undefined,
    legacyResult: AuthorizationResult
  ): Promise<void> {
    try {
      const shadowResult = await shadowAuthorizationService.calculateShadowAuthorization(
        tenantId,
        actorId,
        permissionKey,
        scope
      );

      // Se timeout ou erro, não loga divergência
      if (!shadowResult) {
        return;
      }

      const decisionLegacy = legacyResult.allowed;
      const decisionShadow = shadowResult.allowed;

      // Logar APENAS quando há divergência real
      if (decisionLegacy !== decisionShadow) {
        const { resource, action } = this.permissionKeyToResourceAction(permissionKey);
        const reasonCode = decisionShadow
          ? 'SHADOW_ALLOW_LEGACY_DENY'
          : 'SHADOW_DENY_LEGACY_ALLOW';

        const logData: ShadowAuthDivergenceLog = {
          event: 'SHADOW_AUTH_DIVERGENCE',
          tenant_id: tenantId,
          actor_id: actorId,
          user_id: userId,
          permission_key: permissionKey,
          resource,
          action,
          decision_legacy: decisionLegacy,
          decision_shadow: decisionShadow,
          reason_code: reasonCode,
          shadow_reason: shadowResult.reason,
          timestamp: new Date().toISOString(),
        };

        canonicalLogger.shadowAuthDivergence(null, 'Divergência detectada entre shadow e legado', logData);
      }
    } catch (error) {
      // Engolir erro silenciosamente - nunca propagar
      // Shadow não pode afetar produção
    }
  }

  /**
   * Converte PermissionKey para formato resource:action
   * Helper para shadow authorization
   */
  private permissionKeyToResourceAction(permissionKey: PermissionKey): { resource: string; action: string } {
    if (permissionKey.includes(':')) {
      const [resource, action] = permissionKey.split(':');
      return { resource: resource || permissionKey, action: action || 'execute' };
    }
    return { resource: permissionKey, action: 'execute' };
  }
}

export const authorizationService = new AuthorizationService();




