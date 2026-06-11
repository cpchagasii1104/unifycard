import { useSession } from "../contexts/SessionProvider";
import NotApplicableMessage from "./NotApplicableMessage";
import { maskCPF } from "../utils/cpf";
import {
  COUNTRY_CODES,
  BRAZIL_AREA_CODES,
  isCellPhone,
} from "../utils/phone";
import {
  sanitizeString,
  validateFullName,
  validateBirthdate,
  validateBrazilianPhone,
} from "../utils/validation";
import { normalizeFullName } from "../utils/nameNormalizer";
import { formatISOToBR } from "../utils/dateNormalizer";
import LockedField from "./ui/LockedField";
import { type Gender } from "@unificard/contracts";

// Vocabulário soberano de 5 valores (GO C1 2026-06-11) — mesmos rótulos do Register.
const GENDER_LABELS: Record<Gender, string> = {
  male: "Masculino",
  female: "Feminino",
  non_binary: "Não-binário",
  other: "Outro",
  prefer_not_to_say: "Prefiro não informar",
};

interface ProfilePersonalFormProps {
  error: string | null;
  /** Nome já persistido no perfil → campo somente leitura */
  hasFullName: boolean;
  /** CPF+nascimento confirmados no backend (não exige sexo para o trio) */
  lockIdentityCore: boolean;
  /** CPF: cadeado só com CPF válido + lockIdentityCore */
  lockCpfField: boolean;
  /** Nascimento: não mostrar cadeado em campo vazio */
  lockBirthField: boolean;
  /** Sexo: cadeado só se sexo já foi informado (evita “Não informado” + cadeado) */
  lockGenderField: boolean;
  fullName: string;
  setFullName: (value: string) => void;
  fullNameError: string | null;
  setFullNameError: (error: string | null) => void;
  cpf: string;
  handleCpfChange: (value: string) => void;
  cpfError: string | null;
  cpfValidating: boolean;
  birthdate: string;
  setBirthdate: (value: string) => void;
  birthdateError: string | null;
  setBirthdateError: (error: string | null) => void;
  userAge: number | undefined;
  setUserAge: (age: number | undefined) => void;
  gender: Gender | "";
  setGender: (value: Gender) => void;
  genderError: string | null;
  setGenderError: (error: string | null) => void;
  countryCode: string;
  setCountryCode: (value: string) => void;
  areaCode: string;
  setAreaCode: (value: string) => void;
  phoneNumber: string;
  setPhoneNumber: (value: string) => void;
  phoneError: string | null;
  setPhoneError: (error: string | null) => void;
  cep: string;
  handleCepChange: (value: string) => void;
  handleCepBlur: () => void;
  cepError: string | null;
  cepLoading: boolean;
  address: string;
  setAddressTracked: (value: string) => void;
  addressError: string | null;
  setAddressError: (error: string | null) => void;
  addressNumber: string;
  setAddressNumberTracked: (value: string) => void;
  addressNumberError: string | null;
  setAddressNumberError: (error: string | null) => void;
  complement: string;
  setComplementTracked: (value: string) => void;
  neighborhood: string;
  setNeighborhoodTracked: (value: string) => void;
  neighborhoodError: string | null;
  setNeighborhoodError: (error: string | null) => void;
  city: string;
  setCityTracked: (value: string) => void;
  cityError: string | null;
  setCityError: (error: string | null) => void;
  state: string;
  setStateTracked: (value: string) => void;
  stateError: string | null;
  setStateError: (error: string | null) => void;
  referralCode: string | null;
  handleSavePersonal: () => void;
  isSaving: boolean;
}

export default function ProfilePersonalForm({
  error,
  hasFullName,
  lockIdentityCore,
  lockCpfField,
  lockBirthField,
  lockGenderField,
  fullName,
  setFullName,
  fullNameError,
  setFullNameError,
  cpf,
  handleCpfChange,
  cpfError,
  cpfValidating,
  birthdate,
  setBirthdate,
  birthdateError,
  setBirthdateError,
  userAge,
  setUserAge,
  gender,
  setGender,
  genderError,
  setGenderError,
  countryCode,
  setCountryCode,
  areaCode,
  setAreaCode,
  phoneNumber,
  setPhoneNumber,
  phoneError,
  setPhoneError,
  cep,
  handleCepChange,
  handleCepBlur,
  cepError,
  cepLoading,
  address,
  setAddressTracked,
  addressError,
  setAddressError,
  addressNumber,
  setAddressNumberTracked,
  addressNumberError,
  setAddressNumberError,
  complement,
  setComplementTracked,
  neighborhood,
  setNeighborhoodTracked,
  neighborhoodError,
  setNeighborhoodError,
  city,
  setCityTracked,
  cityError,
  setCityError,
  state,
  setStateTracked,
  stateError,
  setStateError,
  referralCode,
  handleSavePersonal,
  isSaving,
}: ProfilePersonalFormProps) {
  const { activeActor } = useSession();

  // FIX 2.c — defesa em profundidade (DECISION-0043 pendente, princípios 4 e 5)
  if (activeActor && activeActor.actor_type !== 'user') {
    return <NotApplicableMessage actor={activeActor} tab="pessoal" />;
  }

  return (
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

      {hasFullName ? (
        <LockedField
          value={fullName}
          label="Nome Completo"
          tooltipMessage="Este dado é protegido. Para corrigir, entre em contato com o administrador."
        />
      ) : (
        <div className="form-group">
          <label htmlFor="fullName">Nome Completo *</label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => {
              let value = e.target.value.replace(/[<>]/g, "");
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
            placeholder="Digite seu nome completo"
            required
            className={fullNameError ? "error" : ""}
          />
          {fullNameError && <span className="field-error">{fullNameError}</span>}
          {!fullNameError && fullName && (
            <span className="field-success">✓</span>
          )}
        </div>
      )}

      <div className="form-row">
        {lockCpfField ? (
          <LockedField
            value={cpf.replace(/\D/g, '')} // Garantir que seja apenas números para formatação
            label="CPF"
            formatValue={(val) => {
              if (!val) return "Não informado";
              return maskCPF(val);
            }}
            tooltipMessage="Este dado é protegido. Para corrigir, entre em contato com o administrador."
          />
        ) : (
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
            {cpfValidating && <span className="validating">Validando...</span>}
            {cpfError && <span className="field-error">{cpfError}</span>}
          </div>
        )}

        {lockBirthField ? (
          <LockedField
            value={birthdate}
            label="Data de Nascimento"
            formatValue={(val) => {
              if (!val) return "Não informado";
              // Formatar ISO para BR se necessário
              const formatted = formatISOToBR(val) || val;
              const age = userAge !== undefined ? ` (${userAge} anos)` : "";
              return formatted + age;
            }}
            tooltipMessage="Este dado é protegido. Para corrigir, entre em contato com o administrador."
          />
        ) : (
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
            {birthdateError && <span className="field-error">{birthdateError}</span>}
            {!birthdateError && birthdate && userAge !== undefined && (
              <span className="field-success">✓ Idade: {userAge} anos</span>
            )}
          </div>
        )}

        {lockGenderField ? (
          <LockedField
            value={gender}
            label="Sexo"
            formatValue={(val) => GENDER_LABELS[val as Gender] ?? "Não informado"}
            tooltipMessage="Este dado é protegido. Para corrigir, entre em contato com o administrador."
          />
        ) : (
          <div className="form-group">
            <label htmlFor="gender">Sexo *</label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => {
                setGender(e.target.value as Gender);
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
              {(Object.keys(GENDER_LABELS) as Gender[]).map((g) => (
                <option key={g} value={g}>{GENDER_LABELS[g]}</option>
              ))}
            </select>
            {genderError && <span className="field-error">{genderError}</span>}
            {!genderError && gender && (
              <span className="field-success">✓</span>
            )}
          </div>
        )}
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

      {/* Código de Indicação */}
      {referralCode && (
        <div className="form-group" style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "1px solid #e5e7eb" }}>
          <label htmlFor="referralCode">Seu Código de Indicação</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <code
              id="referralCode"
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "0.375rem",
                fontFamily: "monospace",
                fontSize: "1rem",
                fontWeight: "600",
                letterSpacing: "0.05em",
              }}
            >
              {referralCode}
            </code>
            <button
              type="button"
              onClick={() => {
                if (referralCode) {
                  navigator.clipboard.writeText(referralCode);
                  alert("Código copiado!");
                }
              }}
              style={{
                padding: "0.75rem 1rem",
                background: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Copiar
            </button>
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#6b7280" }}>
            Compartilhe este código com seus amigos para ganhar benefícios!
          </p>
        </div>
      )}

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
  );
}



