// src/core/profile/profile.types.ts

export interface Profile {
  profileId: string;
  tenantId: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  /**
   * 🔴 FONTE ÚNICA DE VERDADE: Flag explícita que indica se o primeiro acesso foi confirmado
   * false → modal de primeiro acesso aparece, campos editáveis
   * true → modal não aparece, campos bloqueados permanentemente
   * NUNCA inferir pela existência de dados (birthdate, gender, etc)
   */
  profilePersonalConfirmed: boolean;
  /**
   * Flag explícita que indica se o usuário pode editar dados pessoais (nome, data nascimento, sexo)
   * true → pode editar
   * false → não pode editar (cadeado ativo)
   * Deve estar sincronizado com profilePersonalConfirmed
   */
  canEditPersonalData: boolean;
}

export interface ProfileRow {
  profile_id: string;
  tenant_id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  metadata: any; // JSONB
  profile_personal_confirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  metadata?: Record<string, any>;
}










