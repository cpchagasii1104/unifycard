// src/components/events/guided-flow/Step3TimeWindows.tsx
// ETAPA 3 — Quando (Time Windows)
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Datas possíveis (nunca "confirmar data")
// - Flexibilidade
// - Duração estimada
// - Chama POST /events/:id/time-windows
//
// 🔴 VALIDAÇÕES OBRIGATÓRIAS:
// - Input completo (não aceita valores parciais)
// - Data válida e horário completo
// - Janela consistente (end >= start)
// - Aviso não bloqueante para datas no passado (DRAFT permite)
// - Erros sempre visíveis

import { useState, useMemo } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import './Step3TimeWindows.css';

interface Step3TimeWindowsProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
  isLoading: boolean;
}

interface WindowValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valida se uma string datetime-local está completa
 * Formato esperado: YYYY-MM-DDTHH:mm
 */
function isDateTimeLocalComplete(value: string): boolean {
  if (!value) return false;
  // datetime-local deve ter formato: YYYY-MM-DDTHH:mm
  const pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  return pattern.test(value);
}

/**
 * Valida uma janela de tempo
 * @param start - Data/hora de início
 * @param end - Data/hora de término
 * @param isBirthdayEvent - Se true, bloqueia datas no passado (aniversário não pode ser no passado)
 */
function validateWindow(
  start: string,
  end: string,
  isBirthdayEvent: boolean = false
): WindowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Validar que ambos os campos estão preenchidos e completos
  if (!start || !isDateTimeLocalComplete(start)) {
    errors.push('Data/hora de início incompleta ou inválida');
  }
  if (!end || !isDateTimeLocalComplete(end)) {
    errors.push('Data/hora de término incompleta ou inválida');
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // 2. Validar que as datas são válidas
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime())) {
    errors.push('Data/hora de início inválida');
  }
  if (isNaN(endDate.getTime())) {
    errors.push('Data/hora de término inválida');
  }

  if (errors.length > 0) {
    return { isValid: false, errors, warnings };
  }

  // 3. Validar consistência da janela (end >= start)
  if (endDate <= startDate) {
    errors.push('Data/hora de término deve ser posterior à data/hora de início');
  }

  // 4. Validação de datas no passado
  const now = new Date();
  // Criar data de hoje sem hora (00:00:00) para comparação justa
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);
  
  // Criar datas apenas com data (sem hora) para comparação
  const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  startDateOnly.setHours(0, 0, 0, 0);
  const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  endDateOnly.setHours(0, 0, 0, 0);
  
  if (isBirthdayEvent) {
    // Para aniversários: BLOQUEAR datas no passado (comparar apenas a data, não a hora)
    // Aniversário deve ser hoje ou no futuro
    if (startDateOnly.getTime() < today.getTime()) {
      errors.push('Aniversário não pode ser no passado. Selecione uma data futura.');
    }
    if (endDateOnly.getTime() < today.getTime()) {
      errors.push('Data de término não pode ser no passado para aniversários.');
    }
  } else {
    // Para outros eventos: AVISO não bloqueante (DRAFT permite)
    if (startDate < now) {
      warnings.push('Data/hora de início está no passado (permitido em rascunho)');
    }
    if (endDate < now) {
      warnings.push('Data/hora de término está no passado (permitido em rascunho)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export default function Step3TimeWindows({ data, onUpdate, onComplete, isLoading }: Step3TimeWindowsProps) {
  const [newWindow, setNewWindow] = useState({
    start_datetime: '',
    end_datetime: '',
    timezone: 'America/Sao_Paulo',
  });

  const [newWindowErrors, setNewWindowErrors] = useState<string[]>([]);
  const [newWindowWarnings, setNewWindowWarnings] = useState<string[]>([]);

  // Verificar se é evento de aniversário
  const isBirthdayEvent = useMemo(() => {
    const subtype = data.event_subtype?.toLowerCase() || '';
    return subtype.includes('aniversário') || subtype.includes('birthday') || subtype === 'aniversario';
  }, [data.event_subtype]);

  // Validar janela atual sendo digitada
  const newWindowValidation = useMemo(() => {
    if (!newWindow.start_datetime && !newWindow.end_datetime) {
      return { isValid: false, errors: [], warnings: [] };
    }
    return validateWindow(newWindow.start_datetime, newWindow.end_datetime, isBirthdayEvent);
  }, [newWindow.start_datetime, newWindow.end_datetime, isBirthdayEvent]);

  // Validar todas as janelas já adicionadas
  const existingWindowsValidation = useMemo(() => {
    // Se não há janelas, não é válido
    if (data.desired_time_windows.length === 0) {
      return false;
    }
    
    const now = new Date();
    // Criar data de hoje sem hora (00:00:00) para comparação justa
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(0, 0, 0, 0);
    
    const allValid = data.desired_time_windows.every((window) => {
      const start = new Date(window.start_datetime);
      const end = new Date(window.end_datetime);
      
      // Validação básica: datas válidas e end > start
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return false;
      }
      
      // Para aniversários: bloquear datas no passado (comparar apenas a data, não a hora)
      if (isBirthdayEvent) {
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        startDateOnly.setHours(0, 0, 0, 0);
        const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        endDateOnly.setHours(0, 0, 0, 0);
        
        // Aniversário não pode ser no passado (comparar apenas a data)
        // Deve ser hoje ou no futuro
        if (startDateOnly.getTime() < today.getTime() || endDateOnly.getTime() < today.getTime()) {
          return false;
        }
      }
      
      return true;
    });
    
    return allValid;
  }, [data.desired_time_windows, isBirthdayEvent]);

  // Erros visíveis que bloqueiam o botão
  // NOTA: Erros na janela sendo digitada (newWindow) NÃO bloqueiam o botão
  // O botão só é bloqueado se há janelas inválidas já adicionadas ou nenhuma janela
  // existingWindowsValidation já verifica se há janelas, então só precisamos verificar se é false
  const hasVisibleErrors = useMemo(() => {
    // Se não há validação válida (inclui caso de nenhuma janela), há erro
    return !existingWindowsValidation;
  }, [existingWindowsValidation]);

  /**
   * Impede Tab se o horário estiver incompleto
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, field: 'start' | 'end') => {
    if (e.key === 'Tab') {
      const value = field === 'start' ? newWindow.start_datetime : newWindow.end_datetime;
      
      // Se o campo tem valor mas está incompleto, impedir Tab
      if (value && !isDateTimeLocalComplete(value)) {
        e.preventDefault();
        const fieldName = field === 'start' ? 'início' : 'término';
        setNewWindowErrors([`Complete o horário de ${fieldName} antes de continuar`]);
        // Focar no campo atual para que o usuário complete
        e.currentTarget.focus();
      }
    }
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWindow({ ...newWindow, start_datetime: value });
    // Limpar erros ao começar a digitar
    if (newWindowErrors.length > 0) {
      setNewWindowErrors([]);
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewWindow({ ...newWindow, end_datetime: value });
    // Limpar erros ao começar a digitar
    if (newWindowErrors.length > 0) {
      setNewWindowErrors([]);
    }
  };

  const handleBlur = () => {
    // Atualizar erros e avisos quando o campo perde o foco
    setNewWindowErrors(newWindowValidation.errors);
    setNewWindowWarnings(newWindowValidation.warnings);
  };

  const addWindow = () => {
    const validation = validateWindow(newWindow.start_datetime, newWindow.end_datetime, isBirthdayEvent);
    
    if (!validation.isValid) {
      setNewWindowErrors(validation.errors);
      setNewWindowWarnings(validation.warnings);
      return;
    }

    // Adicionar janela válida
    const windows = [...data.desired_time_windows, {
      start_datetime: new Date(newWindow.start_datetime).toISOString(),
      end_datetime: new Date(newWindow.end_datetime).toISOString(),
      timezone: newWindow.timezone,
    }];
    onUpdate({ desired_time_windows: windows });
    setNewWindow({ start_datetime: '', end_datetime: '', timezone: 'America/Sao_Paulo' });
    setNewWindowErrors([]);
    setNewWindowWarnings([]);
  };

  const removeWindow = (index: number) => {
    const windows = data.desired_time_windows.filter((_, i) => i !== index);
    onUpdate({ desired_time_windows: windows });
  };

  return (
    <div className="step3-time-windows">
      <div className="step-header">
        <h2>Quando (Janelas de Tempo Possíveis)</h2>
        <p className="step-hint">
          ⚠️ Estas são datas possíveis, não confirmadas. Use "janelas" e "alternativas".
        </p>
      </div>

      <div className="step-content">
        <div className="time-windows-info-text">
          Essas datas são apenas possibilidades.
          Nenhuma data será confirmada nesta etapa.
        </div>
        <div className="form-group">
          <label className="form-label">Flexibilidade</label>
          <div className="option-grid">
            <button
              type="button"
              className={`option-button ${data.flexibility_level === 'strict' ? 'selected' : ''}`}
              onClick={() => onUpdate({ flexibility_level: 'strict' })}
            >
              Rígida
            </button>
            <button
              type="button"
              className={`option-button ${data.flexibility_level === 'flexible' ? 'selected' : ''}`}
              onClick={() => onUpdate({ flexibility_level: 'flexible' })}
            >
              Flexível
            </button>
            <button
              type="button"
              className={`option-button ${data.flexibility_level === 'very_flexible' ? 'selected' : ''}`}
              onClick={() => onUpdate({ flexibility_level: 'very_flexible' })}
            >
              Muito Flexível
            </button>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Adicionar Janela de Tempo Possível</label>
          <div className="window-inputs">
            <div className="input-wrapper">
              <label className="input-label">Início *</label>
              <input
                type="datetime-local"
                value={newWindow.start_datetime}
                onChange={handleStartChange}
                onBlur={handleBlur}
                onKeyDown={(e) => handleKeyDown(e, 'start')}
                className={`form-input ${newWindowErrors.length > 0 ? 'input-error' : ''}`}
                required
                placeholder="DD/MM/AAAA HH:mm"
              />
              <small className="input-hint">Preencha data e horário completos</small>
            </div>
            <div className="input-wrapper">
              <label className="input-label">Término *</label>
              <input
                type="datetime-local"
                value={newWindow.end_datetime}
                onChange={handleEndChange}
                onBlur={handleBlur}
                onKeyDown={(e) => handleKeyDown(e, 'end')}
                className={`form-input ${newWindowErrors.length > 0 ? 'input-error' : ''}`}
                required
                placeholder="DD/MM/AAAA HH:mm"
              />
              <small className="input-hint">Preencha data e horário completos</small>
            </div>
            <button
              type="button"
              className="step-button step-button-secondary"
              onClick={addWindow}
              disabled={!newWindowValidation.isValid}
            >
              Adicionar Janela
            </button>
          </div>
          
          {/* Erros visíveis */}
          {newWindowErrors.length > 0 && (
            <div className="validation-errors">
              {newWindowErrors.map((error, index) => (
                <div key={index} className="error-message">
                  ⚠️ {error}
                </div>
              ))}
            </div>
          )}
          
          {/* Avisos não bloqueantes */}
          {newWindowWarnings.length > 0 && newWindowErrors.length === 0 && (
            <div className="validation-warnings">
              {newWindowWarnings.map((warning, index) => (
                <div key={index} className="warning-message">
                  ℹ️ {warning}
                </div>
              ))}
            </div>
          )}
        </div>

        {data.desired_time_windows.length > 0 && (
          <div className="windows-list">
            <h3>Janelas Definidas</h3>
            {data.desired_time_windows.map((window, index) => {
              const start = new Date(window.start_datetime);
              const end = new Date(window.end_datetime);
              const now = new Date();
              const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
              const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
              
              const isPast = startDateOnly < today;
              const isInvalidForBirthday = isBirthdayEvent && isPast;
              const isValid = !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start && !isInvalidForBirthday;
              
              return (
                <div key={index} className={`window-item ${!isValid ? 'window-item-invalid' : ''} ${isPast && !isBirthdayEvent ? 'window-item-past' : ''}`}>
                  <div className="window-item-content">
                    <span>
                      {start.toLocaleString('pt-BR')} - {end.toLocaleString('pt-BR')}
                    </span>
                    {isPast && !isBirthdayEvent && (
                      <span className="window-past-badge">⚠️ Passado</span>
                    )}
                    {isInvalidForBirthday && (
                      <span className="window-invalid-badge">❌ Aniversário não pode ser no passado</span>
                    )}
                    {!isValid && !isInvalidForBirthday && (
                      <span className="window-invalid-badge">❌ Inválida</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeWindow(index)}
                  >
                    Remover
                  </button>
                </div>
              );
            })}
            {!existingWindowsValidation && (
              <div className="validation-errors">
                <div className="error-message">
                  ⚠️ Uma ou mais janelas são inválidas. Corrija ou remova antes de salvar.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onComplete}
          disabled={hasVisibleErrors || isLoading}
        >
          {isLoading ? 'Salvando...' : 'Salvar Janelas'}
        </button>
        {hasVisibleErrors && (
          <div className="step-action-hint">
            {data.desired_time_windows.length === 0 && (
              <span className="hint-text">⚠️ Adicione pelo menos uma janela de tempo válida</span>
            )}
            {data.desired_time_windows.length > 0 && !existingWindowsValidation && (
              <span className="hint-text">⚠️ Corrija as janelas inválidas antes de salvar</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

