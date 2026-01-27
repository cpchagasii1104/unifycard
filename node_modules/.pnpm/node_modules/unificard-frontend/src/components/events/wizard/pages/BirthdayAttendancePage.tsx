// frontend/src/components/events/wizard/pages/BirthdayAttendancePage.tsx
// FASE 5 — PÁGINA: Quantidade de Participantes
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// - NÃO cria verdade
// - NÃO decide regras
// - Apenas coleta intenção declarada
//
// Fonte única de verdade: treinamento/fases/fase_5_event_creation/FASE_5_BIRTHDAY_PAGE_SET.md

import { useState, useEffect } from 'react';

export interface BirthdayAttendancePageProps {
  eventSpec: {
    answers?: {
      attendance?: {
        total?: number;
        adults?: number;
        children?: number;
        elderly?: number;
      };
    };
  };
  onChange: (partialSpec: {
    attendance?: {
      total?: number;
      adults?: number;
      children?: number;
      elderly?: number;
    };
  }) => void;
}

/**
 * BirthdayAttendancePage
 * 
 * Objetivo: Coletar estimativa de participantes
 * Campos EventSpec permitidos:
 * - attendance.total
 * - attendance.adults
 * - attendance.children
 * - attendance.elderly
 * 
 * Restrições:
 * - Todos os campos são opcionais
 * - Valores são estimativos
 * - Ausência de valor ≠ resposta negativa
 */
export default function BirthdayAttendancePage({ eventSpec, onChange }: BirthdayAttendancePageProps) {
  const [attendance, setAttendance] = useState<{
    total?: number;
    adults?: number;
    children?: number;
    elderly?: number;
  }>(eventSpec.answers?.attendance || {});

  // Notificar mudanças via onChange
  useEffect(() => {
    onChange({ attendance });
  }, [attendance, onChange]);

  return (
    <div className="wizard-page">
      <h3>Quantidade de Convidados</h3>
      <p className="step-description">
        Quantas pessoas você espera? Tudo aqui é estimativa declarada, não é verdade absoluta do sistema.
      </p>

      <div className="form-group">
        <label htmlFor="attendance_total" className="form-label">
          Quantidade total de convidados <span className="optional">(opcional)</span>
        </label>
        <input
          id="attendance_total"
          type="number"
          min="1"
          value={attendance.total || ''}
          onChange={(e) => setAttendance(prev => ({
            ...prev,
            total: e.target.value ? parseInt(e.target.value, 10) : undefined,
          }))}
          placeholder="Ex: 50"
          className="form-input"
        />
        <button
          type="button"
          className="link-button"
          onClick={() => setAttendance(prev => ({ ...prev, total: undefined }))}
        >
          Ainda não sei
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">
          Composição dos convidados <span className="optional">(opcional - se souber)</span>
        </label>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="attendance_adults" className="form-label-small">
              Quantos adultos?
            </label>
            <input
              id="attendance_adults"
              type="number"
              min="0"
              value={attendance.adults || ''}
              onChange={(e) => setAttendance(prev => ({
                ...prev,
                adults: e.target.value ? parseInt(e.target.value, 10) : undefined,
              }))}
              placeholder="Ex: 30"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="attendance_children" className="form-label-small">
              Quantas crianças?
            </label>
            <input
              id="attendance_children"
              type="number"
              min="0"
              value={attendance.children || ''}
              onChange={(e) => setAttendance(prev => ({
                ...prev,
                children: e.target.value ? parseInt(e.target.value, 10) : undefined,
              }))}
              placeholder="Ex: 20"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="attendance_elderly" className="form-label-small">
              Quantos idosos?
            </label>
            <input
              id="attendance_elderly"
              type="number"
              min="0"
              value={attendance.elderly || ''}
              onChange={(e) => setAttendance(prev => ({
                ...prev,
                elderly: e.target.value ? parseInt(e.target.value, 10) : undefined,
              }))}
              placeholder="Ex: 5"
              className="form-input"
            />
          </div>
        </div>
        <button
          type="button"
          className="link-button"
          onClick={() => setAttendance(prev => ({
            ...prev,
            adults: undefined,
            children: undefined,
            elderly: undefined,
          }))}
        >
          Não sei informar agora
        </button>
      </div>
    </div>
  );
}

