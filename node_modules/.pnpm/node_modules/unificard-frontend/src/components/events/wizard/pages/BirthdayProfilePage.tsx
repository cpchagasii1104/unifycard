// frontend/src/components/events/wizard/pages/BirthdayProfilePage.tsx
// FASE 5 — PÁGINA: Perfil do Aniversário
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayProfilePageProps {
  eventSpec: {
    answers?: {
      birthday_profile?: "INFANTIL" | "JOVEM" | "ADULTO" | "TERCEIRA_IDADE" | "NEUTRO";
      birthday_person?: {
        name?: string;
        birth_date?: string;
        gender?: "MASCULINO" | "FEMININO" | "NAO_INFORMADO";
      };
    };
  };
  onChange: (partialSpec: {
    birthday_profile?: "INFANTIL" | "JOVEM" | "ADULTO" | "TERCEIRA_IDADE" | "NEUTRO";
    birthday_person?: {
      name?: string;
      birth_date?: string;
      gender?: "MASCULINO" | "FEMININO" | "NAO_INFORMADO";
    };
  }) => void;
}

/**
 * BirthdayProfilePage
 * 
 * Objetivo: Coletar o perfil geral do aniversário e dados contextuais do aniversariante
 * Campos EventSpec permitidos:
 * - birthday_profile
 * - birthday_person.name
 * - birthday_person.birth_date
 * - birthday_person.gender
 * 
 * Observações:
 * - Dados puramente contextuais
 * - Nunca decisórios
 * - Controlam apenas visibilidade de páginas subsequentes (via Registry, não via lógica)
 */
export default function BirthdayProfilePage({ eventSpec, onChange }: BirthdayProfilePageProps) {
  const [birthdayProfile, setBirthdayProfile] = useState<"INFANTIL" | "JOVEM" | "ADULTO" | "TERCEIRA_IDADE" | "NEUTRO" | undefined>(
    eventSpec.answers?.birthday_profile
  );
  const [isBirthdayPersonYou, setIsBirthdayPersonYou] = useState<boolean | undefined>(undefined); // UX only, não persiste
  const [birthdayPerson, setBirthdayPerson] = useState<{
    name?: string;
    birth_date?: string;
    gender?: "MASCULINO" | "FEMININO" | "NAO_INFORMADO";
  }>(eventSpec.answers?.birthday_person || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    const partialSpec: any = {};
    if (birthdayProfile) {
      partialSpec.birthday_profile = birthdayProfile;
    }
    if (birthdayPerson.name || birthdayPerson.birth_date || birthdayPerson.gender) {
      partialSpec.birthday_person = birthdayPerson;
    }
    if (Object.keys(partialSpec).length > 0) {
      onChange(partialSpec);
    }
  }, [birthdayProfile, birthdayPerson, onChange]);

  return (
    <div className="wizard-page">
      <h3>Perfil do Aniversário</h3>
      <p className="step-description">
        Qual a faixa etária do aniversário? Esta informação controla quais perguntas aparecem depois.
      </p>

      <div className="form-group">
        <label className="form-label">
          Faixa etária do aniversário <span className="required">*</span>
        </label>
        <div className="option-grid">
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'INFANTIL' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('INFANTIL')}
          >
            <div className="option-label">Infantil</div>
            <div className="option-description">0–12 anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'JOVEM' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('JOVEM')}
          >
            <div className="option-label">Jovem / 15 Anos</div>
            <div className="option-description">15 anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'ADULTO' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('ADULTO')}
          >
            <div className="option-label">Adulto</div>
            <div className="option-description">18–59 anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'TERCEIRA_IDADE' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('TERCEIRA_IDADE')}
          >
            <div className="option-label">Terceira Idade</div>
            <div className="option-description">60+ anos</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayProfile === 'NEUTRO' ? 'selected' : ''}`}
            onClick={() => setBirthdayProfile('NEUTRO')}
          >
            <div className="option-label">Neutro</div>
            <div className="option-description">Prefiro não definir agora</div>
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          O aniversariante é você? <span className="optional">(opcional)</span>
        </label>
        <div className="yes-no-buttons">
          <button
            type="button"
            className={`yes-no-button ${isBirthdayPersonYou === true ? 'selected' : ''}`}
            onClick={() => setIsBirthdayPersonYou(true)}
          >
            Sim
          </button>
          <button
            type="button"
            className={`yes-no-button ${isBirthdayPersonYou === false ? 'selected' : ''}`}
            onClick={() => setIsBirthdayPersonYou(false)}
          >
            Não
          </button>
        </div>
        <p className="field-hint">
          Esta informação é contextual de UX e não é persistida no EventSpec.
        </p>
      </div>

      <div className="form-group">
        <label htmlFor="birthday_person_name" className="form-label">
          Nome do aniversariante <span className="optional">(opcional)</span>
        </label>
        <input
          id="birthday_person_name"
          type="text"
          value={birthdayPerson.name || ''}
          onChange={(e) => setBirthdayPerson(prev => ({
            ...prev,
            name: e.target.value || undefined,
          }))}
          placeholder="Ex: João"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="birth_date" className="form-label">
          Data de nascimento <span className="optional">(opcional)</span>
        </label>
        <input
          id="birth_date"
          type="date"
          value={birthdayPerson.birth_date || ''}
          onChange={(e) => setBirthdayPerson(prev => ({
            ...prev,
            birth_date: e.target.value || undefined,
          }))}
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label className="form-label">
          Sexo / gênero <span className="optional">(opcional)</span>
        </label>
        <div className="option-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <button
            type="button"
            className={`option-card ${birthdayPerson.gender === 'MASCULINO' ? 'selected' : ''}`}
            onClick={() => setBirthdayPerson(prev => ({ ...prev, gender: 'MASCULINO' }))}
          >
            <div className="option-label">Masculino</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayPerson.gender === 'FEMININO' ? 'selected' : ''}`}
            onClick={() => setBirthdayPerson(prev => ({ ...prev, gender: 'FEMININO' }))}
          >
            <div className="option-label">Feminino</div>
          </button>
          <button
            type="button"
            className={`option-card ${birthdayPerson.gender === 'NAO_INFORMADO' ? 'selected' : ''}`}
            onClick={() => setBirthdayPerson(prev => ({ ...prev, gender: 'NAO_INFORMADO' }))}
          >
            <div className="option-label">Prefiro não informar</div>
          </button>
        </div>
      </div>
    </div>
  );
}

