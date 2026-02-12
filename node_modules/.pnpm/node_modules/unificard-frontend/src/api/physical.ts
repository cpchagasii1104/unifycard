// src/api/physical.ts
// API de perfil físico/interesses

import { apiFetch } from './client';

export interface InterestCategory {
  categoryId: string;
  categoryName: string;
  categoryPath: string[];
  level: number;
}

export interface LifestyleInfo {
  drinks: 'never' | 'socially' | 'regularly' | 'prefer_not_to_say' | null;
  smokes: 'never' | 'occasionally' | 'regularly' | 'prefer_not_to_say' | null;
  relationshipStatus: 'single' | 'dating' | 'in_relationship' | 'married' | 'prefer_not_to_say' | null;
  sexualOrientation: 'heterosexual' | 'homosexual' | 'bisexual' | 'pansexual' | 'asexual' | 'prefer_not_to_say' | null;
}

export interface PhysicalProfile {
  globalUserId: string;
  interests: InterestCategory[];
  lifestyle: LifestyleInfo;
  preferences: {
    [categoryId: string]: {
      details?: string[];
      notes?: string;
    };
  };
  metadata: Record<string, any>;
}

export async function getPhysicalProfile(): Promise<PhysicalProfile> {
  const response = await apiFetch('/profile/physical');
  const result = await response.json();
  // Suportar formato antigo e novo
  if (result.ok && result.data) {
    return result.data;
  }
  return result;
}

export async function updatePhysicalProfile(data: {
  interests?: string[];
  lifestyle?: Partial<LifestyleInfo>;
  preferences?: {
    [categoryId: string]: {
      details?: string[];
      notes?: string;
    };
  };
  metadata?: Record<string, any>;
}): Promise<PhysicalProfile> {
  const response = await apiFetch('/profile/physical', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
  return response.json();
}

