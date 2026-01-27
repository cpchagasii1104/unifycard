// frontend/src/api/group-campaigns.ts
// API Client para Group Campaigns
// SPRINT: Groups MVP
// Nota: Como não há endpoint específico, usamos dados do feed e eventos

import { apiFetch } from './client';
import { getFeed, type Post } from './social-2.0';

export type CampaignStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type CampaignType = 'donation' | 'action' | 'fundraising' | 'awareness';

export interface GroupCampaign {
  campaignId: string;
  groupId: string;
  title: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  startsAt: string; // ISO 8601
  endsAt?: string | null; // ISO 8601
  goalValue?: number | null;
  currentValue: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Listar campanhas do grupo
 * Nota: Como não há endpoint específico, retornamos array vazio por enquanto
 * A implementação real dependeria de um endpoint backend ou consolidação de dados
 */
export async function listGroupCampaigns(groupId: string): Promise<GroupCampaign[]> {
  // Por enquanto, retornamos array vazio
  // Quando o backend implementar endpoint, usar:
  // const response = await apiFetch(`/api/groups/${groupId}/campaigns`);
  // return response.json().campaigns || [];
  return [];
}

/**
 * Buscar detalhes de uma campanha
 */
export async function getGroupCampaign(groupId: string, campaignId: string): Promise<GroupCampaign | null> {
  // Por enquanto, retorna null
  // Quando o backend implementar endpoint, usar:
  // const response = await apiFetch(`/api/groups/${groupId}/campaigns/${campaignId}`);
  // return response.json().campaign;
  return null;
}




