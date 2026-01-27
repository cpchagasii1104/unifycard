import { useEffect, useRef } from "react";
import { useAddressResolver } from "./useAddressResolver";

export function useProfileCep(
  cep: string,
  setCepTracked: (value: string) => void,
  setCepError: (error: string | null) => void,
  setCepLoading: (loading: boolean) => void,
  setAddressTracked: (value: string) => void,
  setNeighborhoodTracked: (value: string) => void,
  setCityTracked: (value: string) => void,
  setStateTracked: (value: string) => void,
  setComplementTracked: (value: string) => void,
  setAddressError: (error: string | null) => void,
  setNeighborhoodError: (error: string | null) => void,
  setCityError: (error: string | null) => void,
  setStateError: (error: string | null) => void,
  cepLoading: boolean,
  isLoading: boolean,
  isHydrating: React.MutableRefObject<boolean>,
  cepOriginRef: React.MutableRefObject<'backend' | 'user' | null>
) {
  // 🔴 MIGRAÇÃO: Usar hook canônico useAddressResolver (SSOT)
  const { address, loading, error, setCep: setCepResolver, resolve } = useAddressResolver();

  // 🔴 MIGRAÇÃO: Sincronizar loading e error do hook canônico
  useEffect(() => {
    setCepLoading(loading);
  }, [loading, setCepLoading]);

  useEffect(() => {
    setCepError(error);
  }, [error, setCepError]);

  // 🔴 MIGRAÇÃO: Quando CEP vier do backend, atualizar hook canônico
  useEffect(() => {
    // Verificar origem dentro do effect (ref não dispara re-render)
    if (cepOriginRef.current === 'backend') {
      const cleanCep = cep.replace(/\D/g, "");
      setCepResolver(cleanCep, 'backend');
    }
  }, [cep, setCepResolver]);

  // 🔴 MIGRAÇÃO: Preencher campos quando address do hook canônico mudar
  useEffect(() => {
    if (address) {
      setAddressTracked(address.logradouro || "");
      setNeighborhoodTracked(address.bairro || "");
      setCityTracked(address.localidade || "");
      setStateTracked(address.uf || "");
      setComplementTracked(address.complemento || "");

      // Limpar erros dos campos preenchidos
      setAddressError(null);
      setNeighborhoodError(null);
      setCityError(null);
      setStateError(null);
      setCepError(null);
    }
  }, [address, setAddressTracked, setNeighborhoodTracked, setCityTracked, setStateTracked, setComplementTracked, setAddressError, setNeighborhoodError, setCityError, setStateError, setCepError]);

  const handleCepChange = (value: string) => {
    // 🔴 MIGRAÇÃO: Marcar origem como 'user' quando usuário digita
    cepOriginRef.current = 'user';
    
    // 🔴 CRÍTICO: Normalizar CEP ANTES de qualquer coisa
    const numbers = value.replace(/\D/g, "");

    // Aplicar máscara de CEP (00000-000) apenas para exibição
    let masked = numbers;
    if (numbers.length > 5) {
      masked = `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
    }

    console.log("[Profile] handleCepChange:", {
      value,
      numbers,
      masked,
      length: numbers.length,
      cepOrigin: cepOriginRef.current,
    });

    // 🔴 CRÍTICO: Limpar erro ANTES de setar (não bloquear fetch)
    setCepError(null);

    // Limitar a 8 dígitos se exceder
    if (numbers.length > 8) {
      const limited = numbers.slice(0, 8);
      masked = `${limited.slice(0, 5)}-${limited.slice(5, 8)}`;
      setCepTracked(masked);
    } else {
      setCepTracked(masked);
    }

    // 🔴 MIGRAÇÃO: Atualizar hook canônico com origem 'user'
    setCepResolver(numbers, 'user');

    // 🔴 MIGRAÇÃO: Se completar 8 dígitos DURANTE onChange, chamar resolve()
    if (numbers.length === 8) {
      resolve();
    }
  };

  const handleCepBlur = () => {
    // 🔴 MIGRAÇÃO: handleCepBlur NÃO dispara busca automática
    // Busca só ocorre via resolve() chamado explicitamente em handleCepChange
    // quando CEP completa 8 dígitos DURANTE onChange
    console.log("[Profile] handleCepBlur: Nenhuma ação automática");
  };

  return {
    handleCepChange,
    handleCepBlur,
    cepSearchInProgress: { current: loading }, // 🔴 MIGRAÇÃO: Usar loading do hook canônico
  };
}



