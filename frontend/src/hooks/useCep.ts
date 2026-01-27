// src/hooks/useCep.ts
// Hook reutilizável para autocomplete de CEP
// 🔴 MIGRAÇÃO: Delega resolução de CEP ao hook canônico useAddressResolver (SSOT)

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAddressResolver } from './useAddressResolver';
import type { CEPData } from '../utils/cep';

export interface UseCepOptions {
  /**
   * @deprecated Auto-search foi removido. Use resolveCep() explicitamente.
   * Esta opção não tem mais efeito.
   */
  autoSearch?: boolean;
  /**
   * @deprecated Hidratação não é mais relevante. Use resolveCep() explicitamente.
   * Esta opção não tem mais efeito.
   */
  skipDuringHydration?: boolean;
}

export interface UseCepReturn {
  /** CEP atual (com ou sem máscara) */
  cep: string;
  /** Setter para CEP (NÃO dispara busca automática) */
  setCep: (value: string) => void;
  /** Se está buscando CEP */
  loading: boolean;
  /** Erro na busca de CEP */
  error: string | null;
  /** Dados do CEP encontrado */
  cepData: CEPData | null;
  /** Buscar CEP manualmente (chama resolve() do hook canônico) */
  searchCep: (cepValue?: string) => Promise<void>;
  /** Resolver CEP explicitamente (delega ao hook canônico) */
  resolveCep: () => Promise<void>;
  /** Limpar dados do CEP */
  clearCep: () => void;
}

/**
 * Hook reutilizável para autocomplete de CEP
 * 🔴 MIGRAÇÃO: Delega resolução de CEP ao hook canônico useAddressResolver (SSOT)
 * 
 * @example
 * ```tsx
 * const { cep, setCep, loading, error, cepData, resolveCep } = useCep();
 * 
 * // CEP NÃO é buscado automaticamente - chamar resolveCep() explicitamente
 * <input 
 *   value={cep} 
 *   onChange={(e) => {
 *     setCep(e.target.value);
 *     if (e.target.value.replace(/\D/g, '').length === 8) {
 *       resolveCep();
 *     }
 *   }} 
 * />
 * ```
 */
export function useCep(options: UseCepOptions = {}): UseCepReturn {
  // 🔴 MIGRAÇÃO: Usar hook canônico useAddressResolver (SSOT)
  const { address, loading, error, setCep: setCepResolver, resolve } = useAddressResolver();

  // Estado local para compatibilidade com API pública
  const [cep, setCepLocal] = useState('');
  const [cepData, setCepData] = useState<CEPData | null>(null);

  // 🔴 MIGRAÇÃO: Sincronizar cepData quando address do hook canônico mudar
  useEffect(() => {
    if (address) {
      const data: CEPData = {
        cep: cep.replace(/\D/g, ''),
        logradouro: address.logradouro,
        complemento: address.complemento,
        bairro: address.bairro,
        localidade: address.localidade,
        uf: address.uf,
      };
      setCepData(data);
    } else {
      setCepData(null);
    }
  }, [address, cep]);

  /**
   * Setter para CEP (NÃO dispara busca automática)
   */
  const setCep = useCallback((value: string) => {
    const cleanCep = value.replace(/\D/g, '');
    setCepLocal(value);
    // 🔴 MIGRAÇÃO: Atualizar hook canônico com origem 'user' (não dispara busca)
    setCepResolver(cleanCep, 'user');
  }, [setCepResolver]);

  /**
   * Buscar CEP manualmente (compatibilidade com API antiga)
   * Delega ao hook canônico
   */
  const searchCep = useCallback(async (cepValue?: string) => {
    if (cepValue) {
      const cleanCep = cepValue.replace(/\D/g, '');
      setCepLocal(cleanCep);
      setCepResolver(cleanCep, 'user');
    }
    // 🔴 MIGRAÇÃO: Chamar resolve() do hook canônico
    await resolve();
  }, [setCepResolver, resolve]);

  /**
   * Resolver CEP explicitamente (delega ao hook canônico)
   */
  const resolveCep = useCallback(async () => {
    // 🔴 MIGRAÇÃO: Chamar resolve() do hook canônico
    await resolve();
  }, [resolve]);

  /**
   * Limpar dados do CEP
   */
  const clearCep = useCallback(() => {
    setCepLocal('');
    setCepData(null);
    setCepResolver('', 'user');
  }, [setCepResolver]);

  return {
    cep,
    setCep,
    loading,
    error,
    cepData,
    searchCep,
    resolveCep,
    clearCep,
  };
}






