// src/types/identity.ts
// Tipos para dados de identidade civil imutáveis

import type { Gender } from '@unificard/contracts';

/**
 * Dados civis imutáveis após cadastro inicial
 * Padrão: bancos, fintechs, sistemas governamentais
 */
export interface ImmutableCivilData {
  /** Nome completo - imutável após cadastro */
  fullName: string;
  
  /** CPF - imutável após cadastro */
  cpf: string;
  
  /** Data de nascimento (YYYY-MM-DD) - imutável após cadastro */
  birthdate: string;
  
  /** Gênero (vocabulário canónico) — imutável após cadastro */
  gender: Gender;
}

/**
 * Estado de imutabilidade dos dados civis
 */
export interface CivilDataImmutabilityStatus {
  hasFullName: boolean;
  hasCpf: boolean;
  hasBirthdate: boolean;
  hasGender: boolean;
}

/**
 * Payload para cadastro inicial (coleta todos os dados imutáveis)
 */
export interface RegisterPayload {
  email: string;
  password: string;
  cpf: string;
  fullName: string;
  birthdate: string;
  gender: Gender;
  referralCode?: string;
}

/**
 * Payload para atualização de perfil (NUNCA inclui dados imutáveis)
 */
export interface ProfileUpdatePayload {
  phone?: string;
  metadata?: Record<string, any>;
  // NUNCA incluir: fullName, cpf, birthdate, gender
}







