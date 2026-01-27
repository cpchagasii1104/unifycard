// backend/src/modules/bank/financial-authorship.types.ts
// CORE DE PERMISSÕES FINANCEIRAS — FASE 2 (PASSO 2/3)
// Tipos para autoria rastreável e trilha de decisão
// REGRA INQUEBRÁVEL: Autoria é obrigatória em todas as operações financeiras

/**
 * Fonte da autoridade para executar operação financeira
 */
export type FinancialAuthoritySource = 'ownership' | 'delegation' | 'account_acl' | 'system';

/**
 * Snapshot da decisão de permissão no momento da criação
 */
export interface PermissionSnapshot {
  permissionKey: string;
  allowed: boolean;
  reason?: string;
  actorId: string;
  userId: string;
  decidedAt: string; // ISO 8601 timestamp
  [key: string]: any; // Campos adicionais para extensibilidade
}

/**
 * Snapshot da resolução de policy no momento da criação
 */
export interface PolicySnapshot {
  policyKeyResolved?: string | null;
  resolutionPath?: string[]; // Caminho hierárquico de resolução (ex: ['split.service_booking.curitiba', 'split.service_booking'])
  inputsUsed?: Record<string, any>; // Inputs usados na resolução (metadata, context, etc)
  decidedAt: string; // ISO 8601 timestamp
  [key: string]: any; // Campos adicionais para extensibilidade
}

/**
 * Contexto de autoria para operações financeiras
 * 
 * REGRA INQUEBRÁVEL: Toda criação de transação/ledger/split DEVE incluir este contexto.
 * Hard fail no código se não fornecido.
 * 
 * Após Fase 2 / Passo 2:
 * - actingForAccountId: NOT NULL (obrigatório)
 * - authoritySource: NOT NULL (obrigatório)
 * - permissionSnapshot: NOT NULL (obrigatório)
 * - performedByUserId: NULLABLE (NULL apenas quando authoritySource='system')
 */
export interface FinancialAuthorshipContext {
  /**
   * ID do usuário que executou a operação (quem fez)
   * NULL apenas para operações do sistema (authoritySource='system')
   * NOT NULL para authoritySource IN ('ownership', 'delegation', 'account_acl')
   */
  performedByUserId: string | null;

  /**
   * ID do actor em nome do qual a operação foi executada (em nome de quem)
   * Geralmente o mesmo que o dono da conta origem
   * OBRIGATÓRIO
   */
  actingForActorId: string;

  /**
   * ID da conta em nome da qual a operação foi executada
   * OBRIGATÓRIO segundo o Core Canônico (autoria sempre vinculada a uma conta específica).
   * NOT NULL no banco (Fase 2 / Passo 2)
   */
  actingForAccountId: string;

  /**
   * Fonte da autoridade
   * - ownership: dono da conta
   * - delegation: delegação explícita
   * - account_acl: permissão explícita via ACL da conta
   * - system: operação do sistema (jobs, processos internos)
   * NOT NULL no banco (Fase 2 / Passo 2)
   */
  authoritySource: FinancialAuthoritySource;

  /**
   * Snapshot da decisão de permissão
   * Captura o resultado de authorizationService.canActAs() no momento da criação
   * NOT NULL no banco (Fase 2 / Passo 2)
   */
  permissionSnapshot: PermissionSnapshot;

  /**
   * Snapshot da resolução de policy
   * Captura a resolução de split policy no momento da criação
   * Se não houver policy neste fluxo, registrar { policyKeyResolved: null, decidedAt: ... }
   * NULLABLE (opcional)
   */
  policySnapshot?: PolicySnapshot;
}

