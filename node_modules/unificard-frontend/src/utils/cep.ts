// src/utils/cep.ts
// Utilitário para buscar endereço por CEP (via backend)

import { apiFetch } from '../api/client';

export interface CEPData {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

/**
 * Busca endereço por CEP usando o endpoint do backend
 * O backend chama ViaCEP e trata erros/CORS
 * 
 * @param cep CEP no formato 00000000 ou 00000-000
 * @returns Dados do endereço ou null se não encontrado
 */
export async function fetchCEP(cep: string): Promise<CEPData | null> {
  // Remove caracteres não numéricos
  const cleanCEP = cep.replace(/\D/g, '');
  
  console.log('[fetchCEP] Buscando CEP via backend:', cleanCEP);
  
  if (cleanCEP.length !== 8) {
    console.warn('[fetchCEP] CEP inválido, tamanho:', cleanCEP.length);
    return null;
  }

  try {
    // 🔴 CORREÇÃO: Usar endpoint do backend ao invés de ViaCEP direto
    // Isso resolve problemas de CORS, timeout, e permite cache/fallback
    const url = `/api/location/cep/${cleanCEP}`;
    console.log('[fetchCEP] 🔍 Fazendo requisição para backend:', url);
    
    const response = await apiFetch(url, {
      method: 'GET',
    });
    
    console.log('[fetchCEP] ✅ Resposta recebida do backend');
    console.log('[fetchCEP] Status:', response.status);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.warn('[fetchCEP] ❌ CEP não encontrado (404)');
        return null;
      }
      
      if (response.status === 503) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[fetchCEP] ❌ Serviço temporariamente indisponível (503):', errorData);
        throw new Error(errorData.error || 'Serviço de CEP temporariamente indisponível. Tente novamente em alguns instantes.');
      }
      
      const errorData = await response.json().catch(() => ({}));
      console.error('[fetchCEP] ❌ Erro do backend:', response.status, errorData);
      throw new Error(errorData.error || `Erro ao buscar CEP: ${response.status}`);
    }
    
    const cepData: CEPData = await response.json();
    
    console.log('[fetchCEP] 📦 Dados recebidos do backend:', JSON.stringify(cepData, null, 2));
    console.log('[fetchCEP] ✅✅✅ CEP VÁLIDO E PRONTO PARA RETORNAR ✅✅✅');
    
    return cepData;
  } catch (error) {
    console.error('[fetchCEP] ❌ Erro ao buscar CEP:', error);
    if (error instanceof Error) {
      console.error('[fetchCEP] Mensagem de erro:', error.message);
      console.error('[fetchCEP] Stack:', error.stack);
      
      // Re-throw para que o componente possa tratar
      throw error;
    }
    return null;
  }
}

// 🔧 FUNÇÃO DE TESTE: Expor globalmente para testar no console
// Use no console do navegador: window.testCEP('81920410')
if (typeof window !== 'undefined') {
  (window as any).testCEP = async (cep: string) => {
    console.log('🧪 TESTE DIRETO DE CEP:', cep);
    const result = await fetchCEP(cep);
    console.log('🧪 RESULTADO DO TESTE:', result);
    return result;
  };
}
