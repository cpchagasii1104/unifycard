// frontend/src/hooks/useAddressResolver.ts
// Hook canônico: Fonte única de verdade (SSOT) para resolução de endereço/CEP
// ÚNICO autorizado a chamar fetchCEP no frontend

import { useState, useRef } from 'react';
import { fetchCEP, type CEPData } from '../utils/cep';

export interface AddressData {
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

export interface UseAddressResolverReturn {
  address: AddressData | null;
  loading: boolean;
  error: string | null;
  setCep: (value: string, origin: 'user' | 'backend') => void;
  resolve: () => Promise<void>;
}

/**
 * Hook canônico para resolução de endereço por CEP
 * 
 * REGRAS INVARIANTES:
 * - Nenhuma busca ocorre se origin !== 'user'
 * - Nenhuma busca ocorre se cep.length !== 8
 * - Nenhuma busca ocorre se loading === true
 * - Nenhuma busca ocorre se cep === lastResolvedCep
 * - resolve() NÃO pode ser chamado automaticamente
 * - resolve() NÃO pode ser chamado em useEffect
 * - Em erro: setar error, NÃO tentar novamente automaticamente
 */
export function useAddressResolver(): UseAddressResolverReturn {
  // Estado público
  const [address, setAddress] = useState<AddressData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Refs internas (invariantes)
  const cepRef = useRef<string>('');
  const originRef = useRef<'user' | 'backend' | null>(null);
  const lastResolvedCepRef = useRef<string>('');
  const isResolvingRef = useRef<boolean>(false);

  /**
   * Define o CEP e sua origem
   * NÃO dispara busca automática
   */
  const setCep = (value: string, origin: 'user' | 'backend') => {
    const cleanCep = value.replace(/\D/g, '');
    cepRef.current = cleanCep;
    originRef.current = origin;
    
    // Limpar erro quando CEP muda
    if (error) {
      setError(null);
    }
  };

  /**
   * Resolve o endereço para o CEP atual
   * Só executa fetchCEP se TODAS as condições forem válidas
   * 
   * REGRAS:
   * - NÃO pode ser chamado automaticamente
   * - NÃO pode ser chamado em useEffect
   * - Requer intenção explícita do usuário
   */
  const resolve = async (): Promise<void> => {
    const cleanCep = cepRef.current;
    const origin = originRef.current;

    // 🔴 INVARIANTE 1: Nenhuma busca se origin !== 'user'
    if (origin !== 'user') {
      console.log('[useAddressResolver] ⏸️ Origem não é "user", não buscando:', {
        cep: cleanCep,
        origin,
      });
      return;
    }

    // 🔴 INVARIANTE 2: Nenhuma busca se cep.length !== 8
    if (cleanCep.length !== 8) {
      console.log('[useAddressResolver] ⏸️ CEP incompleto, não buscando:', {
        cep: cleanCep,
        length: cleanCep.length,
      });
      return;
    }

    // 🔴 INVARIANTE 3: Nenhuma busca se loading === true
    if (loading || isResolvingRef.current) {
      console.log('[useAddressResolver] ⏸️ Busca já em andamento, ignorando');
      return;
    }

    // 🔴 INVARIANTE 4: Nenhuma busca se cep === lastResolvedCep
    if (cleanCep === lastResolvedCepRef.current) {
      console.log('[useAddressResolver] ⏸️ CEP já foi resolvido, não buscando novamente:', {
        cep: cleanCep,
        lastResolved: lastResolvedCepRef.current,
      });
      return;
    }

    // Todas as condições válidas: executar busca
    isResolvingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      console.log('[useAddressResolver] 🔍 Resolvendo CEP:', cleanCep);
      const cepData = await fetchCEP(cleanCep);

      if (cepData && !cepData.erro) {
        // Sucesso: atualizar estado e marcar como resolvido
        const addressData: AddressData = {
          logradouro: cepData.logradouro || '',
          complemento: cepData.complemento || '',
          bairro: cepData.bairro || '',
          localidade: cepData.localidade || '',
          uf: cepData.uf || '',
        };

        setAddress(addressData);
        lastResolvedCepRef.current = cleanCep;
        console.log('[useAddressResolver] ✅ CEP resolvido com sucesso:', addressData);
      } else {
        // CEP não encontrado
        const errorMsg = 'CEP não encontrado. Verifique se o CEP está correto ou preencha os campos manualmente.';
        setError(errorMsg);
        setAddress(null);
        console.warn('[useAddressResolver] ⚠️ CEP não encontrado:', cleanCep);
      }
    } catch (err) {
      // 🔴 INVARIANTE: Em erro, setar error, NÃO tentar novamente automaticamente
      const errorMessage = err instanceof Error 
        ? err.message 
        : 'Erro ao buscar CEP. Tente novamente.';
      
      setError(errorMessage);
      setAddress(null);
      console.error('[useAddressResolver] ❌ Erro ao resolver CEP:', err);
      
      // NÃO alterar origin em caso de erro
      // NÃO tentar novamente automaticamente
    } finally {
      setLoading(false);
      isResolvingRef.current = false;
    }
  };

  return {
    address,
    loading,
    error,
    setCep,
    resolve,
  };
}

