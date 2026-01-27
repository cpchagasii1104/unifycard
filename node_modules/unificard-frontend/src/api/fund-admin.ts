// src/api/fund-admin.ts
// API client para painel interno de observação do fundo

import { apiFetch } from './client';

export interface RegionFundData {
  regionId: string;
  regionName?: string;
  accountId: string;
  balance: number;
  totalAccumulated: number;
  transactionCount: number;
  growth7Days: number;
  growth30Days: number;
  lastTransactionDate?: string;
}

export interface RegionsResponse {
  regions: RegionFundData[];
}

export async function getRegionsData(): Promise<RegionFundData[]> {
  const response = await apiFetch('/fund/admin/regions');
  const data: RegionsResponse = await response.json();
  return data.regions;
}

export async function exportRegionsData(format: 'csv' | 'json' = 'json'): Promise<Blob> {
  const response = await apiFetch(`/fund/admin/export?format=${format}`);
  return response.blob();
}

