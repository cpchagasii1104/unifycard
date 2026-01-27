// backend/src/contracts/marketplace/CompanyCollaborator.contract.ts
// CONTRATO PÚBLICO CONGELADO - CompanyCollaborator (Colaborador de Empresa)
// ⚠️ READ-ONLY - NÃO QUEBRAR SEM VERSÃO NOVA
// Versão: v1.0
// Data: 2026-01-XX
// Status: CONGELADO

import { ActorRole } from './ActorRole.contract';

/**
 * CompanyCollaborator - Colaborador de Empresa
 * 
 * Representa um ator que tem acesso a uma empresa com permissões específicas.
 * Sistema de convites e aceitação com permissões explícitas.
 * 
 * Contrato público congelado.
 * NÃO alterar campos existentes sem criar nova versão.
 * 
 * Este arquivo contém APENAS tipos/interfaces.
 * NÃO importa serviços, banco de dados ou lógica de negócio.
 */
export interface CompanyCollaborator {
  collaboration_id: string;
  company_id: string;
  actor_id: string; // ID do ator colaborador
  role: ActorRole;
  permissions: string[]; // Permissões explícitas do mapa canônico
  status: 'invited' | 'accepted' | 'revoked' | 'declined';
  invited_by: string; // ID do ator que convidou
  invited_at: string;
  accepted_at?: string;
  revoked_at?: string;
  declined_at?: string;
  revoked_by?: string; // ID do ator que revogou
}





