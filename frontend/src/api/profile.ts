// src/api/profile.ts
// API de perfil de usuário

import { apiFetch } from './client';

export interface Profile {
  profileId: string;
  tenantId: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string;
  metadata?: Record<string, any>;
}

export async function getProfile(): Promise<Profile> {
  const response = await apiFetch('/profile');
  const result = await response.json();
  // Suportar formato antigo e novo
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

export async function updateProfile(input: UpdateProfileInput): Promise<Profile> {
  console.log('[profile.ts] Enviando updateProfile:', input);
  
  const response = await apiFetch('/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    console.error('[profile.ts] Erro na resposta:', {
      status: response.status,
      statusText: response.statusText,
      error: errorData,
    });
    throw new Error(errorData.error || errorData.message || `Erro ${response.status}: ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('[profile.ts] Resposta recebida:', result);
  return result;
}

