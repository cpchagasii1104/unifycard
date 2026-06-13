// src/components/Profile.tsx
// Página de perfil com abas: Pessoal, Profissional, Interesses e Gostos, Pessoa Jurídica

import { useState, useEffect, useRef } from "react";
import { Navigate } from "react-router-dom";
import {
  getIdentityProfile,
  updateIdentity,
  type IdentityProfile,
} from "../api/identity";
import { updateProfile, confirmFirstAccess } from "../api/profile";
import { putResidenceAddress } from "../api/residenceAddress";
import { getCoreProfile } from "../api/core";
import { getPlan, updatePlan, type UserPlan } from "../api/plan";
import { maskCPF, validateCPF, verifyCPFExists } from "../utils/cpf";
import {
  formatBrazilianPhone,
} from "../utils/phone";
import {
  sanitizeString,
  validateFullName,
  validateBirthdate,
  validateBrazilianPhone,
  validateAddress,
  sanitizeObject,
} from "../utils/validation";
import { parseBirthdateToISO } from "../utils/dateNormalizer";
import ProfileProfessional from "./ProfileProfessional";
import ProfilePhysical from "./ProfilePhysical";
import ProfileLearning from "./ProfileLearning";
import ProfileHealth from "./ProfileHealth";
import ProfileEducation from "./ProfileEducation";
import ProfileAgenda from "./ProfileAgenda";
import { useSession } from "../contexts/SessionProvider";
import ContextualSuggestion from "./ContextualSuggestion";
import { CompaniesManager } from "./CompaniesManager";
import OnboardingModal from "./OnboardingModal";
import ProfileProgressBar from "./ProfileProgressBar";
import { useProfilePersonalState } from "../hooks/useProfilePersonalState";
import { type Gender } from "@unificard/contracts";
import { useProfileCep } from "../hooks/useProfileCep";
import ProfilePersonalForm from "./ProfilePersonalForm";
import "./Profile.css";

type Tab = "personal" | "professional" | "physical" | "learning" | "health" | "education" | "legal" | "agenda";

const VALID_TABS: Tab[] = ["personal", "professional", "physical", "learning", "health", "education", "legal", "agenda"];

function getInitialTab(): Tab {
  // 2026-05-15: suportar /perfil?tab=agenda (quick actions profissionais apontam para aba específica)
  if (typeof window === 'undefined') return 'personal';
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('tab');
  if (raw && (VALID_TABS as string[]).includes(raw)) return raw as Tab;
  return 'personal';
}

export default function Profile() {
  const { refreshActors, activeActor, sessionReady } = useSession();

  // FIX 2.b — DECISION-0043 pendente / DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT.
  // Princípios 8 e 9: redirect reorganiza superfície (não migra soberania),
  // síncrono, derivado de activeActor já resolvido no cliente. Zero fetch.
  // Posicionado ANTES de useState/useEffect/fetch — Profile não monta quando
  // actor=page (defesa em profundidade reforçada pelos guards em sub-componentes).
  if (activeActor?.actor_type === 'page' && activeActor.company_id) {
    return <Navigate to={`/empresa/${activeActor.company_id}`} replace />;
  }

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 🔴 ONBOARDING: Estados para controle de onboarding (baseado APENAS no backend)
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  /** Cadeado identidade (CPF+nascimento+sexo): só quando confirmado E CPF+nascimento existem (evita “travado sem dado”). */
  const [lockIdentityCore, setLockIdentityCore] = useState(false);
  /** DECISION-0120: confirmação civil vigente na camada identity (autoridade da trava). */
  const [civilDataConfirmed, setCivilDataConfirmed] = useState(false);
  const [confirmingCivil, setConfirmingCivil] = useState(false);
  const [profileProgress, setProfileProgress] = useState<number | null>(null);

  // Formulário Pessoal - usando hook extraído
  const personalState = useProfilePersonalState();
  const {
    fullName,
    setFullName,
    fullNameError,
    setFullNameError,
    hasFullName,
    setHasFullName,
    cpf,
    setCpf,
    cpfError,
    setCpfError,
    cpfValidating,
    setCpfValidating,
    hasCpf,
    setHasCpf,
    birthdate,
    setBirthdate,
    birthdateError,
    setBirthdateError,
    userAge,
    setUserAge,
    hasBirthdate,
    setHasBirthdate,
    gender,
    setGender,
    genderError,
    setGenderError,
    hasGender,
    setHasGender,
    countryCode,
    setCountryCode,
    areaCode,
    setAreaCode,
    phoneNumber,
    setPhoneNumber,
    phoneError,
    setPhoneError,
    cep,
    _setCep,
    cepError,
    setCepError,
    address,
    _setAddress,
    addressError,
    setAddressError,
    addressNumber,
    _setAddressNumber,
    addressNumberError,
    setAddressNumberError,
    complement,
    _setComplement,
    neighborhood,
    _setNeighborhood,
    neighborhoodError,
    setNeighborhoodError,
    city,
    _setCity,
    cityError,
    setCityError,
    state,
    _setState,
    stateError,
    setStateError,
  } = personalState;

  const [cepLoading, setCepLoading] = useState(false);
  const isHydrating = useRef(false); // 🔴 CRÍTICO: Flag para prevenir efeitos durante carregamento
  const cepOriginRef = useRef<'backend' | 'user' | null>(null); // 🔴 CORREÇÃO: Ref única para rastrear origem do CEP
  const [referralCode, setReferralCode] = useState<string | null>(null);

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
    // GUARD: Não fazer chamadas de API antes de sessionReady
    if (!sessionReady) {
      return;
    }
    loadData();
    loadPlan();
    loadProgress();
  }, [sessionReady]); // 🔴 CRÍTICO: Executar apenas quando sessionReady - não resetar campos de endereço

  // 🔴 UX: Carregar progresso do perfil
  const loadProgress = async () => {
    try {
      const { getProfileProgress } = await import('../api/profile');
      const progress = await getProfileProgress();
      setProfileProgress(progress.progress);
    } catch (err) {
      console.warn('[Profile] Erro ao carregar progresso (não crítico):', err);
    }
  };

  // Usar hook de CEP
  const { handleCepChange, handleCepBlur } = useProfileCep(
    cep,
    setCepTracked,
    setCepError,
    setCepLoading,
    setAddressTracked,
    setNeighborhoodTracked,
    setCityTracked,
    setStateTracked,
    setComplementTracked,
    setAddressError,
    setNeighborhoodError,
    setCityError,
    setStateError,
    cepLoading,
    isLoading,
    isHydrating,
    cepOriginRef
  );

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
      // 🔴 CORREÇÃO: Usar actorId quando activeActor não for 'user'
      // Para page/group/channel, buscar profile específico do actor
      const actorId = activeActor && activeActor.actor_type !== 'user' ? activeActor.actor_id : undefined;
      
      // Usar CORE como fonte única
      const coreProfile = await getCoreProfile(actorId);

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
      const fullNameValue = personalProfile?.fullName ?? "";
      setFullName(fullNameValue);
      // 🔴 IMUTABILIDADE: Se fullName existe, marcar como já cadastrado (imutável)
      setHasFullName(!!fullNameValue);
      
      // Código de indicação com fallback
      let code = personalProfile?.referralCode ?? null;
      
      // 🔴 FALLBACK: Se não veio no profile, buscar diretamente
      if (!code) {
        try {
          const { getReferralCode } = await import('../api/auth');
          const referralData = await getReferralCode();
          code = referralData.referralCode;
          console.log('[Profile] ✅ Código de indicação obtido via fallback:', code);
        } catch (err) {
          console.warn('[Profile] ⚠️ Não foi possível obter código de indicação:', err);
        }
      }
      
      setReferralCode(code);

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


      // Extrair dados do metadata (sempre setar, mesmo se vazio)
      // 🔴 REGRA: Estado sempre definido explicitamente
      const metadata = personalProfile?.metadata || {};

      // CPF (sempre setar, mesmo se vazio)
      // 🔴 CORREÇÃO: CPF vem de personal_profile.cpf, não de metadata
      const cpfDigits =
        personalProfile?.cpf?.replace(/\D/g, "") ?? "";
      const cpfValue = cpfDigits.length === 11 ? maskCPF(cpfDigits) : "";
      setCpf(cpfValue);
      setHasCpf(cpfDigits.length === 11);

      // Gender (sempre setar, mesmo se vazio)
      const genderValue = (metadata.gender as Gender | "") || "";
      setGender(genderValue);
      // 🔴 IMUTABILIDADE: Se gender existe, marcar como já cadastrado (imutável)
      setHasGender(!!genderValue);

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
        // 🔴 CORREÇÃO: Marcar origem como 'backend' antes de setar CEP
        cepOriginRef.current = 'backend';
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
        // 🔴 CORREÇÃO: Marcar origem como 'backend' antes de resetar CEP
        cepOriginRef.current = 'backend';
        setCepTracked("");
        setAddressTracked("");
        setAddressNumberTracked("");
        setComplementTracked("");
        setNeighborhoodTracked("");
        setCityTracked("");
        setStateTracked("");
      }

      // Identity: reputação / onboarding flags; nascimento vem primeiro do CORE (personal_profile.birthdate), depois identity
      let identityData: IdentityProfile | null = null;
      try {
        identityData = await getIdentityProfile();
      } catch (err: any) {
        // CP2 (/identity/me honesto): 409 IDENTITY_CHAIN_INCOMPLETE = cadeia de identidade quebrada
        // (estrutural) — distinto de dado progressivo ausente. Erro estrutural É exibido, não engolido.
        if (err?.code === "IDENTITY_CHAIN_INCOMPLETE" || err?.status === 409) {
          setError(
            "Sua identidade está incompleta no sistema (cadastro anterior ao modelo atual). Contate o suporte.",
          );
        } else {
          console.warn("Erro ao buscar identity (não crítico):", err);
        }
      }

      const pp = coreProfile.personal_profile as
        | (typeof coreProfile.personal_profile & {
            profilePersonalConfirmed?: boolean;
            birthdate?: string | null;
          })
        | null
        | undefined;

      let birthIso = "";
      const coreBirth = pp?.birthdate;
      if (typeof coreBirth === "string" && /^\d{4}-\d{2}-\d{2}/.test(coreBirth)) {
        birthIso = coreBirth.substring(0, 10);
      } else if (identityData?.global?.birthdate) {
        const dateStr = identityData.global.birthdate;
        if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          birthIso = dateStr;
        } else if (typeof dateStr === "string" && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          birthIso = dateStr.substring(0, 10);
        } else if (dateStr) {
          const date = new Date(dateStr as string);
          const year = date.getUTCFullYear();
          const month = String(date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(date.getUTCDate()).padStart(2, "0");
          birthIso = `${year}-${month}-${day}`;
        }
      }
      if (birthIso) {
        setBirthdate(birthIso);
        setHasBirthdate(true);
      } else {
        setBirthdate("");
        setHasBirthdate(false);
      }

      // DECISION-0120: a TRAVA civil deriva da camada IDENTITY (can_edit_personal_data),
      // NÃO de profiles.profile_personal_confirmed. civilDataConfirmed = trava vigente.
      const civilDataConfirmed = identityData?.civil_data_confirmed === true
        || identityData?.can_edit_personal_data === false;

      const cpfPresent = cpfDigits.length === 11;
      const birthPresent = birthIso.length >= 10;
      const lockTrio =
        civilDataConfirmed === true &&
        cpfPresent &&
        birthPresent;
      setLockIdentityCore(lockTrio);

      const onboardingCompleted =
        metadata?.onboarding_completed === true ||
        identityData?.global?.metadata?.onboarding_completed === true;
      setOnboardingCompleted(onboardingCompleted);

      // DECISION-0120 D2: o MODAL é controlado por AVISO VISTO (first_access_notice_seen),
      // não pela confirmação civil. "Entendi, continuar" só marca o aviso como visto.
      // 🔴 GUARD: modal de primeiro acesso só faz sentido para actor=user
      // (page/group/channel retornam personal_profile=null — DT-CORE-PROFILE-IGNORES-ACTOR-CONTEXT).
      const noticeSeen = identityData?.first_access_notice_seen === true;
      const showModal = activeActor?.actor_type === 'user' && !noticeSeen;
      setShowOnboardingModal(showModal);
      setCivilDataConfirmed(civilDataConfirmed);

      console.log("[Profile] ✅ Estado de primeiro acesso atualizado:", {
        civilDataConfirmed,
        noticeSeen,
        onboardingCompleted,
        lockIdentityCore: lockTrio,
        showOnboardingModal: showModal,
        fullName: fullNameValue,
        birthIso,
        gender: metadata.gender,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar perfil");
      setLockIdentityCore(false);
      // Não alterar showOnboardingModal nem onboardingCompleted — erro ≠ decisão de negócio
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

  // REMOVIDO: handleCepChange e handleCepBlur movidos para useProfileCep hook

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

    // Nome: obrigatório só enquanto ainda não há nome persistido no perfil
    if (!hasFullName) {
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
    }

    // 🔴 IMUTABILIDADE: Validar CPF apenas se ainda não foi cadastrado
    if (!hasCpf) {
      if (!cpf) {
        setCpfError("CPF é obrigatório");
        errors.push("CPF");
      } else if (!validateCPF(cpf)) {
        setCpfError("CPF inválido");
        errors.push("CPF");
      }
    }

    // Nascimento / sexo: validar só quando o trio ainda não está travado (dados editáveis)
    if (!lockIdentityCore) {
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
      if (!gender) {
        setGenderError("Sexo é obrigatório");
        errors.push("Sexo");
      }
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

      // 🔴 CRÍTICO: Normalizar birthdate para DATE puro (YYYY-MM-DD) antes de enviar
      // Backend só persiste DATE (YYYY-MM-DD), não aceita ISO completo
      // Aceita DD/MM/YYYY ou YYYY-MM-DD e converte para DATE puro
      let normalizedBirthdate: string | null = null;
      if (birthdate) {
        // Primeiro normalizar usando parseBirthdateToISO
        let parsed = parseBirthdateToISO(birthdate);
        
        // 🔴 CORREÇÃO OBRIGATÓRIA: Garantir que seja DATE puro (YYYY-MM-DD)
        // Se por algum motivo vier como ISO completo, extrair apenas a parte da data
        if (parsed) {
          // Se contém 'T' ou timezone, extrair apenas YYYY-MM-DD
          if (parsed.includes('T')) {
            normalizedBirthdate = parsed.slice(0, 10);
          } else {
            normalizedBirthdate = parsed;
          }
        }
        
        // 🔴 GARANTIA EXTRA: Se ainda não está no formato correto, tentar extrair de ISO
        if (!normalizedBirthdate && birthdate.includes('T')) {
          const dateMatch = birthdate.match(/^(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            normalizedBirthdate = dateMatch[1];
          }
        }
        
        // 🔴 GARANTIA FINAL: Se ainda não está correto, criar Date e extrair DATE puro
        if (!normalizedBirthdate) {
          try {
            const dateObj = new Date(birthdate);
            if (!isNaN(dateObj.getTime())) {
              // Extrair apenas YYYY-MM-DD (não usar toISOString que inclui hora/timezone)
              const year = dateObj.getUTCFullYear();
              const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
              const day = String(dateObj.getUTCDate()).padStart(2, '0');
              normalizedBirthdate = `${year}-${month}-${day}`;
            }
          } catch (e) {
            // Ignorar erro
          }
        }
        
        if (!normalizedBirthdate) {
          setBirthdateError("Formato de data inválido. Use DD/MM/YYYY ou YYYY-MM-DD (ex: 03/09/1953 ou 1953-09-03)");
          setIsSaving(false);
          return;
        }
        
        // 🔴 VALIDAÇÃO FINAL: Garantir que está no formato YYYY-MM-DD
        if (!normalizedBirthdate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setBirthdateError("Formato de data inválido. Use DD/MM/YYYY ou YYYY-MM-DD (ex: 03/09/1953 ou 1953-09-03)");
          setIsSaving(false);
          return;
        }
        
        console.log("[Profile] ✅ Data normalizada para DATE puro (YYYY-MM-DD):", {
          original: birthdate,
          converted: normalizedBirthdate,
        });
      }

      console.log("[Profile] Salvando dados:", {
        fullName: sanitizedFullName,
        birthdateOriginal: birthdate,
        birthdateNormalized: normalizedBirthdate,
        birthdateType: typeof birthdate,
      });

      // Atualizar identidade global
      // 🔴 IMUTABILIDADE: Só enviar fullName e birthdate se ainda não foram cadastrados
      try {
        const identityUpdate: {
          fullName?: string | null;
          birthdate?: string | null;
        } = {};
        
        // 🔴 IMUTABILIDADE: Só incluir fullName se ainda não foi cadastrado
        if (!hasFullName && sanitizedFullName) {
          identityUpdate.fullName = sanitizedFullName;
        }
        
        // 🔴 IMUTABILIDADE: Só incluir birthdate se ainda não foi cadastrado
        if (!hasBirthdate && normalizedBirthdate) {
          identityUpdate.birthdate = normalizedBirthdate;
        }
        
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

        // 🔧 FIX (do not call updateIdentity with empty payload)
        if (Object.keys(identityUpdate).length > 0) {
          const identityResult = await updateIdentity(identityUpdate);
          console.log("[Profile] Resposta updateIdentity:", identityResult);
        } else {
          console.log("[Profile] updateIdentity não chamado: objeto vazio (dados já cadastrados)");
        }
        
        // 🔴 REMOVIDO: Alerta falso de erro de data - não comparar strings diretamente
        // O backend pode retornar a data em formato diferente (Date object vs string)
        // A validação real é feita pelo backend
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

      // 🔴 F2 (DECISION-0074): o endereço civil PF NÃO vai mais em `metadata.address`. Ele é gravado no
      // Location Core canônico via PUT /profile/residence-address (abaixo, após o updateProfile). O metadata
      // segue carregando apenas cpf/gender quando aplicável (fora do escopo desta frente — não alterar).
      const metadataToSend: Record<string, any> = {};

      // 🔴 IMUTABILIDADE: Só incluir CPF e gender no metadata se ainda não foram cadastrados
      if (!hasCpf && cpf) {
        metadataToSend.cpf = cpf.replace(/\D/g, "");
      }
      if (!hasGender && gender) {
        metadataToSend.gender = gender;
      }

      const sanitizedMetadata = sanitizeObject(metadataToSend);

      try {
        // 🔴 IMUTABILIDADE: Só incluir fullName se ainda não foi cadastrado
        const profileUpdate: {
          fullName?: string;
          phone?: string;
          metadata?: Record<string, any>;
        } = {};

        // Adicionar fullName apenas se ainda não foi cadastrado e tem valor
        if (!hasFullName && sanitizedFullName) {
          profileUpdate.fullName = sanitizedFullName;
        }

        // Adicionar phone apenas se tem valor
        if (phoneFormatted) {
          profileUpdate.phone = phoneFormatted;
        }

        // Adicionar metadata apenas se tem conteúdo válido
        if (sanitizedMetadata && Object.keys(sanitizedMetadata).length > 0) {
          profileUpdate.metadata = sanitizedMetadata;
        }

        // 🔧 FIX: Validação explícita para garantir que não estamos enviando payload vazio
        // 🔴 VALIDAÇÃO CRÍTICA: Garantir que não estamos enviando payload vazio
        const hasValidFields =
          profileUpdate.fullName !== undefined ||
          profileUpdate.phone !== undefined ||
          (profileUpdate.metadata !== undefined && Object.keys(profileUpdate.metadata).length > 0);

        if (!hasValidFields) {
          console.error("[Profile] ❌ Tentativa de enviar payload vazio bloqueada");
          throw new Error("Nenhum campo válido para atualizar. Preencha ao menos um campo antes de salvar.");
        }

        console.log("[Profile] Enviando para updateProfile:", {
          fullName: profileUpdate.fullName || "(não enviado)",
          phone: profileUpdate.phone || "(não enviado)",
          metadataKeys: profileUpdate.metadata ? Object.keys(profileUpdate.metadata) : [],
          hasFullName: hasFullName,
          hasCpf: hasCpf,
          hasGender: hasGender,
          hasBirthdate: hasBirthdate,
        });

        await updateProfile(profileUpdate);

        console.log("[Profile] Perfil local atualizado com sucesso");

        // 🔴 F2 (DECISION-0074): grava o endereço civil PF no Location Core canônico (CEP-âncora),
        // NÃO mais em metadata.address. Só envia se há CEP preenchido (mínimo canônico). Falha do
        // endereço NÃO é mascarada como sucesso total — propaga erro específico.
        const cepDigits = cep.replace(/\D/g, "");
        if (cepDigits) {
          try {
            await putResidenceAddress({
              cep: cepDigits,
              address: sanitizedAddress,
              address_number: addressNumber.trim(),
              complement: sanitizedComplement,
              neighborhood: sanitizedNeighborhood,
              city: sanitizedCity,
              state: sanitizedState,
            });
            console.log("[Profile] Endereço gravado no Location Core (/profile/residence-address)");
          } catch (addrErr) {
            throw new Error(
              `Erro ao salvar endereço: ${addrErr instanceof Error ? addrErr.message : "Erro desconhecido"}`,
            );
          }
        }

        // Sincronizar actors: refresh após salvar perfil (se fullName foi atualizado)
        if (sanitizedFullName && sanitizedFullName.trim() !== '') {
          try {
            await refreshActors();
            console.log("[Profile] Actors atualizados após salvar perfil");
          } catch (actorErr) {
            // Log erro mas não falha o salvamento do perfil
            console.warn("[Profile] Erro ao atualizar actors (não crítico):", actorErr);
          }
        }
      } catch (profileErr) {
        console.error("[Profile] Erro ao atualizar perfil local:", profileErr);
        throw new Error(
          `Erro ao salvar perfil: ${profileErr instanceof Error ? profileErr.message : "Erro desconhecido"}`,
        );
      }

      // 🔧 FIX (first personal save locks identity fields): Backend seta personal_data_locked automaticamente após primeiro salvamento
      // Não precisa chamar completeOnboarding - o backend já bloqueia os campos após salvar
      
      // Atualizar flags de imutabilidade apenas para controle local
      if (sanitizedFullName && sanitizedFullName.trim().length > 0) {
        setHasFullName(true);
      }
      if (normalizedBirthdate) {
        setHasBirthdate(true);
      }
      if (gender) {
        setHasGender(true);
      }

      // 🔧 FIX (first personal save locks identity fields): Recarregar perfil para garantir sincronização com backend
      // O backend retornará metadata.personal_data_locked que controla o cadeado
      console.log("[Profile] Recarregando perfil para sincronizar com backend...");
      await loadData();
      await loadProgress(); // 🔧 FIX: sincroniza barra de progresso após salvar

      // Limpar erros e mostrar sucesso (só se completeOnboarding teve sucesso)
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

  /**
   * 🔴 CORREÇÃO PRIMEIRO ACESSO: Handler para confirmar primeiro acesso
   * Chamado quando o usuário clica em "Entendi, continuar" no modal
   *
   * REGRA DE OURO: Este handler FAZ APENAS:
   * 1. Chama POST /profile/confirm-first-access
   * 2. Fecha o modal de imediato após sucesso (UI otimista)
   * 3. loadData() para alinhar estado ao CORE (profile_personal_confirmed)
   *
   * O QUE ELE NÃO FAZ:
   * - NÃO valida campos obrigatórios (isso é responsabilidade de handleSavePersonal)
   * - NÃO salva perfil (isso é responsabilidade de handleSavePersonal)
   * - NÃO mostra alerts bloqueantes
   * - NÃO impede o usuário de continuar
   */
  const handleConfirmFirstAccess = async () => {
    console.log("[Profile] ✅ Confirmando primeiro acesso (SEM validação frontend)...");

    try {
      console.log("[Profile] Chamando POST /profile/confirm-first-access...");
      await confirmFirstAccess({}); // 🔧 FIX: body explícito (defensivo)

      setShowOnboardingModal(false);

      console.log("[Profile] Recarregando perfil após confirmação...");
      await loadData();

      console.log("[Profile] ✅ Primeiro acesso confirmado com sucesso");
    } catch (err) {
      console.error("[Profile] ⚠️ Erro ao confirmar primeiro acesso:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro ao confirmar primeiro acesso";
      console.warn("[Profile] Confirmação não persistiu; modal permanece até novo sucesso:", errorMessage);
    }
  };

  /**
   * DECISION-0120 D3: confirmação CIVIL EXPLÍCITA (ação separada do aviso visto).
   * Só depois de exibir os campos civis. Grava evento auditável na camada identity
   * (POST /identity/confirm-civil-data) e trava a edição civil daqui em diante.
   */
  const handleConfirmCivilData = async () => {
    if (confirmingCivil || civilDataConfirmed) return;
    setConfirmingCivil(true);
    try {
      const { confirmCivilData } = await import("../api/identity");
      await confirmCivilData();
      await loadData(); // realinha lock/estado à camada identity
    } catch (err) {
      console.error("[Profile] Erro ao confirmar dados civis:", err);
      setError(err instanceof Error ? err.message : "Erro ao confirmar dados civis");
    } finally {
      setConfirmingCivil(false);
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
      {/* 🔴 PARTE 2 - ONBOARDING: Modal de primeiro acesso */}
      <OnboardingModal
        isOpen={showOnboardingModal}
        onConfirm={handleConfirmFirstAccess}
      />
      
      {/* 🔴 PARTE 3 - BARRA DE PROGRESSO: Banner principal */}
      <ProfileProgressBar />
      
      {/* 🔴 UX: Banner secundário incentivando completar cadastro */}
      {(!onboardingCompleted || (profileProgress !== null && profileProgress < 80)) && (
        <div className="onboarding-banner">
          <div className="onboarding-banner-content">
            <div className="onboarding-banner-icon">📋</div>
            <div className="onboarding-banner-text">
              <strong>Complete seu perfil</strong>
              <span>
                {!onboardingCompleted 
                  ? 'Confira seus dados cadastrais para aproveitar todos os recursos do Unificard.'
                  : `Seu perfil está ${profileProgress}% completo. Complete mais informações para desbloquear recursos.`
                }
              </span>
            </div>
          </div>
        </div>
      )}
      
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
          Interesses e Gostos
        </button>
        <button
          className={`tab-button ${activeTab === "learning" ? "active" : ""}`}
          onClick={() => setActiveTab("learning")}
        >
          Aprendizado
        </button>
        <button
          className={`tab-button ${activeTab === "health" ? "active" : ""}`}
          onClick={() => setActiveTab("health")}
        >
          Saúde
        </button>
        <button
          className={`tab-button ${activeTab === "agenda" ? "active" : ""}`}
          onClick={() => setActiveTab("agenda")}
        >
          Agenda
        </button>
        <button
          className={`tab-button ${activeTab === "education" ? "active" : ""}`}
          onClick={() => setActiveTab("education")}
        >
          Educação
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
          <ProfilePersonalForm
            error={error}
            hasFullName={hasFullName}
            lockIdentityCore={lockIdentityCore}
            lockCpfField={hasCpf && lockIdentityCore}
            lockBirthField={lockIdentityCore && hasBirthdate}
            lockGenderField={lockIdentityCore && hasGender}
            fullName={fullName}
            setFullName={setFullName}
            fullNameError={fullNameError}
            setFullNameError={setFullNameError}
            cpf={cpf}
            handleCpfChange={handleCpfChange}
            cpfError={cpfError}
            cpfValidating={cpfValidating}
            birthdate={birthdate}
            setBirthdate={setBirthdate}
            birthdateError={birthdateError}
            setBirthdateError={setBirthdateError}
            userAge={userAge}
            setUserAge={setUserAge}
            gender={gender}
            setGender={setGender}
            genderError={genderError}
            setGenderError={setGenderError}
            countryCode={countryCode}
            setCountryCode={setCountryCode}
            areaCode={areaCode}
            setAreaCode={setAreaCode}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            phoneError={phoneError}
            setPhoneError={setPhoneError}
            cep={cep}
            handleCepChange={handleCepChange}
            handleCepBlur={handleCepBlur}
            cepError={cepError}
            cepLoading={cepLoading}
            address={address}
            setAddressTracked={setAddressTracked}
            addressError={addressError}
            setAddressError={setAddressError}
            addressNumber={addressNumber}
            setAddressNumberTracked={setAddressNumberTracked}
            addressNumberError={addressNumberError}
            setAddressNumberError={setAddressNumberError}
            complement={complement}
            setComplementTracked={setComplementTracked}
            neighborhood={neighborhood}
            setNeighborhoodTracked={setNeighborhoodTracked}
            neighborhoodError={neighborhoodError}
            setNeighborhoodError={setNeighborhoodError}
            city={city}
            setCityTracked={setCityTracked}
            cityError={cityError}
            setCityError={setCityError}
            state={state}
            setStateTracked={setStateTracked}
            stateError={stateError}
            setStateError={setStateError}
            referralCode={referralCode}
            handleSavePersonal={handleSavePersonal}
            isSaving={isSaving}
          />
        )}

        {/* DECISION-0120 D3: confirmação CIVIL EXPLÍCITA — ação separada do aviso visto,
            só depois de exibir os campos civis e quando ainda não confirmados. */}
        {activeTab === "personal" && !civilDataConfirmed && hasFullName && hasCpf && hasBirthdate && (
          <div className="profile-form profile-civil-confirm" style={{ marginTop: "1rem" }}>
            <p>
              Confira seus dados civis acima (nome, CPF, nascimento e sexo). Ao confirmar, eles
              ficam protegidos contra edição. Esta ação é separada do aviso de primeiro acesso.
            </p>
            <button type="button" onClick={handleConfirmCivilData} disabled={confirmingCivil}>
              {confirmingCivil ? "Confirmando…" : "Confirmo que meus dados civis estão corretos"}
            </button>
          </div>
        )}

        {activeTab === "professional" && <ProfileProfessional />}

        {activeTab === "physical" && <ProfilePhysical />}

        {activeTab === "learning" && <ProfileLearning />}

        {activeTab === "health" && (
          <div className="profile-form">
            <h2>Saúde</h2>
            <p className="section-description">
              <strong>Autodeclaração de condições de saúde</strong> — estas informações são
              voluntárias e servem apenas para personalizar sua experiência.
              <em> Nunca serão usadas para diagnóstico, bloqueio ou alteração de preços.</em>
            </p>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem', fontStyle: 'italic' }}>
              Seus dados de saúde são protegidos pela LGPD (Art. 11 - Dados Sensíveis).
            </p>
            <ProfileHealth />
          </div>
        )}

        {activeTab === "agenda" && (
          <div className="profile-form">
            <ProfileAgenda />
          </div>
        )}

        {activeTab === "education" && <ProfileEducation />}

        {activeTab === "legal" && (
          <div className="profile-form">
            <CompaniesManager />
          </div>
        )}
      </main>
    </div>
  );
}
