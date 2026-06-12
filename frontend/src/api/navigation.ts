// src/api/navigation.ts
// DECISION-0117 F — projeção do MENU DE MÓDULOS (registry backend governado).
// O frontend CONSOME a projeção; não inventa módulo, categoria, rota nem
// autoridade. Menu não concede poder — toda ação é revalidada no backend.
import { apiFetchJson } from './client';

export interface NavModuleItem {
  moduleKey: string;
  label: string;
  icon: string;
  route: string;
  exact: boolean;
}

export interface NavModuleGroup {
  title: string;
  items: NavModuleItem[];
}

export interface NavModulesProjection {
  context: 'personal' | 'company';
  companyId?: string;
  kybApproved?: boolean;
  enabledModules?: string[];
  groups: NavModuleGroup[];
}

export async function getNavigationModules(companyId?: string): Promise<NavModulesProjection> {
  const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  const res = await apiFetchJson<{ ok: boolean; data: NavModulesProjection }>(`/navigation/modules${qs}`);
  return res.data;
}
