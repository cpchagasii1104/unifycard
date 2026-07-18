// backend/src/modules/groups/group-institutional-binding.types.ts
// D9.1 (DECISION-0186/0187) — tipos INTERNOS do vinculo Group interno -> Actor organizacional
// institucional. Casa fisica: group_institutional_bindings (escrita SOMENTE via fn_bind/fn_retire/
// fn_reparent — unificard_app sem DML direto). NAO e membership/relacao/authority/conta/endereco.
// Nenhuma rota HTTP/frontend neste envelope (interno e dormente).

/** Vocabulario FECHADO do lifecycle (DECISION-0187 D6): active -> retired (terminal). */
export type GroupInstitutionalBindingStatus = 'active' | 'retired';

export interface GroupInstitutionalBinding {
  id: string;
  tenantId: string;
  groupId: string;
  institutionActorId: string;
  status: GroupInstitutionalBindingStatus;
  createIdempotencyKey: string;
  createdByActorId: string;
  createdAt: string;
  retireIdempotencyKey: string | null;
  retiredByActorId: string | null;
  retiredAt: string | null;
}

/**
 * Modo estrutural do Group (DECISION-0187 D5) — DERIVADO (read-model), nunca persistido:
 *  - standalone: sem parent ativo e sem filhos ativos;
 *  - root: sem parent ativo e COM filhos ativos (instituicao informal raiz);
 *  - internal: com parent ativo (nao pode ter filhos).
 */
export type GroupInstitutionalMode = 'standalone' | 'root' | 'internal';

/** Read-model interno minimo (somente projecao; zero heranca — DECISION-0187 D9). */
export interface GroupInstitutionalBindingView {
  groupId: string;
  groupActorId: string | null;
  mode: GroupInstitutionalMode;
  activeBinding: GroupInstitutionalBinding | null;
  history: GroupInstitutionalBinding[];
  activeChildrenGroupIds: string[];
}

export interface BindGroupToInstitutionInput {
  tenantId: string;
  /** principal autenticado (req.user.userId) — resolvido server-side, NUNCA do payload */
  actingUserId: string;
  groupId: string;
  institutionActorId: string;
  idempotencyKey: string;
}

export interface RetireGroupInstitutionalBindingInput {
  tenantId: string;
  actingUserId: string;
  bindingId: string;
  idempotencyKey: string;
}

export interface ReparentGroupInstitutionInput {
  tenantId: string;
  actingUserId: string;
  groupId: string;
  newInstitutionActorId: string;
  idempotencyKey: string;
}
