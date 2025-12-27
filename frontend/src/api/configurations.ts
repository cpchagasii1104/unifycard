// src/api/configurations.ts
// API para configurações do usuário (PF/PJ, etc.)

import { apiFetch } from './client';

export type UserType = 'physical' | 'legal' | 'both';

export interface UserConfigurations {
  userType: UserType;
}

export async function getUserConfigurations(): Promise<UserConfigurations> {
  const response = await apiFetch('/identity/configurations');
  return response.json();
}

export async function updateUserConfigurations(
  configurations: UserConfigurations
): Promise<UserConfigurations> {
  const response = await apiFetch('/identity/configurations', {
    method: 'PUT',
    body: JSON.stringify(configurations),
  });
  return response.json();
}


