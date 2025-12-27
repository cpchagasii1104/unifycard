// src/components/AvailabilityScheduleEnhanced.tsx
// Componente melhorado para configurar agenda unificada com calendário e modo descanso

import { useState, useEffect, useRef } from 'react';
import type { AvailabilitySchedule } from '../api/categories';
import { validateTimeRange, validateDateRange } from '../utils/validation';
import './AvailabilitySchedule.css';

interface AvailabilityScheduleProps {
  availability: AvailabilitySchedule | null;
  onChange: (availability: AvailabilitySchedule) => void;
}

interface RestPeriod {
  startDate: string;
  endDate: string;
  reason?: string;
}

interface SpecificDateAvailability {
  date: string;
  timeSlots: string[];
}

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function AvailabilityScheduleEnhanced({
  availability,
  onChange,
}: AvailabilityScheduleProps) {
  const [schedule, setSchedule] = useState<AvailabilitySchedule>(availability || {});
  const [restPeriods, setRestPeriods] = useState<RestPeriod[]>([]);
  const [specificDates, setSpecificDates] = useState<Map<string, SpecificDateAvailability>>(new Map());
  const [viewMode, setViewMode] = useState<'weekly' | 'calendar'>('weekly');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeSlotErrors, setTimeSlotErrors] = useState<Record<string, string>>({});
  const [restPeriodErrors, setRestPeriodErrors] = useState<Record<number, string>>({});
  const isInitialMount = useRef(true);
  const lastAvailabilityRef = useRef<string>('');
  const scheduleRef = useRef<AvailabilitySchedule>(availability || {});

  // Parsear dados iniciais (apenas quando availability muda externamente)
  useEffect(() => {
    if (!availability) return;

    // Comparar com última versão para evitar loops
    const availabilityStr = JSON.stringify(availability);
    if (availabilityStr === lastAvailabilityRef.current && !isInitialMount.current) {
      return;
    }
    lastAvailabilityRef.current = availabilityStr;

    // Parsear períodos de descanso
    const restData = availability['rest'] || [];
    const periods: RestPeriod[] = restData.map((period: string) => {
      const [start, end] = period.split(':');
      return { startDate: start, endDate: end || start };
    });
    
    // Parsear datas específicas
    const specificData = availability['specific'] || [];
    const datesMap = new Map<string, SpecificDateAvailability>();
    specificData.forEach((item: string) => {
      const parts = item.split(':');
      if (parts.length >= 2) {
        const date = parts[0];
        const timeRanges = parts.slice(1).join(':');
        const slots = timeRanges.includes(',') ? timeRanges.split(',') : [timeRanges];
        datesMap.set(date, {
          date,
          timeSlots: slots,
        });
      }
    });

    setRestPeriods(periods);
    setSpecificDates(datesMap);
    setSchedule(availability);
    scheduleRef.current = availability;
    isInitialMount.current = false;
  }, [availability]);

  // Atualizar schedule quando mudanças internas ocorrem (sem loop)
  useEffect(() => {
    // Pular na primeira renderização
    if (isInitialMount.current) {
      return;
    }

    const newSchedule: AvailabilitySchedule = {};
    
    // Copiar schedule atual do ref (sem depender do estado)
    Object.keys(scheduleRef.current).forEach(key => {
      if (key !== 'rest' && key !== 'specific') {
        newSchedule[key] = scheduleRef.current[key];
      }
    });
    
    // Adicionar períodos de descanso
    if (restPeriods.length > 0) {
      newSchedule['rest'] = restPeriods.map(p => `${p.startDate}:${p.endDate}`);
    }

    // Adicionar datas específicas
    if (specificDates.size > 0) {
      newSchedule['specific'] = Array.from(specificDates.values()).map(sd => 
        `${sd.date}:${sd.timeSlots.join(',')}`
      );
    }

    // Comparar se realmente mudou antes de atualizar
    const scheduleStr = JSON.stringify(newSchedule);
    if (scheduleStr !== lastAvailabilityRef.current) {
      lastAvailabilityRef.current = scheduleStr;
      scheduleRef.current = newSchedule;
      setSchedule(newSchedule);
      onChange(newSchedule);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restPeriods, specificDates]);

  const updateSchedule = (newSchedule: AvailabilitySchedule) => {
    const scheduleStr = JSON.stringify(newSchedule);
    lastAvailabilityRef.current = scheduleStr;
    scheduleRef.current = newSchedule;
    setSchedule(newSchedule);
    onChange(newSchedule);
  };

  // ========== FUNÇÕES DE CALENDÁRIO ==========
  
  const getDaysInMonth = (month: number, year: number): number => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number): number => {
    return new Date(year, month, 1).getDay();
  };

  const formatDate = (year: number, month: number, day: number): string => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const isDateInRest = (date: string): boolean => {
    return restPeriods.some(rp => date >= rp.startDate && date <= rp.endDate);
  };

  const isDateAvailable = (date: string): boolean => {
    return specificDates.has(date);
  };

  const toggleDateAvailability = (date: string) => {
    if (isDateInRest(date)) {
      alert('Esta data está em um período de descanso. Remova o período de descanso primeiro.');
      return;
    }

    const newDates = new Map(specificDates);
    if (newDates.has(date)) {
      newDates.delete(date);
      setSelectedDate(null);
    } else {
      newDates.set(date, {
        date,
        timeSlots: ['09:00-18:00'], // Horário padrão
      });
      setSelectedDate(date);
    }
    setSpecificDates(newDates);
  };

  const updateDateTimeSlots = (date: string, timeSlots: string[]) => {
    // Validar todos os horários
    const errors: Record<string, string> = {};
    for (let i = 0; i < timeSlots.length; i++) {
      const { start, end } = parseTimeRange(timeSlots[i]);
      const validation = validateTimeRange(start, end);
      if (!validation.valid) {
        errors[`${date}-${i}`] = validation.error || 'Horário inválido';
      }
    }

    if (Object.keys(errors).length > 0) {
      setTimeSlotErrors({ ...timeSlotErrors, ...errors });
      return;
    }

    // Remover erros se validação passou
    const newErrors = { ...timeSlotErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${date}-`)) {
        delete newErrors[key];
      }
    });
    setTimeSlotErrors(newErrors);

    const newDates = new Map(specificDates);
    if (newDates.has(date)) {
      newDates.set(date, { date, timeSlots });
      setSpecificDates(newDates);
    }
  };

  // ========== FUNÇÕES DE DESCANSO ==========

  const addRestPeriod = () => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const newPeriod: RestPeriod = {
      startDate: formatDate(today.getFullYear(), today.getMonth(), today.getDate()),
      endDate: formatDate(nextWeek.getFullYear(), nextWeek.getMonth(), nextWeek.getDate()),
    };
    setRestPeriods([...restPeriods, newPeriod]);
  };

  const removeRestPeriod = (index: number) => {
    setRestPeriods(restPeriods.filter((_, i) => i !== index));
  };

  const updateRestPeriod = (index: number, field: 'startDate' | 'endDate' | 'reason', value: string) => {
    const updated = [...restPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setRestPeriods(updated);

    // Validar período
    if (field === 'startDate' || field === 'endDate') {
      const period = updated[index];
      if (period.startDate && period.endDate) {
        const validation = validateDateRange(period.startDate, period.endDate);
        if (!validation.valid) {
          setRestPeriodErrors({ ...restPeriodErrors, [index]: validation.error || 'Período inválido' });
        } else {
          const newErrors = { ...restPeriodErrors };
          delete newErrors[index];
          setRestPeriodErrors(newErrors);
        }
      }
    }
  };

  // ========== FUNÇÕES DE HORÁRIOS SEMANAIS ==========

  const toggleDay = (dayKey: string) => {
    const newSchedule = { ...schedule };
    if (newSchedule[dayKey]) {
      delete newSchedule[dayKey];
    } else {
      newSchedule[dayKey] = ['09:00-18:00'];
    }
    updateSchedule(newSchedule);
  };

  const addTimeSlot = (dayKey: string) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dayKey]) {
      newSchedule[dayKey] = [];
    }
    newSchedule[dayKey].push('09:00-18:00');
    updateSchedule(newSchedule);
  };

  const removeTimeSlot = (dayKey: string, index: number) => {
    const newSchedule = { ...schedule };
    if (newSchedule[dayKey]) {
      newSchedule[dayKey] = newSchedule[dayKey].filter((_, i) => i !== index);
      if (newSchedule[dayKey].length === 0) {
        delete newSchedule[dayKey];
      }
    }
    updateSchedule(newSchedule);
  };

  const updateTimeSlot = (dayKey: string, index: number, timeRange: string) => {
    // Validar intervalo de horário
    const { start, end } = parseTimeRange(timeRange);
    const validation = validateTimeRange(start, end);
    
    if (!validation.valid) {
      const errorKey = `${dayKey}-${index}`;
      setTimeSlotErrors({ ...timeSlotErrors, [errorKey]: validation.error || 'Horário inválido' });
      return;
    }

    // Remover erro se validação passou
    const errorKey = `${dayKey}-${index}`;
    const newErrors = { ...timeSlotErrors };
    delete newErrors[errorKey];
    setTimeSlotErrors(newErrors);

    const newSchedule = { ...schedule };
    if (newSchedule[dayKey]) {
      newSchedule[dayKey][index] = timeRange;
    }
    updateSchedule(newSchedule);
  };

  const parseTimeRange = (range: string): { start: string; end: string } => {
    const [start, end] = range.split('-');
    return { start: start || '09:00', end: end || '18:00' };
  };

  const formatTimeRange = (start: string, end: string): string => {
    return `${start}-${end}`;
  };

  const applyPreset = (preset: 'weekdays' | 'weekend' | 'all' | 'custom') => {
    const newSchedule: AvailabilitySchedule = {};

    if (preset === 'weekdays') {
      DAYS_OF_WEEK.slice(0, 5).forEach((day) => {
        newSchedule[day.key] = ['09:00-18:00'];
      });
    } else if (preset === 'weekend') {
      DAYS_OF_WEEK.slice(5).forEach((day) => {
        newSchedule[day.key] = ['09:00-18:00'];
      });
    } else if (preset === 'all') {
      DAYS_OF_WEEK.forEach((day) => {
        newSchedule[day.key] = ['09:00-18:00'];
      });
    }

    updateSchedule(newSchedule);
  };

  // ========== RENDERIZAÇÃO ==========

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const firstDay = getFirstDayOfMonth(selectedMonth, selectedYear);
    const days: (number | null)[] = [];

    // Preencher dias vazios do início
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }

    // Preencher dias do mês
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(day);
    }

    return (
      <div className="calendar-container">
        <div className="calendar-header">
          <button
            type="button"
            onClick={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            className="calendar-nav-button"
          >
            ←
          </button>
          <h4>{MONTHS[selectedMonth]} {selectedYear}</h4>
          <button
            type="button"
            onClick={() => {
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
            className="calendar-nav-button"
          >
            →
          </button>
        </div>

        <div className="calendar-grid">
          <div className="calendar-weekdays">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="calendar-weekday">{day}</div>
            ))}
          </div>
          <div className="calendar-days">
            {days.map((day, index) => {
              if (day === null) {
                return <div key={index} className="calendar-day empty"></div>;
              }

              const date = formatDate(selectedYear, selectedMonth, day);
              const isRest = isDateInRest(date);
              const isAvailable = isDateAvailable(date);
              const isSelected = selectedDate === date;
              const isToday = date === formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

              return (
                <div
                  key={index}
                  className={`calendar-day ${isRest ? 'rest' : ''} ${isAvailable ? 'available' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => toggleDateAvailability(date)}
                  title={isRest ? 'Período de descanso' : isAvailable ? 'Clique para editar horários' : 'Clique para adicionar'}
                >
                  <span className="calendar-day-number">{day}</span>
                  {isAvailable && <span className="calendar-indicator">✓</span>}
                  {isRest && <span className="calendar-indicator rest-icon">😴</span>}
                </div>
              );
            })}
          </div>
        </div>

        {selectedDate && specificDates.has(selectedDate) && (
          <div className="selected-date-times">
            <h5>Horários para {selectedDate}</h5>
            {specificDates.get(selectedDate)?.timeSlots.map((slot, index) => {
              const { start, end } = parseTimeRange(slot);
              const errorKey = `${selectedDate}-${index}`;
              const hasError = !!timeSlotErrors[errorKey];
              
              return (
                <div key={index} className="time-slot">
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => {
                      const newSlots = [...(specificDates.get(selectedDate)?.timeSlots || [])];
                      newSlots[index] = formatTimeRange(e.target.value, end);
                      updateDateTimeSlots(selectedDate, newSlots);
                    }}
                    className={`time-input ${hasError ? 'error' : ''}`}
                  />
                  <span className="time-separator">até</span>
                  <input
                    type="time"
                    value={end}
                    onChange={(e) => {
                      const newSlots = [...(specificDates.get(selectedDate)?.timeSlots || [])];
                      newSlots[index] = formatTimeRange(start, e.target.value);
                      updateDateTimeSlots(selectedDate, newSlots);
                    }}
                    className={`time-input ${hasError ? 'error' : ''}`}
                  />
                  {hasError && (
                    <span className="field-error-small">{timeSlotErrors[errorKey]}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const newSlots = specificDates.get(selectedDate)?.timeSlots.filter((_, i) => i !== index) || [];
                      if (newSlots.length === 0) {
                        toggleDateAvailability(selectedDate);
                      } else {
                        updateDateTimeSlots(selectedDate, newSlots);
                      }
                      const newErrors = { ...timeSlotErrors };
                      delete newErrors[errorKey];
                      setTimeSlotErrors(newErrors);
                    }}
                    className="remove-slot-button"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const current = specificDates.get(selectedDate)?.timeSlots || [];
                updateDateTimeSlots(selectedDate, [...current, '09:00-18:00']);
              }}
              className="add-slot-button"
            >
              + Adicionar Horário
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="availability-schedule">
      <div className="schedule-header">
        <h3>Agenda Unificada</h3>
        <p className="schedule-description">
          Configure seus horários disponíveis. Esta agenda é unificada para todas as suas profissões.
          Se você estiver ocupado em um horário, ele será bloqueado para todas as profissões.
        </p>
      </div>

      {/* Modo de Visualização */}
      <div className="view-mode-selector">
        <button
          type="button"
          className={`view-mode-button ${viewMode === 'weekly' ? 'active' : ''}`}
          onClick={() => setViewMode('weekly')}
        >
          📅 Semanal
        </button>
        <button
          type="button"
          className={`view-mode-button ${viewMode === 'calendar' ? 'active' : ''}`}
          onClick={() => setViewMode('calendar')}
        >
          🗓️ Calendário
        </button>
      </div>

      {/* Modo Descanso */}
      <div className="rest-section">
        <div className="rest-header">
          <h4>Períodos de Descanso</h4>
          <button type="button" onClick={addRestPeriod} className="add-rest-button">
            + Adicionar Período de Descanso
          </button>
        </div>
        {restPeriods.map((period, index) => (
          <div key={index} className="rest-period">
            <div className="rest-dates">
              <label>
                Data Início:
                <input
                  type="date"
                  value={period.startDate}
                  onChange={(e) => updateRestPeriod(index, 'startDate', e.target.value)}
                  className={restPeriodErrors[index] ? 'error' : ''}
                />
              </label>
              <label>
                Data Fim:
                <input
                  type="date"
                  value={period.endDate}
                  onChange={(e) => updateRestPeriod(index, 'endDate', e.target.value)}
                  className={restPeriodErrors[index] ? 'error' : ''}
                />
              </label>
              <label>
                Motivo (opcional):
                <input
                  type="text"
                  value={period.reason || ''}
                  onChange={(e) => updateRestPeriod(index, 'reason', e.target.value)}
                  placeholder="Ex: Descanso, férias, licença..."
                  maxLength={100}
                />
              </label>
            </div>
            {restPeriodErrors[index] && (
              <span className="field-error">{restPeriodErrors[index]}</span>
            )}
            <button
              type="button"
              onClick={() => {
                removeRestPeriod(index);
                const newErrors = { ...restPeriodErrors };
                delete newErrors[index];
                setRestPeriodErrors(newErrors);
              }}
              className="remove-rest-button"
            >
              ✕ Remover
            </button>
          </div>
        ))}
      </div>

      {/* Visualização Semanal */}
      {viewMode === 'weekly' && (
        <>
          <div className="preset-buttons">
            <button type="button" onClick={() => applyPreset('weekdays')} className="preset-button">
              Segunda a Sexta
            </button>
            <button type="button" onClick={() => applyPreset('weekend')} className="preset-button">
              Sábado e Domingo
            </button>
            <button type="button" onClick={() => applyPreset('all')} className="preset-button">
              Todos os Dias
            </button>
            <button type="button" onClick={() => applyPreset('custom')} className="preset-button">
              Limpar
            </button>
          </div>

          <div className="schedule-days">
            {DAYS_OF_WEEK.map((day) => {
              const isActive = !!schedule[day.key];
              const timeSlots = schedule[day.key] || [];

              return (
                <div key={day.key} className={`schedule-day ${isActive ? 'active' : ''}`}>
                  <div className="day-header">
                    <label className="day-toggle">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => toggleDay(day.key)}
                      />
                      <span className="day-label">{day.label}</span>
                    </label>
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => addTimeSlot(day.key)}
                        className="add-slot-button"
                        title="Adicionar horário"
                      >
                        + Horário
                      </button>
                    )}
                  </div>

                  {isActive && (
                    <div className="time-slots">
                      {timeSlots.map((slot, index) => {
                        const { start, end } = parseTimeRange(slot);
                        const errorKey = `${day.key}-${index}`;
                        const hasError = !!timeSlotErrors[errorKey];
                        
                        return (
                          <div key={index} className="time-slot">
                            <input
                              type="time"
                              value={start}
                              onChange={(e) => {
                                const newRange = formatTimeRange(e.target.value, end);
                                updateTimeSlot(day.key, index, newRange);
                              }}
                              className={`time-input ${hasError ? 'error' : ''}`}
                            />
                            <span className="time-separator">até</span>
                            <input
                              type="time"
                              value={end}
                              onChange={(e) => {
                                const newRange = formatTimeRange(start, e.target.value);
                                updateTimeSlot(day.key, index, newRange);
                              }}
                              className={`time-input ${hasError ? 'error' : ''}`}
                            />
                            {hasError && (
                              <span className="field-error-small">{timeSlotErrors[errorKey]}</span>
                            )}
                            {timeSlots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  removeTimeSlot(day.key, index);
                                  const newErrors = { ...timeSlotErrors };
                                  delete newErrors[errorKey];
                                  setTimeSlotErrors(newErrors);
                                }}
                                className="remove-slot-button"
                                title="Remover horário"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Visualização Calendário */}
      {viewMode === 'calendar' && renderCalendar()}
    </div>
  );
}

