// src/config/features.ts
// Feature flags para recursos premium/IA

export type UserPlan = 'free' | 'pro' | 'enterprise';

export interface UserFeatures {
  aiAssistEnabled: boolean; // Microfone, IA para descrições, etc
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  customBranding: boolean;
}

/**
 * Obtém o plano do usuário atual
 * TODO: Implementar busca real do plano/subscription quando sistema de pagamento estiver ativo
 * Por enquanto, retorna 'free' por padrão
 */
export async function getUserPlan(): Promise<UserPlan> {
  // FASE 3.6: Buscar plano real do backend
  try {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!apiBaseUrl) {
      return 'free';
    }
    
    const token = localStorage.getItem('unificard_access_token');
    const tenantId = localStorage.getItem('unificard_tenant_id');
    
    if (!token || !tenantId) {
      return 'free';
    }
    
    const response = await fetch(`${apiBaseUrl}/plan`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.data?.plan) {
        return data.data.plan as UserPlan;
      }
    }
  } catch (error) {
    console.error('Erro ao buscar plano:', error);
  }
  
  // Fallback: retornar 'free' como padrão
  return 'free';
}

/**
 * Obtém features disponíveis para o usuário baseado no plano
 */
export async function getUserFeatures(): Promise<UserFeatures> {
  const plan = await getUserPlan();
  
  return {
    aiAssistEnabled: plan !== 'free', // Apenas PRO/Enterprise têm IA assistente
    advancedAnalytics: plan === 'enterprise',
    prioritySupport: plan !== 'free',
    customBranding: plan === 'enterprise',
  };
}

/**
 * Hook/helper para verificar se feature está disponível
 * Usar em componentes que precisam mostrar/ocultar funcionalidades premium
 */
export async function hasFeature(feature: keyof UserFeatures): Promise<boolean> {
  const features = await getUserFeatures();
  return features[feature];
}

/**
 * Versão síncrona (retorna false se não conseguir verificar)
 * Útil para renderização inicial
 */
export function hasFeatureSync(feature: keyof UserFeatures, plan?: UserPlan): boolean {
  // Se plano fornecido, usar; caso contrário, assumir free (mais restritivo)
  const userPlan = plan || 'free';
  
  switch (feature) {
    case 'aiAssistEnabled':
      return userPlan !== 'free';
    case 'advancedAnalytics':
      return userPlan === 'enterprise';
    case 'prioritySupport':
      return userPlan !== 'free';
    case 'customBranding':
      return userPlan === 'enterprise';
    default:
      return false;
  }
}















