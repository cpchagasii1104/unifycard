// src/components/Register.tsx
// Tela de registro - Coleta CPF (obrigatório) e, se a pessoa quiser, nome/nascimento/gênero
// já de cara. Todos IMUTÁVEIS a partir de quando forem preenchidos.
//
// 🔴 CORRIGIDO 2026-08-04 — só CPF é exigido AQUI (guaranteed birth chain, DECISION-0115 D2;
// `auth.service.ts` recusa 400 sem ele). Nome/nascimento/gênero são "perfil complementar" na
// mesma decisão — PROGRESSIVOS por desenho, não requisito do nascimento — e o contrato HTTP
// (`registerSchema`, `auth.routes.ts`) já os marcava `.optional()`; só esta tela é que os
// tornava `required` na UI, sem necessidade. Continuam IMUTÁVEIS quando preenchidos (aqui ou
// depois em /perfil — mesmo lock em `profile.service.ts`, `personal_data_locked`).

import { useState, useEffect, useRef } from 'react';
import { register, checkCpfExists, validateReferralCode } from '../api/auth';
import { setAuthToken, setTenantId } from '../config/auth';
import { decodeJwtPayload } from '../utils/jwt';
import { maskCPF, validateCPF } from '../utils/cpf';
import { validateFullName, validateBirthdate } from '../utils/validation';
import { normalizeFullName } from '../utils/nameNormalizer';
import { isGender, type Gender } from '@unificard/contracts';
import InfoTooltip from './ui/InfoTooltip';
import './Register.css';

interface RegisterProps {
  /**
   * Sucesso de cadastro. A DECISÃO de rota pós-cadastro fica no chamador
   * (AuthWrapper), que detém o `navigate` SPA — sem verdade paralela aqui.
   * `requiresOnboarding` direciona /perfil vs /home (F-REGISTER-PRELAUNCH A2).
   */
  onRegisterSuccess: (opts?: { requiresOnboarding?: boolean }) => void;
  onBackToLogin: () => void;
  onBackToHome?: () => void;
}

export default function Register({ onRegisterSuccess, onBackToLogin, onBackToHome }: RegisterProps) {
  // Dados de autenticação
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  
  // 🔧 FIX (referral realtime validation): Estados para validação em tempo real
  const [referralStatus, setReferralStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const referralDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🔴 DADOS CIVIS IMUTÁVEIS (coletados apenas no cadastro)
  const [fullName, setFullName] = useState('');
  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [cpf, setCpf] = useState('');
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfValidating, setCpfValidating] = useState(false);
  const [cpfExists, setCpfExists] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [birthdate, setBirthdate] = useState('');
  const [birthdateError, setBirthdateError] = useState<string | null>(null);
  const [userAge, setUserAge] = useState<number | undefined>(undefined);
  const [gender, setGender] = useState<Gender | ''>('');
  const [genderError, setGenderError] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔒 VERIFICAÇÃO ANTECIPADA DE CPF DUPLICADO
  useEffect(() => {
    // Limpar timer anterior se existir
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const cpfNumbers = cpf.replace(/\D/g, '');
    
    // Se CPF não tem 11 dígitos ou é inválido, não verificar
    if (cpfNumbers.length !== 11 || !validateCPF(cpf)) {
      setCpfExists(false);
      setCpfValidating(false);
      return;
    }

    // Debounce de 500ms antes de verificar
    setCpfValidating(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const exists = await checkCpfExists(cpf);
        setCpfExists(exists);
        
        if (exists) {
          setCpfError('Este CPF já possui cadastro no Unificard.');
        } else {
          setCpfError(null);
        }
      } catch (err) {
        // Em caso de erro, não bloquear (assumir que não existe)
        console.warn('[Register] Erro ao verificar CPF:', err);
        setCpfExists(false);
        setCpfError(null);
      } finally {
        setCpfValidating(false);
      }
    }, 500);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [cpf]);

  // 🔧 FIX (referral realtime validation): Validação em tempo real do código de indicação
  useEffect(() => {
    // Limpar timer anterior se existir
    if (referralDebounceTimerRef.current) {
      clearTimeout(referralDebounceTimerRef.current);
    }

    const trimmedCode = referralCode.trim();
    
    // Se código estiver vazio, resetar para idle
    if (!trimmedCode) {
      setReferralStatus('idle');
      return;
    }

    // Debounce de 400ms antes de validar
    setReferralStatus('checking');
    
    referralDebounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await validateReferralCode(trimmedCode);
        // Só a resposta de validação (200 valid:false ou 400 formato) confirma inválido.
        setReferralStatus(result.valid ? 'valid' : 'invalid');
      } catch (err) {
        // F-REGISTER-PRELAUNCH-BLOCKERS A1: erro TÉCNICO pré-sessão (rede/429/500)
        // NÃO é "código inválido" confirmado → volta a 'idle' (indeterminado), para
        // não bloquear o submit. O register server-side é a fonte de verdade final.
        console.warn('[Register] Validação de referral indeterminada (erro técnico):', err);
        setReferralStatus('idle');
      }
    }, 400);

    // Cleanup
    return () => {
      if (referralDebounceTimerRef.current) {
        clearTimeout(referralDebounceTimerRef.current);
      }
    };
  }, [referralCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    // Limpar erros anteriores
    setFullNameError(null);
    setCpfError(null);
    setBirthdateError(null);
    setGenderError(null);

    // 🔧 FIX (block submit on invalid referral): Bloquear submit se código de indicação for inválido
    const trimmedReferralCode = referralCode.trim();
    if (trimmedReferralCode) {
      // Se código foi preenchido, validar status
      if (referralStatus === 'checking') {
        // Aguardar validação terminar
        setIsLoading(false);
        return;
      }
      if (referralStatus === 'invalid') {
        // Bloquear submit se código é inválido
        setError('Código de indicação inválido');
        setIsLoading(false);
        return;
      }
    }
    // Se referralCode estiver vazio ou status for 'valid' ou 'idle', continuar normalmente

    // Validações de autenticação
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    // 🔴 VALIDAÇÕES DE DADOS CIVIS — CPF é o único obrigatório (ver comentário no topo do
    // arquivo). Nome/nascimento/gênero: só valida FORMATO se a pessoa preencheu; vazio passa.

    // Validar Nome Completo (progressivo — só valida se preenchido)
    if (fullName.trim().length > 0) {
      const nameValidation = validateFullName(fullName);
      if (!nameValidation.valid) {
        setFullNameError(nameValidation.error || 'Nome inválido');
        setIsLoading(false);
        return;
      }
    }

    // Validar CPF
    const cpfNumbers = cpf.replace(/\D/g, '');
    if (cpfNumbers.length !== 11) {
      setCpfError('CPF deve ter 11 dígitos');
      setIsLoading(false);
      return;
    }
    if (!validateCPF(cpf)) {
      setCpfError('CPF inválido');
      setIsLoading(false);
      return;
    }

    // Validar Data de Nascimento (progressivo — só valida se preenchida)
    if (birthdate) {
      const birthValidation = validateBirthdate(birthdate);
      if (!birthValidation.valid) {
        setBirthdateError(birthValidation.error || 'Data inválida');
        setIsLoading(false);
        return;
      }
      setUserAge(birthValidation.age);
    }

    // Validar gênero (vocabulário canónico; progressivo — só valida se selecionado)
    if (gender && !isGender(gender)) {
      setGenderError('Gênero inválido');
      setIsLoading(false);
      return;
    }

    try {
      // 🔴 ENVIAR TODOS OS DADOS CIVIS IMUTÁVEIS NO CADASTRO
      // Nota: A API atual pode não aceitar todos os campos ainda
      // Em produção, ajustar conforme contrato do backend
      // 🔴 CRÍTICO: Normalizar birthdate para ISO (YYYY-MM-DD) antes de enviar
      const { parseBirthdateToISO } = await import('../utils/dateNormalizer');
      const isoBirthdate = parseBirthdateToISO(birthdate);
      
      if (!isoBirthdate && birthdate) {
        setBirthdateError('Formato de data inválido. Use DD/MM/YYYY ou YYYY-MM-DD (ex: 03/09/1953 ou 1953-09-03)');
        setIsLoading(false);
        return;
      }
      
      const result = await register(
        email,
        password,
        cpfNumbers,
        referralCode.trim() || undefined,
        fullName.trim() || undefined,
        isoBirthdate || undefined,
        gender || undefined
      );
      
      if (result.success && result.data.tokens.accessToken) {
        setAuthToken(result.data.tokens.accessToken);
        // CRÍTICO: TenantId DEVE vir SEMPRE do JWT (fonte única de verdade)
        let tenantIdToSave: string | null = null;
        try {
          const tokenPayload = decodeJwtPayload(result.data.tokens.accessToken);
          tenantIdToSave = tokenPayload.tenantId;
        } catch (e) {
          console.error('[Register] Falha ao extrair tenantId do JWT:', e);
        }
        
        if (tenantIdToSave) {
          setTenantId(tenantIdToSave);
          console.log('[Register] TenantId extraído do JWT e salvo:', tenantIdToSave);
        } else {
          console.error('[Register] ERRO CRÍTICO: Nenhum tenantId disponível no JWT!');
        }
        
        // 🔴 PARTE 2 - ONBOARDING: Verificar se precisa de onboarding
        const requiresOnboarding = result.data.requiresOnboarding === true;

        // Disparar evento para SessionProvider re-bootstrap (hidratação de sessão).
        window.dispatchEvent(new CustomEvent('auth-changed'));

        // F-REGISTER-PRELAUNCH-BLOCKERS A2: navegação SPA (sem window.location.href,
        // que faria reload total e destruiria o bootstrap recém-agendado por
        // auth-changed). A rota (/perfil quando requiresOnboarding, senão /home) é
        // decidida pelo chamador que detém o navigate.
        onRegisterSuccess({ requiresOnboarding });
      } else {
        setError('Registro falhou');
      }
    } catch (err) {
      // 🔒 TRATAR ERRO 409 (CPF DUPLICADO) ESPECIFICAMENTE
      // SPRINT 14: Tratar erro 403 (piloto fechado) com mensagem neutra
      if (err instanceof Error) {
        const statusCode = (err as any).statusCode;
        
        // Se for erro 403 (piloto fechado)
        if (statusCode === 403 && err.message.includes('piloto fechado')) {
          setError('O sistema está em fase de piloto fechado.');
          return;
        }
        
        // Se for erro 409 (CPF duplicado) ou mensagem relacionada a CPF
        if (statusCode === 409 || (err.message.includes('CPF') && (err.message.includes('uso') || err.message.includes('cadastrado')))) {
          setCpfError('Este CPF já possui cadastro no Unificard.');
          // Não mostrar erro genérico no rodapé
          setError(null);
        } else {
          // Outros erros podem ser mostrados no rodapé
          setError(err.message);
        }
      } else {
        setError('Erro ao registrar');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 🔒 CALCULAR SE BOTÃO DEVE SER DESABILITADO
  const isSubmitDisabled = 
    isLoading || 
    cpfExists || 
    cpfValidating ||
    !cpf ||
    cpf.replace(/\D/g, '').length !== 11 ||
    !validateCPF(cpf) ||
    !!cpfError;

  return (
    <div className="register-container">
      <div className="register-box">
        <h1>Unificard</h1>
        <p className="register-subtitle">Crie sua conta</p>
        
        <form onSubmit={handleSubmit} className="register-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>

          {/* 🔴 DADOS CIVIS — CPF é imutável e obrigatório aqui; nome/nascimento/gênero são
              progressivos (podem ser preenchidos agora ou depois em /perfil) e ficam imutáveis
              a partir de QUANDO forem preenchidos, não necessariamente no cadastro. */}
          <div className="form-group">
            <label htmlFor="fullName" className="register-label">
              <span className="register-label-inline">
                Nome Completo <span className="register-optional">(opcional)</span>
                <span className="info-trigger">
                  <InfoTooltip
                    content="Se preenchido, não poderá ser alterado depois. Pode deixar em branco agora e completar no seu perfil."
                    position="top"
                  />
                </span>
              </span>
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => {
                let value = e.target.value.replace(/[<>]/g, '');
                if (value.length > 100) value = value.slice(0, 100);
                setFullName(value);
                setFullNameError(null);
              }}
              onBlur={() => {
                if (fullName) {
                  const trimmed = fullName.trim();
                  // 🔴 PADRONIZAÇÃO: Normalizar nome ao sair do campo
                  const normalized = normalizeFullName(trimmed);
                  if (normalized !== fullName) {
                    setFullName(normalized);
                  }
                  const validation = validateFullName(normalized);
                  if (!validation.valid) {
                    setFullNameError(validation.error || null);
                  }
                }
              }}
              placeholder="Digite seu nome completo (opcional)"
              className={fullNameError ? "error" : ""}
            />
            {fullNameError && <span className="field-error">{fullNameError}</span>}
            {!fullNameError && fullName && (
              <span className="field-success">✓</span>
            )}
            <small style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
              {fullName ? 'Preenchido: não poderá ser alterado após o cadastro' : 'Pode ser preenchido agora ou depois, no seu perfil'}
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="cpf" className="register-label">
              <span className="register-label-inline">
                CPF <span className="required">*</span>
                <span className="info-trigger">
                  <InfoTooltip
                    content="Este dado não poderá ser alterado após o cadastro."
                    position="top"
                  />
                </span>
              </span>
            </label>
            <input
              id="cpf"
              type="text"
              value={cpf}
              onChange={(e) => {
                const masked = maskCPF(e.target.value);
                setCpf(masked);
                // Limpar erro de duplicado ao digitar (mas manter validação local)
                if (cpfExists) {
                  setCpfExists(false);
                }
                // Limpar erro apenas se não for erro de formato
                const cpfNumbers = masked.replace(/\D/g, '');
                if (cpfNumbers.length === 11 && validateCPF(masked)) {
                  setCpfError(null);
                }
              }}
              onBlur={() => {
                if (cpf) {
                  const cpfNumbers = cpf.replace(/\D/g, '');
                  if (cpfNumbers.length !== 11) {
                    setCpfError('CPF deve ter 11 dígitos');
                  } else if (!validateCPF(cpf)) {
                    setCpfError('CPF inválido');
                  }
                  // Se CPF é válido e não existe, limpar erro
                  else if (!cpfExists) {
                    setCpfError(null);
                  }
                }
              }}
              required
              placeholder="000.000.000-00"
              maxLength={14}
              className={cpfError ? "error" : ""}
              disabled={isLoading}
            />
            {cpfValidating && (
              <span className="field-validating" style={{ fontSize: '0.875rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                Verificando...
              </span>
            )}
            {cpfError && <span className="field-error">{cpfError}</span>}
            {!cpfError && !cpfValidating && cpf.replace(/\D/g, '').length === 11 && validateCPF(cpf) && !cpfExists && (
              <span className="field-success">✓</span>
            )}
            {cpfExists && (
              <small style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                Você poderá recuperar sua conta após confirmar seus dados.
              </small>
            )}
            {!cpfExists && (
              <small style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                Este dado não poderá ser alterado após o cadastro
              </small>
            )}
          </div>

          <div className="register-form-row">
            <div className="form-group">
              <label htmlFor="birthdate" className="register-label">
                <span className="register-label-inline">
                  Data de Nascimento <span className="register-optional">(opcional)</span>
                  <span className="info-trigger">
                    <InfoTooltip
                      content="Se preenchida, não poderá ser alterada depois. Pode deixar em branco agora e completar no seu perfil."
                      position="top"
                    />
                  </span>
                </span>
              </label>
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
                className={birthdateError ? "error" : ""}
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 16)).toISOString().split('T')[0]}
              />
              {birthdateError && <span className="field-error">{birthdateError}</span>}
              {!birthdateError && birthdate && userAge !== undefined && (
                <span className="field-success">✓ {userAge} anos</span>
              )}
              <small style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                {birthdate ? 'Preenchida: não poderá ser alterada após o cadastro' : 'Pode ser preenchida agora ou depois, no seu perfil'}
              </small>
            </div>

            <div className="form-group">
              <label htmlFor="gender" className="register-label">
                <span className="register-label-inline">
                  Gênero <span className="register-optional">(opcional)</span>
                  <span className="info-trigger">
                    <InfoTooltip
                      content="Se selecionado, não poderá ser alterado depois. Pode deixar em branco agora e completar no seu perfil."
                      position="top"
                    />
                  </span>
                </span>
              </label>
              <select
                id="gender"
                value={gender}
                onChange={(e) => {
                  const v = e.target.value;
                  setGender(v === '' ? '' : (v as Gender));
                  setGenderError(null);
                }}
                className={genderError ? "error" : ""}
              >
                <option value="">Selecione (opcional)</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
                <option value="non_binary">Não-binário</option>
                <option value="other">Outro</option>
                <option value="prefer_not_to_say">Prefiro não informar</option>
              </select>
              {genderError && <span className="field-error">{genderError}</span>}
              {!genderError && gender && (
                <span className="field-success">✓</span>
              )}
              <small style={{ fontSize: '0.8125rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
                {gender ? 'Preenchido: não poderá ser alterado após o cadastro' : 'Pode ser preenchido agora ou depois, no seu perfil'}
              </small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Mínimo 6 caracteres"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirmar Senha</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Digite a senha novamente"
              minLength={6}
            />
          </div>

          <div className="form-group">
            <label htmlFor="referralCode">Código de Indicação (opcional)</label>
            <input
              id="referralCode"
              type="text"
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
              placeholder="Digite o código de indicação"
              maxLength={20}
            />
            {/* 🔧 FIX (api consolidation): Feedback visual de validação - texto derivado de status */}
            {referralStatus === 'checking' && (
              <small style={{ fontSize: '0.85em', color: '#6b7280', display: 'block', marginTop: '4px' }}>
                Verificando código...
              </small>
            )}
            {referralStatus === 'valid' && (
              <small style={{ fontSize: '0.85em', color: '#10b981', display: 'block', marginTop: '4px' }}>
                ✓ Código válido
              </small>
            )}
            {referralStatus === 'invalid' && (
              <small style={{ fontSize: '0.85em', color: '#ef4444', display: 'block', marginTop: '4px' }}>
                Código de indicação inválido
              </small>
            )}
            {referralStatus === 'idle' && (
              <small style={{ fontSize: '0.85em', color: '#666', display: 'block', marginTop: '4px' }}>
                Se você foi indicado por alguém, digite o código aqui
              </small>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isSubmitDisabled} className="register-button">
            {isLoading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <button
            type="button"
            onClick={onBackToLogin}
            className="back-to-login-button"
          >
            Voltar para login
          </button>

          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="back-to-login-button"
            >
              ← Voltar para início
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

