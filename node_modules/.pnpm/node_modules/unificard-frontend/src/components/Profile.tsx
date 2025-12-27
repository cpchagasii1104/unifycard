// src/components/Profile.tsx
// Página de perfil com abas: Pessoal, Profissional, Físico, Pessoa Jurídica

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getIdentityProfile,
  updateIdentity,
  type IdentityProfile,
} from "../api/identity";
import { updateProfile, type Profile } from "../api/profile";
import { getCoreProfile } from "../api/core";
import { getPlan, updatePlan, type UserPlan } from "../api/plan";
import { fetchCEP } from "../utils/cep";
import { maskCPF, validateCPF, verifyCPFExists } from "../utils/cpf";
import {
  COUNTRY_CODES,
  BRAZIL_AREA_CODES,
  formatBrazilianPhone,
  isCellPhone,
} from "../utils/phone";
import {
  sanitizeString,
  validateFullName,
  validateBirthdate,
  validateBrazilianPhone,
  validateAddress,
  sanitizeObject,
} from "../utils/validation";
import ProfileProfessional from "./ProfileProfessional";
import ProfilePhysical from "./ProfilePhysical";
import ProfileLearning from "./ProfileLearning";
import ContextualSuggestion from "./ContextualSuggestion";
import CompaniesManager from "./CompaniesManager";
import "./Profile.css";

type Tab = "personal" | "professional" | "physical" | "learning" | "legal";

export default function Profile() {
  const [activeTab, setActiveTab] = useState<Tab>("personal");
  const [_identity, setIdentity] = useState<IdentityProfile | null>(null);
  const [_profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulário Pessoal
  const [fullName, setFullName] = useState("");
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [cpf, setCpf] = useState("");
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfValidating, setCpfValidating] = useState(false);
  const [birthdate, setBirthdate] = useState("");
  const [birthdateError, setBirthdateError] = useState<string | null>(null);
  const [userAge, setUserAge] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState<"male" | "female" | "">("");
  const [genderError, setGenderError] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("55");
  const [areaCode, setAreaCode] = useState("41");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [cep, _setCep] = useState("");
  const [cepError, setCepError] = useState<string | null>(null);
  const [address, _setAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);
  const [addressNumber, _setAddressNumber] = useState("");
  const [addressNumberError, setAddressNumberError] = useState<string | null>(
    null,
  );
  const [complement, _setComplement] = useState("");
  const [neighborhood, _setNeighborhood] = useState("");
  const [neighborhoodError, setNeighborhoodError] = useState<string | null>(
    null,
  );
  const [city, _setCity] = useState("");
  const [cityError, setCityError] = useState<string | null>(null);
  const [state, _setState] = useState("");
  const [stateError, setStateError] = useState<string | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const cepSearchInProgress = useRef(false); // Ref para controlar busca em andamento
  const isHydrating = useRef(false); // 🔴 CRÍTICO: Flag para prevenir efeitos durante carregamento

  // 🔴 INSTRUMENTAÇÃO: Wrappers para setters de endereço com trace
  // Objetivo: identificar exatamente quem está sobrescrevendo os campos após loadData()
  const setCepTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "cep", value, {
        previous: cep,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] cep");
    }
    _setCep(value);
  };

  const setAddressTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "address", value, {
        previous: address,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] address");
    }
    _setAddress(value);
  };

  const setAddressNumberTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "addressNumber", value, {
        previous: addressNumber,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] addressNumber");
    }
    _setAddressNumber(value);
  };

  const setComplementTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "complement", value, {
        previous: complement,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] complement");
    }
    _setComplement(value);
  };

  const setNeighborhoodTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "neighborhood", value, {
        previous: neighborhood,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] neighborhood");
    }
    _setNeighborhood(value);
  };

  const setCityTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "city", value, {
        previous: city,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] city");
    }
    _setCity(value);
  };

  const setStateTracked = (value: string) => {
    if (import.meta.env.DEV) {
      console.log("[ADDR WRITE]", "state", value, {
        previous: state,
        isHydrating: isHydrating.current,
      });
      console.trace("[ADDR TRACE] state");
    }
    _setState(value);
  };

  // FASE 3.6: Estado para gerenciamento de plano
  const [userPlan, setUserPlan] = useState<UserPlan>("free");
  const [canTogglePlan, setCanTogglePlan] = useState(false);
  const [isUpdatingPlan, setIsUpdatingPlan] = useState(false);

  useEffect(() => {
    loadData();
    loadPlan();
  }, []); // 🔴 CRÍTICO: Executar apenas uma vez no mount - não resetar campos de endereço

  // 🔴 CRÍTICO: handleCepSearch envolvido com useCallback para evitar recriações desnecessárias
  // e permitir uso seguro no useEffect
  const handleCepSearch = useCallback(async (cepValue?: string) => {
    // Se recebeu um valor, usar ele (string limpa ou com máscara)
    // Se não, usar o estado atual do CEP
    let cepToSearch: string;
    if (cepValue) {
      // Sempre normalizar (remover máscara)
      cepToSearch = cepValue.replace(/\D/g, "");
    } else {
      // Se não recebeu valor, pegar do estado e normalizar
      cepToSearch = cep.replace(/\D/g, "");
    }

    const cleanCep = cepToSearch;
    if (import.meta.env.DEV) {
      console.log("[Profile] ========== handleCepSearch INICIADO ==========");
      console.log("[Profile] Parâmetros:", {
        cepValue,
        cepToSearch,
        cleanCep,
        length: cleanCep.length,
        cepState: cep,
      });
    }

    // 🔴 CRÍTICO: Validação MÍNIMA - só verificar se tem 8 dígitos
    // NÃO validar formato, NÃO validar se existe, NÃO bloquear fetch
    if (!cleanCep || cleanCep.length !== 8) {
      if (import.meta.env.DEV) {
        console.warn("[Profile] ⚠️ CEP incompleto, não buscando:", {
          cleanCep,
          length: cleanCep.length,
        });
      }
      // NÃO setar erro aqui - erro só vem DEPOIS do fetch falhar
      return;
    }

    // Evitar múltiplas buscas simultâneas (usar ref para evitar stale closure)
    if (cepSearchInProgress.current) {
      console.log("[Profile] ⚠️ Busca já em andamento, ignorando...");
      return;
    }
    cepSearchInProgress.current = true;

    setCepLoading(true);
    setCepError(null);
    if (import.meta.env.DEV) {
      console.log("[Profile] 🔍 Iniciando busca do CEP:", cleanCep);
    }

    try {
      // Usar o CEP limpo (apenas números) para a busca
      const cepData = await fetchCEP(cleanCep);
      console.log(
        "[Profile] 📦 Resposta completa do CEP:",
        JSON.stringify(cepData, null, 2),
      );

      if (cepData) {
        // Extrair dados garantindo que strings vazias sejam tratadas corretamente
        const addressData = {
          logradouro: String(cepData.logradouro || "").trim(),
          bairro: String(cepData.bairro || "").trim(),
          localidade: String(cepData.localidade || "").trim(),
          uf: String(cepData.uf || "")
            .trim()
            .toUpperCase(),
          complemento: String(cepData.complemento || "").trim(),
        };

        if (import.meta.env.DEV) {
          console.log(
            "[Profile] 📝 Dados extraídos para preencher:",
            addressData,
          );
          console.log("[Profile] Verificando se há dados válidos:", {
            temLogradouro: !!addressData.logradouro,
            temBairro: !!addressData.bairro,
            temLocalidade: !!addressData.localidade,
            temUF: !!addressData.uf,
          });
        }

        // Preencher campos diretamente (sem callbacks que podem causar problemas)
        if (import.meta.env.DEV) {
          console.log(
            "[Profile] 🎯 Preenchendo campos com dados:",
            addressData,
          );
          console.log("[Profile] Valores que serão setados:", {
            logradouro: `"${addressData.logradouro}" (${addressData.logradouro.length} chars)`,
            bairro: `"${addressData.bairro}" (${addressData.bairro.length} chars)`,
            localidade: `"${addressData.localidade}" (${addressData.localidade.length} chars)`,
            uf: `"${addressData.uf}" (${addressData.uf.length} chars)`,
          });
        }

        // Setar todos os campos de uma vez, garantindo que não sejam undefined
        const logradouroValue = addressData.logradouro || "";
        const bairroValue = addressData.bairro || "";
        const localidadeValue = addressData.localidade || "";
        const ufValue = addressData.uf || "";
        const complementoValue = addressData.complemento || "";

        // 🔴 CRÍTICO: Setar campos diretamente (React detecta mudança automaticamente)
        console.log("[Profile] 🎯 Setando campos com valores:", {
          logradouro: logradouroValue,
          bairro: bairroValue,
          cidade: localidadeValue,
          estado: ufValue,
          complemento: complementoValue,
        });

        // 🔴 CRÍTICO: Setar campos diretamente (React batch updates automaticamente)
        if (import.meta.env.DEV) {
          console.log("[Profile] 🎯 Setando campos um por um...");
          console.log("[Profile] Valores a serem setados:", {
            logradouro: logradouroValue,
            bairro: bairroValue,
            cidade: localidadeValue,
            estado: ufValue,
            complemento: complementoValue,
          });
        }

        // Setar todos os campos sequencialmente (React faz batch automaticamente)
        // 🔴 CRÍTICO: Usar valores diretos, não funções, para garantir que sejam setados
        setAddressTracked(logradouroValue);
        setNeighborhoodTracked(bairroValue);
        setCityTracked(localidadeValue);
        setStateTracked(ufValue);
        setComplementTracked(complementoValue);

        // Limpar erros dos campos preenchidos
        setAddressError(null);
        setNeighborhoodError(null);
        setCityError(null);
        setStateError(null);
        setCepError(null);

        console.log(
          "[Profile] ✅ setAddress chamado com:",
          logradouroValue,
          "(tipo:",
          typeof logradouroValue,
          ", length:",
          logradouroValue.length,
          ")",
        );
        console.log(
          "[Profile] ✅ setNeighborhood chamado com:",
          bairroValue,
          "(tipo:",
          typeof bairroValue,
          ", length:",
          bairroValue.length,
          ")",
        );
        console.log(
          "[Profile] ✅ setCity chamado com:",
          localidadeValue,
          "(tipo:",
          typeof localidadeValue,
          ", length:",
          localidadeValue.length,
          ")",
        );
        console.log(
          "[Profile] ✅ setState chamado com:",
          ufValue,
          "(tipo:",
          typeof ufValue,
          ", length:",
          ufValue.length,
          ")",
        );
        console.log(
          "[Profile] ✅ setComplement chamado com:",
          complementoValue,
          "(tipo:",
          typeof complementoValue,
          ", length:",
          complementoValue.length,
          ")",
        );
        console.log("[Profile] ✅✅✅ TODOS OS CAMPOS FORAM SETADOS ✅✅✅");

        // Aguardar um tick para garantir que o React processou as mudanças
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("[Profile] ✅✅✅ CAMPOS PREENCHIDOS COM SUCESSO! ✅✅✅");
        console.log("[Profile] Dados finais que foram setados:", {
          logradouro: logradouroValue,
          bairro: bairroValue,
          cidade: localidadeValue,
          estado: ufValue,
          complemento: complementoValue,
        });
      } else {
        // 🔴 CRÍTICO: Validação acontece AQUI, DEPOIS do fetch
        // Só setar erro se a API realmente retornou erro
        console.warn("[Profile] ⚠️ CEP não encontrado ou dados inválidos");
        console.warn("[Profile] Resposta foi null ou undefined");
        const errorMsg =
          "CEP não encontrado. Verifique se o CEP está correto ou preencha os campos manualmente.";
        setCepError(errorMsg);
        // NÃO setar error global aqui - isso pode bloquear outros campos
        // 🔴 IMPORTANTE: Não bloquear o formulário - permitir preenchimento manual
      }
    } catch (err) {
      console.error("[Profile] ❌ ERRO ao buscar CEP:", err);
      if (err instanceof Error) {
        console.error("[Profile] Mensagem de erro:", err.message);
        console.error("[Profile] Stack:", err.stack);

        // Mensagens de erro mais específicas
        let errorMessage =
          "Erro ao buscar CEP. Você pode preencher os campos manualmente.";
        if (
          err.message.includes("Timeout") ||
          err.message.includes("timeout")
        ) {
          errorMessage =
            "O serviço de CEP está demorando para responder. Você pode preencher os campos manualmente.";
        } else if (
          err.message.includes("conexão") ||
          err.message.includes("conexão") ||
          err.message.includes("acessível")
        ) {
          errorMessage =
            "Serviço de CEP temporariamente indisponível. Por favor, preencha os campos de endereço manualmente.";
        } else if (
          err.message.includes("indisponível") ||
          err.message.includes("503")
        ) {
          errorMessage =
            "Serviço de CEP temporariamente indisponível. Você pode preencher os campos manualmente.";
        } else if (
          err.message.includes("não encontrado") ||
          err.message.includes("404")
        ) {
          errorMessage =
            "CEP não encontrado. Verifique se o CEP está correto ou preencha manualmente.";
        }

        setCepError(errorMessage);
        // 🔴 CRÍTICO: NÃO setar error global - permite que o usuário continue preenchendo manualmente
        // O formulário não deve ser bloqueado por falha na API de CEP
      } else {
        setCepError("Erro ao buscar CEP. Tente novamente.");
      }
    } finally {
      setCepLoading(false);
      cepSearchInProgress.current = false; // Reset do ref
      console.log("[Profile] ========== handleCepSearch FINALIZADO ==========");
    }
  }, []); // Remover dependências - usar refs para estado mutável

  // 🔴 CRÍTICO: useEffect desacoplado para buscar CEP automaticamente
  // Fetch NÃO depende de validação, NÃO depende de formState, NÃO depende de outros campos
  // Apenas detecta quando CEP tem 8 dígitos e busca automaticamente
  // 🔴 REGRA: NÃO buscar durante hidratação (loadData) - só quando usuário editar manualmente
  useEffect(() => {
    // 🔴 CRÍTICO: Se está hidratando (carregando dados do backend), NÃO buscar CEP
    // Isso previne que o endereço carregado do backend seja sobrescrito
    if (isHydrating.current) {
      console.log("[Profile] ⏸️ useEffect CEP: Ignorando durante hidratação", {
        cep,
        isHydrating: isHydrating.current,
        isLoading,
      });
      return;
    }

    // 🔴 PROTEÇÃO ADICIONAL: Se ainda está carregando, não buscar
    // Isso previne race conditions onde o useEffect roda antes do finally
    if (isLoading) {
      console.log("[Profile] ⏸️ useEffect CEP: Ignorando durante loading", {
        cep,
        isLoading,
      });
      return;
    }

    const cleanCep = cep.replace(/\D/g, "");

    // Só buscar se tiver exatamente 8 dígitos
    if (cleanCep.length === 8) {
      console.log(
        "[Profile] ✅ useEffect detectou CEP completo (8 dígitos):",
        cleanCep,
        {
          isHydrating: isHydrating.current,
          isLoading,
          willCallHandleCepSearch: true,
        },
      );
      handleCepSearch(cleanCep);
    } else {
      console.log("[Profile] ⏸️ useEffect CEP: CEP incompleto, não buscando", {
        cleanCep,
        length: cleanCep.length,
        isHydrating: isHydrating.current,
        isLoading,
      });
    }
  }, [cep, handleCepSearch, isLoading]); // Adicionar isLoading como dependência para proteção extra

  const loadPlan = async () => {
    try {
      const planInfo = await getPlan();
      setUserPlan(planInfo.plan);
      setCanTogglePlan(planInfo.canToggle);
    } catch (err) {
      console.error("Erro ao carregar plano:", err);
    }
  };

  const handleTogglePlan = async () => {
    if (!canTogglePlan || isUpdatingPlan) return;

    const newPlan: UserPlan = userPlan === "free" ? "pro" : "free";
    setIsUpdatingPlan(true);

    try {
      const updated = await updatePlan(newPlan);
      setUserPlan(updated.plan);
      setCanTogglePlan(updated.canToggle);

      // FASE 3.6: Forçar atualização do plano no localStorage/config para que VoiceButton atualize
      // Limpar cache do plano para forçar nova busca
      if (window.location.reload) {
        // Recarregar página para atualizar todos os componentes que dependem do plano
        alert(
          `Plano alterado para ${newPlan.toUpperCase()}. A página será recarregada.`,
        );
        window.location.reload();
      } else {
        alert(`Plano alterado para ${newPlan.toUpperCase()}`);
      }
    } catch (err) {
      alert(
        `Erro ao alterar plano: ${err instanceof Error ? err.message : "Erro desconhecido"}`,
      );
    } finally {
      setIsUpdatingPlan(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);

    // 🔴 CRÍTICO: Ativar flag de hidratação para prevenir efeitos automáticos de CEP
    // Isso garante que endereço carregado do backend não seja sobrescrito
    isHydrating.current = true;
    console.log(
      "[Profile] 🔄 Iniciando hidratação - efeitos de CEP desabilitados",
    );

    try {
      // Usar CORE como fonte única
      const coreProfile = await getCoreProfile();

      // 🔴 INSTRUMENTAÇÃO: Log detalhado do que foi recebido
      console.log("[Profile] 🔍 loadData - Dados recebidos do backend:", {
        hasPersonalProfile: !!coreProfile.personal_profile,
        personalProfileFullName: coreProfile.personal_profile?.fullName,
        personalProfilePhone: coreProfile.personal_profile?.phone,
        personalProfileMetadataKeys: coreProfile.personal_profile
          ? Object.keys(coreProfile.personal_profile.metadata || {})
          : [],
        addressesCount: coreProfile.addresses?.length || 0,
      });

      // 🔴 CORREÇÃO CRÍTICA: profiles é SEMPRE a fonte de verdade
      // NUNCA sobrescrever valores de profiles com dados de identity
      // 🔴 REGRA DE OURO: Estado SEMPRE deve ser definido explicitamente, mesmo com null
      // NÃO usar "if (personal_profile)" - sempre setar, mesmo que seja string vazia
      const personalProfile = coreProfile.personal_profile;

      // 🔴 CORREÇÃO DEFINITIVA: Sempre setar estados, mesmo se personalProfile for null
      // Isso garante que o estado seja atualizado mesmo em respostas intermediárias
      // REGRA DE OURO: Estado SEMPRE definido explicitamente, nunca condicional
      setFullName(personalProfile?.fullName ?? "");

      // Extrair phone para areaCode e phoneNumber (sempre setar, mesmo se vazio)
      if (personalProfile?.phone) {
        const phoneMatch = personalProfile.phone.match(
          /\((\d{2})\)\s*(\d{4,5}-\d{4})/,
        );
        if (phoneMatch) {
          setAreaCode(phoneMatch[1]);
          setPhoneNumber(phoneMatch[2]);
        } else {
          // Se não conseguir extrair, limpar campos
          setAreaCode("41");
          setPhoneNumber("");
        }
      } else {
        // Se não tem phone, limpar campos
        setAreaCode("41");
        setPhoneNumber("");
      }

      // Setar profile data (mesmo se null)
      const profileData: Profile = {
        profileId: "",
        tenantId: "",
        userId: "",
        fullName: personalProfile?.fullName ?? null,
        phone: personalProfile?.phone ?? null,
        metadata: personalProfile?.metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProfile(profileData);

      // Extrair dados do metadata (sempre setar, mesmo se vazio)
      // 🔴 REGRA: Estado sempre definido explicitamente
      const metadata = personalProfile?.metadata || {};

      // CPF (sempre setar, mesmo se vazio)
      setCpf(metadata.cpf ? maskCPF(metadata.cpf) : "");

      // Gender (sempre setar, mesmo se vazio)
      setGender((metadata.gender as "male" | "female" | "") || "");

      // Address será tratado abaixo no bloco de addresses

      console.log(
        "[Profile] ✅ Estados setados de profiles (sempre, mesmo se null):",
        {
          fullName: personalProfile?.fullName ?? "(vazio)",
          phone: personalProfile?.phone ?? "(vazio)",
          hasMetadata: !!personalProfile?.metadata,
          metadataKeys: personalProfile?.metadata
            ? Object.keys(personalProfile.metadata)
            : [],
        },
      );

      // 🔴 CORREÇÃO CRÍTICA: Endereço deve ser SEMPRE setado explicitamente
      // REGRA: Estado sempre definido, mesmo se vazio (igual aos outros campos)
      // NÃO usar condicionais que pulam o setState
      const addresses = coreProfile.addresses || [];

      console.log("[Profile] 🔍 loadData - Endereços recebidos do backend:", {
        addressesCount: addresses.length,
        addresses: addresses.map((addr) => ({
          cep: addr.cep,
          address: addr.address,
          address_number: addr.address_number,
          city: addr.city,
          state: addr.state,
          is_primary: addr.is_primary,
        })),
      });

      if (addresses.length > 0) {
        // Se existe endereço, usar o primário ou o primeiro
        const primaryAddress =
          addresses.find((addr) => addr.is_primary) || addresses[0];
        console.log("[Profile] 📍 Usando endereço do backend:", primaryAddress);

        // 🔴 CRÍTICO: SEMPRE setar TODOS os campos, mesmo se alguns forem null/vazios
        // Isso garante que o estado reflita exatamente o que veio do backend
        setCepTracked(primaryAddress.cep ?? "");
        setAddressTracked(primaryAddress.address ?? "");
        setAddressNumberTracked(primaryAddress.address_number ?? "");
        setComplementTracked(primaryAddress.complement ?? "");
        setNeighborhoodTracked(primaryAddress.neighborhood ?? "");
        setCityTracked(primaryAddress.city ?? "");
        setStateTracked(primaryAddress.state ?? "");

        console.log(
          "[Profile] ✅ Todos os campos de endereço setados do backend:",
          {
            cep: primaryAddress.cep ?? "(vazio)",
            address: primaryAddress.address ?? "(vazio)",
            address_number: primaryAddress.address_number ?? "(vazio)",
            city: primaryAddress.city ?? "(vazio)",
            state: primaryAddress.state ?? "(vazio)",
          },
        );
      } else {
        // 🔴 CRÍTICO: Se NÃO existe endereço, resetar TODOS os campos explicitamente
        // Isso garante que campos antigos não fiquem "presos" no estado
        console.log(
          "[Profile] ⚠️ Nenhum endereço encontrado - resetando todos os campos",
        );
        setCepTracked("");
        setAddressTracked("");
        setAddressNumberTracked("");
        setComplementTracked("");
        setNeighborhoodTracked("");
        setCityTracked("");
        setStateTracked("");
      }

      // 🔴 CORREÇÃO CRÍTICA: Buscar identity APENAS para birthdate (que não está em profiles)
      // NUNCA sobrescrever fullName ou outros campos de profiles com dados de identity
      let identityData: IdentityProfile | null = null;
      try {
        identityData = await getIdentityProfile();
        setIdentity(identityData);

        // 🔴 REGRA: NUNCA sobrescrever fullName de profiles com identity
        // fullName vem APENAS de profiles (já setado acima)
        // if (identityData && identityData.global?.fullName) {
        //   setFullName(identityData.global.fullName); // ❌ REMOVIDO - não sobrescrever!
        // }

        // birthdate vem de identity (não está em profiles)
        if (identityData && identityData.global?.birthdate) {
          // 🔴 CRÍTICO: Converter data do backend SEM conversão de timezone
          // O input type="date" sempre trabalha com data local (sem hora)
          const dateStr = identityData.global.birthdate;
          if (dateStr) {
            // Se já está no formato YYYY-MM-DD, usar diretamente
            if (
              typeof dateStr === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
            ) {
              setBirthdate(dateStr);
            } else if (
              typeof dateStr === "string" &&
              /^\d{4}-\d{2}-\d{2}/.test(dateStr)
            ) {
              // Se for ISO string, extrair apenas YYYY-MM-DD
              setBirthdate(dateStr.substring(0, 10));
            } else {
              // Se for Date ou outra string, criar Date e usar métodos UTC para evitar timezone
              // IMPORTANTE: Usar UTC para garantir que a data não mude de dia
              const date = new Date(dateStr);
              // Usar UTC para extrair ano, mês e dia (evita problemas de timezone)
              const year = date.getUTCFullYear();
              const month = String(date.getUTCMonth() + 1).padStart(2, "0");
              const day = String(date.getUTCDate()).padStart(2, "0");
              setBirthdate(`${year}-${month}-${day}`);
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar identity (não crítico):", err);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfil");
    } finally {
      setIsLoading(false);

      // 🔴 CRÍTICO: Desativar flag de hidratação após carregamento completo
      // Agora efeitos de CEP podem rodar normalmente (quando usuário editar manualmente)
      // Usar requestAnimationFrame + setTimeout para garantir que todos os setState foram processados
      // e que o React terminou de renderizar antes de reabilitar os efeitos
      // 🔴 AUMENTAR DELAY para garantir que useEffect do CEP não rode imediatamente após
      requestAnimationFrame(() => {
        setTimeout(() => {
          isHydrating.current = false;
          console.log(
            "[Profile] ✅ Hidratação concluída - efeitos de CEP reabilitados",
            {
              cep: cep,
              address: address,
              city: city,
              state: state,
              timestamp: new Date().toISOString(),
            },
          );
        }, 500); // Aumentado de 200ms para 500ms para garantir que todos os setState foram processados
      });
    }
  };

  const handleCepChange = (value: string) => {
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

    // 🔴 CRÍTICO: Fetch é desacoplado - acontece via useEffect
    // Não fazer fetch aqui, apenas atualizar o estado
    // O useEffect vai detectar mudança e buscar automaticamente
  };

  const handleCepBlur = () => {
    // 🔴 CRÍTICO: Se está hidratando (carregando dados do backend), NÃO buscar CEP
    // Isso previne que o endereço carregado do backend seja sobrescrito
    if (isHydrating.current) {
      console.log("[Profile] ⏸️ handleCepBlur: Ignorando durante hidratação");
      return;
    }

    // Se o CEP está completo mas não foi buscado ainda, buscar agora
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length === 8 && !cepLoading) {
      console.log("[Profile] onBlur detectado, buscando CEP...");
      handleCepSearch();
    }
  };

  // 🔧 EXPOR FUNÇÃO DE TESTE GLOBAL
  if (typeof window !== "undefined") {
    (window as any).testCEPFill = async (cepValue: string) => {
      console.log("🧪 ========== TESTE DIRETO DE PREENCHIMENTO ==========");
      console.log("🧪 CEP para testar:", cepValue);
      const cleanCep = cepValue.replace(/\D/g, "");
      console.log("🧪 CEP limpo:", cleanCep);
      console.log("🧪 Estados ANTES do teste:", {
        address,
        neighborhood,
        city,
        state,
        complement,
      });
      await handleCepSearch(cleanCep);
      // Aguardar para ver os estados atualizados
      await new Promise((resolve) => setTimeout(resolve, 500));
      console.log("🧪 Estados DEPOIS do teste:", {
        address,
        neighborhood,
        city,
        state,
        complement,
      });
      console.log("🧪 ========== FIM DO TESTE ==========");
    };
  }

  const handleCpfChange = (value: string) => {
    const masked = maskCPF(value);
    setCpf(masked);
    setCpfError(null);

    const numbers = masked.replace(/\D/g, "");
    if (numbers.length === 11) {
      setCpfValidating(true);
      const isValid = validateCPF(masked);
      if (!isValid) {
        setCpfError("CPF inválido");
      } else {
        verifyCPFExists(masked)
          .then((exists) => {
            if (!exists) {
              setCpfError("CPF não encontrado na Receita Federal");
            }
          })
          .catch(() => {
            // Ignora erro de verificação externa
          })
          .finally(() => {
            setCpfValidating(false);
          });
      }
    }
  };

  const handleSavePersonal = async () => {
    console.log("[Profile] ========== INICIANDO SALVAMENTO ==========");
    console.log("[Profile] Estado atual dos campos:", {
      fullName,
      birthdate,
      gender,
      cpf: cpf ? "***" : "",
      phoneNumber: phoneNumber ? "***" : "",
      address: address ? "***" : "",
    });

    setIsSaving(true);
    setError(null);

    // Validações completas antes de salvar
    const errors: string[] = [];

    // Validar nome
    if (!fullName) {
      setFullNameError("Nome completo é obrigatório");
      errors.push("Nome completo");
    } else {
      const nameValidation = validateFullName(fullName);
      if (!nameValidation.valid) {
        setFullNameError(nameValidation.error || null);
        errors.push("Nome completo");
      }
    }

    // Validar CPF
    if (!cpf) {
      setCpfError("CPF é obrigatório");
      errors.push("CPF");
    } else if (!validateCPF(cpf)) {
      setCpfError("CPF inválido");
      errors.push("CPF");
    }

    // Validar data de nascimento
    if (!birthdate) {
      setBirthdateError("Data de nascimento é obrigatória");
      errors.push("Data de nascimento");
    } else {
      const birthValidation = validateBirthdate(birthdate);
      if (!birthValidation.valid) {
        setBirthdateError(birthValidation.error || null);
        errors.push("Data de nascimento");
      } else {
        setUserAge(birthValidation.age);
      }
    }

    // Validar sexo
    if (!gender) {
      setGenderError("Sexo é obrigatório");
      errors.push("Sexo");
    }

    // Validar telefone
    if (countryCode === "55") {
      if (!phoneNumber) {
        setPhoneError("Telefone é obrigatório");
        errors.push("Telefone");
      } else {
        const phoneValidation = validateBrazilianPhone(areaCode, phoneNumber);
        if (!phoneValidation.valid) {
          setPhoneError(phoneValidation.error || null);
          errors.push("Telefone");
        }
      }
    }

    // Validar endereço
    const addressValidation = validateAddress({
      cep,
      street: address,
      number: addressNumber,
      neighborhood,
      city,
      state,
    });
    if (!addressValidation.valid) {
      if (addressValidation.errors.includes("CEP inválido"))
        setCepError("CEP inválido");
      if (addressValidation.errors.includes("Logradouro"))
        setAddressError("Logradouro inválido");
      if (addressValidation.errors.includes("Número"))
        setAddressNumberError("Número é obrigatório");
      if (addressValidation.errors.includes("Bairro"))
        setNeighborhoodError("Bairro inválido");
      if (addressValidation.errors.includes("Cidade"))
        setCityError("Cidade inválida");
      if (addressValidation.errors.includes("Estado"))
        setStateError("Estado inválido");
      errors.push(...addressValidation.errors);
    }

    if (errors.length > 0) {
      const errorMessage = `Por favor, corrija os seguintes campos: ${errors.join(", ")}`;
      console.error("[Profile] ❌ Validação falhou:", errors);
      setError(errorMessage);
      setIsSaving(false);
      alert(errorMessage); // Mostrar alerta para garantir que o usuário veja o erro
      return;
    }

    console.log(
      "[Profile] ✅ Validação passou, prosseguindo com salvamento...",
    );

    try {
      // Sanitizar dados antes de enviar
      const sanitizedFullName = sanitizeString(fullName, 100);
      const sanitizedAddress = sanitizeString(address, 200);
      const sanitizedComplement = sanitizeString(complement, 100);
      const sanitizedNeighborhood = sanitizeString(neighborhood, 100);
      const sanitizedCity = sanitizeString(city, 100);
      const sanitizedState = sanitizeString(state.toUpperCase(), 2);

      // 🔴 DIAGNÓSTICO: Log dos dados que serão enviados
      // 🔴 CRÍTICO: Normalizar birthdate para garantir formato YYYY-MM-DD
      // O backend espera STRING no formato YYYY-MM-DD, nunca objeto Date ou string com timezone
      let normalizedBirthdate: string | null = null;
      if (birthdate) {
        const birthdateStr = String(birthdate).trim();
        console.log("[Profile] 🔍 Normalizando birthdate:", {
          original: birthdate,
          asString: birthdateStr,
          type: typeof birthdate,
          length: birthdateStr.length,
          hasGMT: birthdateStr.includes("GMT"),
          hasT: birthdateStr.includes("T"),
          isDateString: birthdateStr.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/),
        });

        // 🔴 DETECÇÃO 1: Se for string de Date (começa com dia da semana: Mon, Tue, Wed, etc.)
        if (birthdateStr.match(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/)) {
          console.warn(
            "[Profile] ⚠️ birthdate é uma string de Date (formato GMT):",
            birthdateStr,
          );
          try {
            const date = new Date(birthdateStr);
            if (!isNaN(date.getTime())) {
              const year = date.getUTCFullYear();
              const month = String(date.getUTCMonth() + 1).padStart(2, "0");
              const day = String(date.getUTCDate()).padStart(2, "0");
              normalizedBirthdate = `${year}-${month}-${day}`;
              console.log(
                "[Profile] ✅ Normalizado de Date string para:",
                normalizedBirthdate,
              );
            } else {
              throw new Error("Data inválida");
            }
          } catch (e) {
            console.error("[Profile] ❌ Erro ao normalizar Date string:", e);
            setBirthdateError("Formato de data inválido. Use YYYY-MM-DD");
            setIsSaving(false);
            return;
          }
        }
        // 🔴 DETECÇÃO 2: Se contém GMT ou T (ISO string ou timezone)
        else if (
          birthdateStr.includes("GMT") ||
          birthdateStr.includes("T") ||
          birthdateStr.length > 10
        ) {
          console.warn(
            "[Profile] ⚠️ birthdate contém timezone ou é ISO string:",
            birthdateStr,
          );
          // Tentar extrair YYYY-MM-DD de uma string ISO
          const dateMatch = birthdateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
          if (dateMatch) {
            normalizedBirthdate = dateMatch[0]; // YYYY-MM-DD
            console.log(
              "[Profile] ✅ Extraído YYYY-MM-DD de ISO string:",
              normalizedBirthdate,
            );
          } else {
            // Tentar criar Date e extrair componentes UTC
            try {
              const date = new Date(birthdateStr);
              if (!isNaN(date.getTime())) {
                const year = date.getUTCFullYear();
                const month = String(date.getUTCMonth() + 1).padStart(2, "0");
                const day = String(date.getUTCDate()).padStart(2, "0");
                normalizedBirthdate = `${year}-${month}-${day}`;
                console.log(
                  "[Profile] ✅ Normalizado de Date para:",
                  normalizedBirthdate,
                );
              } else {
                throw new Error("Data inválida");
              }
            } catch (e) {
              console.error("[Profile] ❌ Erro ao normalizar birthdate:", e);
              setBirthdateError("Formato de data inválido. Use YYYY-MM-DD");
              setIsSaving(false);
              return;
            }
          }
        }
        // 🔴 DETECÇÃO 3: Se já está no formato YYYY-MM-DD
        else if (birthdateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
          normalizedBirthdate = birthdateStr;
          console.log(
            "[Profile] ✅ birthdate já está no formato correto:",
            normalizedBirthdate,
          );
        }
        // 🔴 ERRO: Formato inválido
        else {
          console.error(
            "[Profile] ❌ Formato de birthdate inválido:",
            birthdateStr,
          );
          setBirthdateError("Formato de data inválido. Use YYYY-MM-DD");
          setIsSaving(false);
          return;
        }
      }

      console.log("[Profile] Salvando dados:", {
        fullName: sanitizedFullName,
        birthdateOriginal: birthdate,
        birthdateNormalized: normalizedBirthdate,
        birthdateType: typeof birthdate,
      });

      // Atualizar identidade global
      try {
        const identityUpdate = {
          fullName: sanitizedFullName || null,
          birthdate: normalizedBirthdate || null, // 🔴 CRÍTICO: Usar valor normalizado
        };
        console.log("[Profile] Enviando para updateIdentity:", identityUpdate);
        // Verificação segura para Date usando Object.prototype.toString para evitar erro TS2358
        const isDateValue = normalizedBirthdate !== null && normalizedBirthdate !== undefined && typeof normalizedBirthdate === 'object' && Object.prototype.toString.call(normalizedBirthdate) === '[object Date]';
        console.log("[Profile] 🔍 Verificação detalhada do birthdate:", {
          normalizedBirthdate,
          type: typeof normalizedBirthdate,
          isDate: isDateValue,
          value: normalizedBirthdate,
          stringified: JSON.stringify(normalizedBirthdate),
        });

        const identityResult = await updateIdentity(identityUpdate);
        console.log("[Profile] Resposta updateIdentity:", identityResult);

        // Verificar se a data foi salva corretamente
        if (birthdate && identityResult.birthdate !== birthdate) {
          console.warn(
            "[Profile] ATENÇÃO: Data retornada diferente da enviada!",
            {
              enviada: birthdate,
              retornada: identityResult.birthdate,
            },
          );
        }
      } catch (identityErr) {
        console.error("[Profile] Erro ao atualizar identidade:", identityErr);
        throw new Error(
          `Erro ao salvar dados pessoais: ${identityErr instanceof Error ? identityErr.message : "Erro desconhecido"}`,
        );
      }

      // Atualizar perfil local
      const phoneFormatted =
        countryCode === "55"
          ? formatBrazilianPhone(areaCode, phoneNumber)
          : `+${countryCode} ${areaCode} ${phoneNumber}`;

      const sanitizedMetadata = sanitizeObject({
        cpf: cpf.replace(/\D/g, ""),
        gender,
        address: {
          cep: cep.replace(/\D/g, ""),
          // 🔧 CORREÇÃO: Usar nomes compatíveis com o backend (aceita ambos, mas "address" e "address_number" são preferidos)
          address: sanitizedAddress, // Mantém compatibilidade: backend aceita tanto "address" quanto "street"
          address_number: addressNumber.trim(), // Mantém compatibilidade: backend aceita tanto "address_number" quanto "number"
          street: sanitizedAddress, // Mantém para compatibilidade reversa
          number: addressNumber.trim(), // Mantém para compatibilidade reversa
          complement: sanitizedComplement,
          neighborhood: sanitizedNeighborhood,
          city: sanitizedCity,
          state: sanitizedState,
        },
      });

      try {
        console.log("[Profile] Enviando para updateProfile:", {
          fullName: sanitizedFullName,
          phone: phoneFormatted,
          metadataKeys: Object.keys(sanitizedMetadata),
        });

        await updateProfile({
          fullName: sanitizedFullName || undefined,
          phone: phoneFormatted || undefined,
          metadata: sanitizedMetadata,
        });

        console.log("[Profile] Perfil local atualizado com sucesso");
      } catch (profileErr) {
        console.error("[Profile] Erro ao atualizar perfil local:", profileErr);
        throw new Error(
          `Erro ao salvar perfil: ${profileErr instanceof Error ? profileErr.message : "Erro desconhecido"}`,
        );
      }

      // Recarregar dados para confirmar que foram salvos
      console.log("[Profile] Recarregando dados após salvamento...");
      await loadData();

      // Verificar se os dados foram realmente salvos (aguardar um pouco para garantir que o banco foi atualizado)
      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        // 🔴 CORREÇÃO CRÍTICA: Verificar dados salvos usando getCoreProfile (profiles)
        // NÃO usar getIdentityProfile (global_users) porque fullName está em profiles
        const reloadedCoreProfile = await getCoreProfile();
        console.log("[Profile] Dados recarregados de profiles:", {
          fullName: reloadedCoreProfile.personal_profile?.fullName,
          phone: reloadedCoreProfile.personal_profile?.phone,
          hasMetadata: !!reloadedCoreProfile.personal_profile?.metadata,
          metadataKeys: Object.keys(
            reloadedCoreProfile.personal_profile?.metadata || {},
          ),
        });

        // Verificar birthdate de identity (que está em global_users)
        const reloadedIdentity = await getIdentityProfile();
        console.log("[Profile] Dados recarregados de identity (birthdate):", {
          birthdate: reloadedIdentity.global?.birthdate,
          birthdateEsperada: birthdate,
        });

        // Verificar se fullName foi salvo corretamente em profiles
        if (sanitizedFullName) {
          const savedFullName = reloadedCoreProfile.personal_profile?.fullName;
          if (savedFullName !== sanitizedFullName) {
            console.error(
              "[Profile] ERRO CRÍTICO: fullName não foi salvo corretamente em profiles!",
              {
                esperado: sanitizedFullName,
                salvo: savedFullName,
                source: "profiles",
              },
            );
            setError(
              `Atenção: O nome completo pode não ter sido salvo corretamente. Valor esperado: ${sanitizedFullName}, valor salvo: ${savedFullName || "não encontrado"}`,
            );
            setIsSaving(false);
            return;
          } else {
            console.log(
              "[Profile] ✅ fullName confirmado como salvo corretamente em profiles:",
              savedFullName,
            );
          }
        }

        // Verificar se a data foi salva (comparar apenas a parte da data, ignorando timezone)
        if (birthdate) {
          const expectedDate = birthdate.substring(0, 10); // YYYY-MM-DD
          let savedDate: string | null = null;

          if (reloadedIdentity.global?.birthdate) {
            if (typeof reloadedIdentity.global.birthdate === "string") {
              // Se já é string YYYY-MM-DD, usar diretamente
              savedDate = reloadedIdentity.global.birthdate.substring(0, 10);
            } else {
              // Se for Date, usar UTC para extrair (evita problemas de timezone)
              const date = new Date(reloadedIdentity.global.birthdate);
              const year = date.getUTCFullYear();
              const month = String(date.getUTCMonth() + 1).padStart(2, "0");
              const day = String(date.getUTCDate()).padStart(2, "0");
              savedDate = `${year}-${month}-${day}`;
            }
          }

          if (savedDate !== expectedDate) {
            console.error(
              "[Profile] ERRO CRÍTICO: Data não foi salva corretamente!",
              {
                esperada: expectedDate,
                salva: savedDate,
                original: reloadedIdentity.global?.birthdate,
                tipo: typeof reloadedIdentity.global?.birthdate,
              },
            );
            setError(
              `Atenção: A data de nascimento pode não ter sido salva corretamente. Valor esperado: ${expectedDate}, valor salvo: ${savedDate || "não encontrado"}`,
            );
            setIsSaving(false);
            return;
          } else {
            console.log(
              "[Profile] ✅ Data confirmada como salva corretamente:",
              savedDate,
            );
          }
        }
      } catch (reloadErr) {
        console.warn(
          "[Profile] Erro ao verificar dados recarregados (não crítico):",
          reloadErr,
        );
        // Não bloquear sucesso se a verificação falhar
      }

      // Limpar erros e mostrar sucesso
      setError(null);
      alert("Perfil atualizado com sucesso!");
    } catch (err) {
      console.error("[Profile] Erro completo ao salvar:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Erro ao salvar perfil";
      setError(errorMessage);
      alert(`Erro ao salvar perfil: ${errorMessage}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-page">
        <div className="loading">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      {/* Header de Contexto - apenas para Pessoa Jurídica */}
      {activeTab === "legal" && (
        <div className="context-header">
          <h2>🏢 Pessoa Jurídica</h2>
          <p>Gerencie suas empresas, validações e permissões</p>
        </div>
      )}

      {/* FASE 3.6: Toggle de Plano para usuário teste/admin - compactado */}
      {canTogglePlan && (
        <div
          className="plan-toggle-section"
          style={{
            marginBottom: "0",
            marginTop: "0",
            padding: "0.75rem 2rem",
            background: "#f9fafb",
            borderRadius: "0",
            border: "none",
            borderBottom: "1px solid #e5e7eb",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 500 }}>
              Plano: <strong>{userPlan.toUpperCase()}</strong>
              {userPlan === "pro" && (
                <span style={{ marginLeft: "0.5rem", color: "#6b7280", fontSize: "0.8125rem" }}>
                  Você tem acesso a recursos avançados para empresas.
                </span>
              )}
            </span>
            <button
              onClick={handleTogglePlan}
              disabled={isUpdatingPlan}
              style={{
                padding: "0.5rem 1rem",
                background: userPlan === "free" ? "#10b981" : "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isUpdatingPlan ? "not-allowed" : "pointer",
                fontWeight: 500,
                fontSize: "0.8125rem",
              }}
            >
              {isUpdatingPlan
                ? "Alterando..."
                : userPlan === "free"
                  ? "🔼 Upgrade para PRO"
                  : "🔽 Voltar para FREE"}
            </button>
          </div>
        </div>
      )}

      <div className="profile-tabs">
        <button
          className={`tab-button ${activeTab === "personal" ? "active" : ""}`}
          onClick={() => setActiveTab("personal")}
        >
          Pessoal
        </button>
        <button
          className={`tab-button ${activeTab === "professional" ? "active" : ""}`}
          onClick={() => setActiveTab("professional")}
        >
          Profissional
        </button>
        <button
          className={`tab-button ${activeTab === "physical" ? "active" : ""}`}
          onClick={() => setActiveTab("physical")}
        >
          Físico
        </button>
        <button
          className={`tab-button ${activeTab === "learning" ? "active" : ""}`}
          onClick={() => setActiveTab("learning")}
        >
          Aprendizado
        </button>
        <button
          className={`tab-button ${activeTab === "legal" ? "active" : ""}`}
          onClick={() => setActiveTab("legal")}
        >
          Pessoa Jurídica
        </button>
      </div>

      <main className="profile-content">
        {/* Sugestões contextuais - apenas na home do perfil */}
        {activeTab === "personal" && (
          <ContextualSuggestion onNavigate={(tab) => setActiveTab(tab)} />
        )}

        {activeTab === "personal" && (
          <div className="profile-form">
            <h2>Informações Pessoais</h2>

            {error && (
              <div
                className="error-message"
                style={{
                  padding: "1rem",
                  backgroundColor: "#fee2e2",
                  border: "1px solid #ef4444",
                  borderRadius: "0.5rem",
                  color: "#dc2626",
                  marginBottom: "1rem",
                  fontWeight: "500",
                }}
              >
                ⚠️ {error}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="fullName">Nome Completo *</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => {
                  // Permitir espaços durante a digitação - apenas remover tags HTML perigosas
                  let value = e.target.value;
                  // Remove apenas tags HTML, mas mantém espaços
                  value = value.replace(/[<>]/g, "");
                  // Limita tamanho sem fazer trim (permite espaços)
                  if (value.length > 100) {
                    value = value.slice(0, 100);
                  }
                  setFullName(value);
                  // Limpa erro enquanto digita (não valida em tempo real para permitir digitação)
                  setFullNameError(null);
                }}
                onBlur={() => {
                  // Validação apenas quando sair do campo
                  if (fullName) {
                    const trimmed = fullName.trim();
                    if (trimmed !== fullName) {
                      // Se tinha espaços nas bordas, atualiza removendo-os
                      setFullName(trimmed);
                    }
                    const validation = validateFullName(trimmed);
                    if (!validation.valid) {
                      setFullNameError(validation.error || null);
                    }
                  }
                }}
                placeholder="Digite seu nome completo"
                required
                className={fullNameError ? "error" : ""}
              />
              {fullNameError && (
                <span className="field-error">{fullNameError}</span>
              )}
              {!fullNameError && fullName && (
                <span className="field-success">✓</span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cpf">CPF *</label>
                <input
                  id="cpf"
                  type="text"
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={cpfError ? "error" : ""}
                />
                {cpfValidating && (
                  <span className="validating">Validando...</span>
                )}
                {cpfError && <span className="field-error">{cpfError}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="birthdate">Data de Nascimento *</label>
                <input
                  id="birthdate"
                  type="date"
                  value={birthdate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setBirthdate(value);
                    setBirthdateError(null);
                    if (value) {
                      const validation = validateBirthdate(value);
                      if (!validation.valid) {
                        setBirthdateError(validation.error || null);
                      } else {
                        setUserAge(validation.age);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (birthdate) {
                      const validation = validateBirthdate(birthdate);
                      if (!validation.valid) {
                        setBirthdateError(validation.error || null);
                      } else {
                        setUserAge(validation.age);
                      }
                    }
                  }}
                  required
                  className={birthdateError ? "error" : ""}
                  max={
                    new Date(
                      new Date().setFullYear(new Date().getFullYear() - 16),
                    )
                      .toISOString()
                      .split("T")[0]
                  }
                />
                {birthdateError && (
                  <span className="field-error">{birthdateError}</span>
                )}
                {!birthdateError && birthdate && userAge !== undefined && (
                  <span className="field-success">✓ Idade: {userAge} anos</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="gender">Sexo *</label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => {
                    setGender(e.target.value as "male" | "female");
                    setGenderError(null);
                  }}
                  onBlur={() => {
                    if (!gender) {
                      setGenderError("Selecione o sexo");
                    }
                  }}
                  required
                  className={genderError ? "error" : ""}
                >
                  <option value="">Selecione</option>
                  <option value="male">Masculino</option>
                  <option value="female">Feminino</option>
                </select>
                {genderError && (
                  <span className="field-error">{genderError}</span>
                )}
                {!genderError && gender && (
                  <span className="field-success">✓</span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="phone">Telefone Celular *</label>
              <div className="phone-input-group">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="country-select"
                >
                  {COUNTRY_CODES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} +{country.code} {country.name}
                    </option>
                  ))}
                </select>
                {countryCode === "55" && (
                  <select
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value)}
                    className="area-select"
                  >
                    {BRAZIL_AREA_CODES.map((area) => (
                      <option key={area.code} value={area.code}>
                        ({area.code}) {area.city} - {area.state}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    const numbers = e.target.value.replace(/\D/g, "");
                    setPhoneNumber(numbers);
                    setPhoneError(null);
                    if (countryCode === "55" && numbers.length > 0) {
                      const validation = validateBrazilianPhone(
                        areaCode,
                        numbers,
                      );
                      if (!validation.valid && numbers.length >= 8) {
                        setPhoneError(validation.error || null);
                      }
                    }
                  }}
                  onBlur={() => {
                    if (countryCode === "55" && phoneNumber) {
                      const validation = validateBrazilianPhone(
                        areaCode,
                        phoneNumber,
                      );
                      if (!validation.valid) {
                        setPhoneError(validation.error || null);
                      }
                    }
                  }}
                  placeholder={countryCode === "55" ? "9XXXXXXXX" : "Número"}
                  maxLength={countryCode === "55" ? 9 : 15}
                  className={`phone-input ${phoneError ? "error" : ""}`}
                />
              </div>
              {phoneError && <span className="field-error">{phoneError}</span>}
              {!phoneError && countryCode === "55" && phoneNumber && (
                <p className="phone-hint">
                  {isCellPhone(areaCode, phoneNumber)
                    ? "✓ Celular válido"
                    : "✓ Telefone fixo válido"}
                </p>
              )}
            </div>

            <h3>Endereço</h3>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cep">CEP *</label>
                <input
                  id="cep"
                  type="text"
                  value={cep}
                  onChange={(e) => handleCepChange(e.target.value)}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  maxLength={9}
                  className={cepError ? "error" : ""}
                />
                {cepLoading && (
                  <span className="loading-small">Buscando...</span>
                )}
                {cepError && <span className="field-error">{cepError}</span>}
                {!cepError && cep.replace(/\D/g, "").length === 8 && (
                  <span className="field-success">✓</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="address">Logradouro *</label>
                <input
                  id="address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    const value = sanitizeString(e.target.value, 200);
                    setAddressTracked(value);
                    // 🔴 CRÍTICO: NÃO validar durante digitação
                    // Validação só acontece no submit
                    setAddressError(null);
                  }}
                  onBlur={() => {
                    if (address && address.trim().length < 3) {
                      setAddressError(
                        "Logradouro deve ter pelo menos 3 caracteres",
                      );
                    }
                  }}
                  placeholder="Rua, Avenida, etc."
                  required
                  className={addressError ? "error" : ""}
                />
                {addressError && (
                  <span className="field-error">{addressError}</span>
                )}
              </div>

              <div className="form-group form-group-small">
                <label htmlFor="addressNumber">Número *</label>
                <input
                  id="addressNumber"
                  type="text"
                  value={addressNumber}
                  onChange={(e) => {
                    const value = sanitizeString(e.target.value, 20);
                    setAddressNumberTracked(value);
                    setAddressNumberError(null);
                  }}
                  onBlur={() => {
                    // 🔴 CRÍTICO: NÃO validar durante preenchimento automático
                    // Validar apenas se o usuário sair do campo sem preencher
                    // Não bloquear durante o preenchimento automático do CEP
                    if (!addressNumber || addressNumber.trim().length === 0) {
                      // Só mostrar erro se o usuário realmente saiu do campo sem preencher
                      // Não durante o auto-preenchimento
                      setAddressNumberError("Número é obrigatório");
                    }
                  }}
                  placeholder="123"
                  required
                  className={addressNumberError ? "error" : ""}
                />
                {addressNumberError && (
                  <span className="field-error">{addressNumberError}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="complement">Complemento</label>
                <input
                  id="complement"
                  type="text"
                  value={complement}
                  onChange={(e) => setComplementTracked(e.target.value)}
                  placeholder="Apto, Bloco, etc."
                />
              </div>

              <div className="form-group">
                <label htmlFor="neighborhood">Bairro *</label>
                <input
                  id="neighborhood"
                  type="text"
                  value={neighborhood}
                  onChange={(e) => {
                    const value = sanitizeString(e.target.value, 100);
                    setNeighborhoodTracked(value);
                    setNeighborhoodError(null);
                  }}
                  onBlur={() => {
                    if (neighborhood && neighborhood.trim().length < 2) {
                      setNeighborhoodError(
                        "Bairro deve ter pelo menos 2 caracteres",
                      );
                    }
                  }}
                  required
                  className={neighborhoodError ? "error" : ""}
                />
                {neighborhoodError && (
                  <span className="field-error">{neighborhoodError}</span>
                )}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="city">Cidade *</label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(e) => {
                    const value = sanitizeString(e.target.value, 100);
                    setCityTracked(value);
                    setCityError(null);
                  }}
                  onBlur={() => {
                    if (city && city.trim().length < 2) {
                      setCityError("Cidade deve ter pelo menos 2 caracteres");
                    }
                  }}
                  required
                  className={cityError ? "error" : ""}
                />
                {cityError && <span className="field-error">{cityError}</span>}
              </div>

              <div className="form-group form-group-small">
                <label htmlFor="state">Estado *</label>
                <input
                  id="state"
                  type="text"
                  value={state.toUpperCase()}
                  onChange={(e) => {
                    const value = sanitizeString(
                      e.target.value.toUpperCase(),
                      2,
                    );
                    setStateTracked(value);
                    // 🔴 CRÍTICO: NÃO validar durante digitação
                    // Validação só acontece no submit ou onBlur (se já tiver valor)
                    setStateError(null);
                  }}
                  onBlur={() => {
                    // Validar apenas no blur, e só se já tiver algum valor
                    // Não bloquear durante o preenchimento automático do CEP
                    if (
                      state &&
                      state.trim().length > 0 &&
                      state.trim().length !== 2
                    ) {
                      setStateError(
                        "Estado deve ter 2 caracteres (ex: PR, SP)",
                      );
                    }
                  }}
                  maxLength={2}
                  placeholder="PR"
                  required
                  className={stateError ? "error" : ""}
                />
                {stateError && (
                  <span className="field-error">{stateError}</span>
                )}
                {!stateError && state.length === 2 && (
                  <span className="field-success">✓</span>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button
                onClick={handleSavePersonal}
                disabled={isSaving}
                className="save-button"
              >
                {isSaving ? "Salvando..." : "Salvar Informações Pessoais"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "professional" && <ProfileProfessional />}

        {activeTab === "physical" && <ProfilePhysical />}

        {activeTab === "learning" && <ProfileLearning />}

        {activeTab === "legal" && (
          <div className="profile-form">
            <CompaniesManager />
          </div>
        )}
      </main>
    </div>
  );
}
