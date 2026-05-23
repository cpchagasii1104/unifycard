// src/api/core.ts
// API do CORE - fonte única de identidade e dados

import { apiFetchJson } from './client';

export interface CompleteProfile {
  actor: {
    actor_id: string;
    actor_type: string;
    display_name: string;
    avatar_url: string | null;
    cover_url: string | null;
    bio: string | null;
  } | null;
  personal_profile: {
    fullName: string | null;
    phone: string | null;
    metadata: Record<string, any>;
    referralCode: string | null;
    cpf: string | null;
    /** YYYY-MM-DD — projeção no CORE (global_users / identity) */
    birthdate?: string | null;
    profile_personal_confirmed?: boolean;
    can_edit_personal_data?: boolean;
  } | null;
  identity_status: 'COMPLETE' | 'INCOMPLETE';
  professional_profile: {
    skills: any[];
    education: any[];
    bio: string | null;
    availability: string | null;
  } | null;
  physical_profile: {
    interests: any[];
    lifestyle: {
      drinks: string | null;
      smokes: string | null;
      relationshipStatus: string | null;
      sexualOrientation: string | null;
    };
    preferences: Record<string, any>;
  } | null;
  addresses: Array<{
    address_id: string;
    cep: string | null;
    address: string | null;
    address_number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    is_primary: boolean;
  }>;
  contacts: Array<{
    contact_id: string;
    type: string;
    value: string;
    is_primary: boolean;
  }>;
  interests: Array<{
    interest_id: string;
    name: string;
    category: string | null;
  }>;
  companies: Array<{
    company_id: string;
    company_name: string;
    trade_name: string | null;
    cnpj: string | null;
    is_verified: boolean;
  }>;
}

export interface CoreResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * GET /core/profile
 * Busca perfil completo agregado do CORE
 * @param actorId Opcional: se fornecido, busca profile do actor específico (PF/PJ/Group)
 */
export async function getCoreProfile(actorId?: string): Promise<CompleteProfile> {
  const url = actorId ? `/core/profile?actorId=${encodeURIComponent(actorId)}` : '/core/profile';
  const result = await apiFetchJson<CoreResponse<CompleteProfile>>(url);
  
  if (!result.ok) {
    throw new Error(result.message || result.error || 'Erro ao buscar perfil');
  }
  
  if (!result.data) {
    // Retornar estrutura vazia se não houver dados
    return {
      actor: null,
      personal_profile: null,
      professional_profile: null,
      physical_profile: null,
      addresses: [],
      contacts: [],
      interests: [],
      companies: [],
      identity_status: 'INCOMPLETE',
    };
  }
  
  return result.data;
}










