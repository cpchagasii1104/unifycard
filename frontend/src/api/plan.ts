// src/api/plan.ts
// API para gerenciar plano do usuário
// FASE 3.6: Toggle FREE/PRO para usuário teste

import { apiFetch } from './client';

export type UserPlan = 'free' | 'pro' | 'enterprise';

export interface PlanInfo {
  plan: UserPlan;
  canToggle: boolean;
}

export async function getPlan(): Promise<PlanInfo> {
  const response = await apiFetch('/plan');
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.message || 'Erro ao buscar plano');
  }
  
  return data.data;
}

export async function updatePlan(plan: UserPlan): Promise<PlanInfo> {
  const response = await apiFetch('/plan', {
    method: 'PUT',
    body: JSON.stringify({ plan }),
  });
  
  const data = await response.json();
  
  if (!data.ok) {
    throw new Error(data.message || 'Erro ao atualizar plano');
  }
  
  return data.data;
}
