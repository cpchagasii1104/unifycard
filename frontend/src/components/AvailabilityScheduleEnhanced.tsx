// src/components/AvailabilityScheduleEnhanced.tsx
// Componente melhorado para configurar agenda unificada com calendário e modo descanso

import { useState, useEffect, useRef } from 'react';
import type { AvailabilitySchedule } from '../api/categories';
import type { MaterializeWeeklyTemplateResult, TemporalPurpose } from '../api/availability';
import { validateTimeRange, validateDateRange } from '../utils/validation';
import { normalizeTimeValue } from '../utils/temporal/normalizeTime';
import { summarizeMaterializeResult } from '../utils/temporal/materializeResult';
import './AvailabilitySchedule.css';

interface AvailabilityScheduleProps {
  availability: AvailabilitySchedule | null;
  // 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2: persistência REMOTA EXPLÍCITA. Resolve com o resultado
  // real da materialização (rejected/conflicts/protectedCount) ou REJEITA em erro HTTP. NÃO é
  // mais um `onChange` fire-and-forget — o save só "confirma" depois que esta Promise resolve limpa.
  // 🔴 DECISION-0132: o save agora envia também a finalidade por faixa (purposes). Mantém o contrato
  // honesto (Promise que resolve com o resultado real ou rejeita em erro) da frente anterior.
  onSave: (
    availability: AvailabilitySchedule,
    purposes: Record<string, string>
  ) => Promise<MaterializeWeeklyTemplateResult>;
  // 🔴 DECISION-0132: catálogo canônico das 4 finalidades (slug+conceptId+bookable), resolvido do
  // backend. Quando presente, o seletor de finalidade por faixa é renderizado.
  temporalPurposes?: TemporalPurpose[];
  // 🔴 DECISION-0132: read-back das finalidades já persistidas. Chave = `${dayKey|specific}|${range}`.
  initialPurposes?: Record<string, string>;
  // (legado, mantido por compat — não usado para persistir contexto: ver DECISION-0132)
  showContextSelector?: boolean;
  onContextChange?: (dayKey: string, slotIndex: number, context: 'WORK' | 'LEISURE' | 'STUDY' | null) => void;
  slotContexts?: Record<string, 'WORK' | 'LEISURE' | 'STUDY' | null>;
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

/** DECISION-0132: rótulos pt-BR das finalidades (apresentação; a verdade é o concept_id). */
const PURPOSE_LABELS: Record<string, string> = {
  'trabalho': 'Trabalho',
  'estudo': 'Estudo',
  'cuidados-pessoais': 'Cuidados Pessoais',
  'lazer': 'Lazer',
};

export default function AvailabilityScheduleEnhanced({
  availability,
  onSave,
  temporalPurposes,
  initialPurposes = {},
  showContextSelector = false,
  onContextChange,
  slotContexts = {},
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
  // 🔴 UX FIX: Estado de draft para inputs de time (permite digitação livre sem travar)
  // Formato: { "dayKey-index-field": "valor temporário" } onde field é "start" ou "end"
  const [timeInputDrafts, setTimeInputDrafts] = useState<Record<string, string>>({});
  // 🔴 UX TEMPORAL CANÔNICO: Estado de contexto por slot (apenas descritivo)
  // Formato: { "dayKey-index": "WORK" | "LEISURE" | "STUDY" | null }
  const [contexts, setContexts] = useState<Record<string, 'WORK' | 'LEISURE' | 'STUDY' | null>>(slotContexts);
  // 🔴 DECISION-0132: finalidade temporal por faixa. Chave = `${dayKey|specific}|${range}` → slug.
  // Estável por RANGE (não por índice) para alinhar com o read-back e o payload do backend.
  const [slotPurposes, setSlotPurposes] = useState<Record<string, string>>(initialPurposes);
  // mapa slug → bookable (para marcar blocos protegidos como não-bookáveis na UI)
  const purposeBookableBySlug = new Map<string, boolean>(
    (temporalPurposes ?? []).map((p) => [p.slug, p.bookable])
  );
  // 🔴 UX FECHAMENTO: Memória local do último end_time confirmado por contexto por dia
  // Formato: { "dayKey-context": "HH:mm" } - apenas em memória, não persiste
  const [lastEndTimeByContext, setLastEndTimeByContext] = useState<Record<string, string>>({});
  // 🔴 UX FECHAMENTO: Mensagens de validação inline para campos vazios
  // Formato: { "dayKey-index-field": "mensagem" }
  const [timeInputMessages, setTimeInputMessages] = useState<Record<string, string>>({});
  // 🔴 MODO POR DIA: FIXED (CLT) ou FLEXIBLE (autônomo)
  // Formato: { "dayKey": "FIXED" | "FLEXIBLE" }
  // Default: FLEXIBLE (permite sobreposição entre contextos)
  const [dayMode, setDayMode] = useState<Record<string, 'FIXED' | 'FLEXIBLE'>>({});
  // 🔴 ESTADO SUJO: Rastrear dias modificados (não salvos)
  const [dirtyDays, setDirtyDays] = useState<Record<string, boolean>>({});
  // 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2: veredito REAL do último save (espelha o backend).
  // 'saving' bloqueia novo clique; 'saved' = confirmação LIMPA; 'partial' = algo não aplicado
  // (rejected/conflicts/protectedCount) — NÃO é sucesso pleno; 'error' = falha HTTP (dirty preservado).
  const [saveState, setSaveState] = useState<{
    status: 'idle' | 'saving' | 'saved' | 'partial' | 'error';
    message: string;
    detail?: string;
  }>({ status: 'idle', message: '' });
  // 🔴 ESTADO ORIGINAL: Manter cópia do schedule inicial para comparação
  const [originalSchedule, setOriginalSchedule] = useState<AvailabilitySchedule>(availability || {});
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
    setOriginalSchedule(availability); // 🔴 Atualizar estado original também
    scheduleRef.current = availability;
    setDirtyDays({}); // 🔴 Limpar estado sujo ao carregar novo schedule
    isInitialMount.current = false;
  }, [availability]);

  // 🔴 DECISION-0132: sincronizar finalidades do read-back quando o backend devolve novo mapa.
  // Keyed por assinatura de conteúdo (evita loop por identidade de objeto do prop).
  const initialPurposesStr = JSON.stringify(initialPurposes);
  useEffect(() => {
    setSlotPurposes(initialPurposes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPurposesStr]);

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

    // 🔴 REMOÇÃO DE PERSISTÊNCIA AUTOMÁTICA: Apenas atualizar estado local
    // onChange será chamado SOMENTE quando usuário clicar em Salvar
    const scheduleStr = JSON.stringify(newSchedule);
    if (scheduleStr !== lastAvailabilityRef.current) {
      lastAvailabilityRef.current = scheduleStr;
      scheduleRef.current = newSchedule;
      setSchedule(newSchedule);
      // 🔴 NÃO chamar onChange automaticamente - apenas quando Salvar for clicado
      // Marcar como sujo se houver mudanças
      if (restPeriods.length > 0 || specificDates.size > 0) {
        setDirtyDays(prev => ({ ...prev, 'rest': true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restPeriods, specificDates]);

  // 🔴 REMOÇÃO DE PERSISTÊNCIA AUTOMÁTICA: updateSchedule agora apenas atualiza estado local
  // onChange será chamado SOMENTE quando usuário clicar em Salvar
  const updateSchedule = (newSchedule: AvailabilitySchedule, dayKey?: string) => {
    const scheduleStr = JSON.stringify(newSchedule);
    lastAvailabilityRef.current = scheduleStr;
    scheduleRef.current = newSchedule;
    setSchedule(newSchedule);
    
    // 🔴 ESTADO SUJO: Marcar dia como modificado se dayKey fornecido
    if (dayKey) {
      setDirtyDays(prev => ({ ...prev, [dayKey]: true }));
    } else {
      // Se não há dayKey, marcar todos os dias do schedule como sujos
      const allDays = Object.keys(newSchedule);
      const newDirtyDays: Record<string, boolean> = {};
      allDays.forEach(day => {
        newDirtyDays[day] = true;
      });
      setDirtyDays(prev => ({ ...prev, ...newDirtyDays }));
    }
    
    // 🔴 NÃO chamar onChange automaticamente - apenas quando Salvar for clicado
  };
  
  // 🔴 Monta o schedule completo (grade + rest + specific) a partir do estado atual.
  const buildCompleteSchedule = (): AvailabilitySchedule => {
    const completeSchedule: AvailabilitySchedule = { ...schedule };

    if (restPeriods.length > 0) {
      completeSchedule['rest'] = restPeriods.map(p => `${p.startDate}:${p.endDate}`);
    } else {
      delete completeSchedule['rest'];
    }

    if (specificDates.size > 0) {
      completeSchedule['specific'] = Array.from(specificDates.values()).map(sd =>
        `${sd.date}:${sd.timeSlots.join(',')}`
      );
    } else {
      delete completeSchedule['specific'];
    }

    return completeSchedule;
  };

  // 🔴 DECISION-0132: monta o mapa de finalidades por faixa (`${dayKey}|${range}` → slug) a partir
  // do estado atual, restrito às faixas vivas da grade semanal. Slug é declaração; o backend resolve.
  const buildPurposes = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [day, ranges] of Object.entries(schedule)) {
      if (day === 'rest' || day === 'specific') continue;
      if (!Array.isArray(ranges)) continue;
      for (const range of ranges) {
        const slug = slotPurposes[`${day}|${range}`];
        if (slug) out[`${day}|${range}`] = slug;
      }
    }
    return out;
  };

  // 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2: persistência HONESTA.
  // Aguarda o PUT real (onSave) e só limpa dirty/originalSchedule/pendente APÓS confirmação LIMPA.
  // Resultado parcial (rejected/conflicts/protectedCount) NÃO limpa dirty e mostra aviso de
  // "salvo parcialmente". Erro HTTP mantém dirty, não atualiza originalSchedule e mostra o erro.
  const persistSchedule = async (
    completeSchedule: AvailabilitySchedule,
    clearDirty: () => void
  ): Promise<void> => {
    if (saveState.status === 'saving') return; // evita clique duplo concorrente
    setSaveState({ status: 'saving', message: 'Salvando agenda…' });
    try {
      const result = await onSave(completeSchedule, buildPurposes());
      const summary = summarizeMaterializeResult(result);
      if (summary.status === 'clean') {
        // ✅ Confirmação LIMPA do backend → agora sim commit local.
        setOriginalSchedule(completeSchedule);
        setSchedule(completeSchedule);
        clearDirty();
        setSaveState({ status: 'saved', message: summary.message });
      } else {
        // ⚠️ Parcial: NÃO limpar dirty, NÃO atualizar originalSchedule. Não fingir grade inteira aplicada.
        setSaveState({ status: 'partial', message: summary.message, detail: summary.detail });
      }
    } catch (err) {
      // ❌ Erro HTTP/exception: manter dirty + originalSchedule; mostrar erro claro.
      // 🔴 F-AGENDA-SAVE-RATE-LIMIT-429: traduzir 429/rate-limit numa mensagem útil (mantém dirty —
      // NÃO finge que salvou). Não esconde o erro: orienta o usuário a aguardar e tentar de novo.
      const raw = err instanceof Error ? err.message : '';
      const isRateLimited = /rate limit|too many requests|429|retry in/i.test(raw);
      setSaveState({
        status: 'error',
        message: isRateLimited
          ? 'Muitas tentativas em pouco tempo. Aguarde cerca de 1 minuto e clique em Salvar novamente.'
          : (raw || 'Não foi possível salvar a agenda. Tente novamente.'),
      });
    }
  };

  // 🔴 FUNÇÃO DE SALVAR: Persistir mudanças e limpar estado sujo SÓ após confirmação limpa do backend
  const handleSave = async () => {
    await persistSchedule(buildCompleteSchedule(), () => setDirtyDays({}));
  };
  
  // 🔴 FUNÇÃO DE DESCARTAR: Reverter para estado original
  const handleDiscard = () => {
    setSchedule(originalSchedule);
    setDirtyDays({});
    // Resetar também estados relacionados
    const restData = originalSchedule['rest'] || [];
    const periods: RestPeriod[] = restData.map((period: string) => {
      const [start, end] = period.split(':');
      return { startDate: start, endDate: end || start };
    });
    setRestPeriods(periods);
    
    const specificData = originalSchedule['specific'] || [];
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
    setSpecificDates(datesMap);
  };

  // 🔴 FUNÇÃO DE SALVAR POR DIA: Salvar apenas alterações de um dia específico (mesmo contrato honesto)
  const handleSaveDay = async (dayKey: string) => {
    await persistSchedule(buildCompleteSchedule(), () => {
      setDirtyDays(prev => {
        const next = { ...prev };
        delete next[dayKey];
        return next;
      });
    });
  };

  // 🔴 FUNÇÃO DE DESCARTAR POR DIA: Descartar apenas alterações de um dia específico
  const handleDiscardDay = (dayKey: string) => {
    // Reverter apenas este dia para o estado original
    const newSchedule = { ...schedule };
    if (originalSchedule[dayKey]) {
      newSchedule[dayKey] = [...originalSchedule[dayKey]];
    } else {
      delete newSchedule[dayKey];
    }
    setSchedule(newSchedule);
    
    // Remover apenas este dia do estado sujo
    const newDirtyDays = { ...dirtyDays };
    delete newDirtyDays[dayKey];
    setDirtyDays(newDirtyDays);
    
    // Limpar drafts relacionados a este dia
    const newDrafts = { ...timeInputDrafts };
    const newMessages = { ...timeInputMessages };
    Object.keys(newDrafts).forEach(key => {
      if (key.startsWith(`${dayKey}-`)) {
        delete newDrafts[key];
      }
    });
    Object.keys(newMessages).forEach(key => {
      if (key.startsWith(`${dayKey}-`)) {
        delete newMessages[key];
      }
    });
    setTimeInputDrafts(newDrafts);
    setTimeInputMessages(newMessages);
    
    // Limpar erros relacionados a este dia
    const newErrors = { ...timeSlotErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${dayKey}-`)) {
        delete newErrors[key];
      }
    });
    setTimeSlotErrors(newErrors);
  };

  // 🔴 FUNÇÃO DE SALVAR POR DATA (MODO CALENDÁRIO): mesmo contrato honesto (await + clean-only clear)
  const handleSaveDate = async (date: string) => {
    const dateKey = `calendar-${date}`;
    await persistSchedule(buildCompleteSchedule(), () => {
      setDirtyDays(prev => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
    });
  };

  // 🔴 FUNÇÃO DE DESCARTAR POR DATA (MODO CALENDÁRIO): Descartar apenas alterações de uma data específica
  const handleDiscardDate = (date: string) => {
    // Reverter apenas esta data para o estado original
    const originalSpecificData = originalSchedule['specific'] || [];
    const originalDateData = originalSpecificData.find((item: string) => item.startsWith(`${date}:`));
    
    const newSpecificDates = new Map(specificDates);
    if (originalDateData) {
      const parts = originalDateData.split(':');
      if (parts.length >= 2) {
        const timeRanges = parts.slice(1).join(':');
        const slots = timeRanges.includes(',') ? timeRanges.split(',') : [timeRanges];
        newSpecificDates.set(date, {
          date,
          timeSlots: slots,
        });
      }
    } else {
      newSpecificDates.delete(date);
    }
    setSpecificDates(newSpecificDates);
    
    // Remover apenas esta data do estado sujo
    const dateKey = `calendar-${date}`;
    const newDirtyDays = { ...dirtyDays };
    delete newDirtyDays[dateKey];
    setDirtyDays(newDirtyDays);
    
    // Limpar drafts relacionados a esta data
    const newDrafts = { ...timeInputDrafts };
    const newMessages = { ...timeInputMessages };
    Object.keys(newDrafts).forEach(key => {
      if (key.startsWith(`calendar-${date}-`)) {
        delete newDrafts[key];
      }
    });
    Object.keys(newMessages).forEach(key => {
      if (key.startsWith(`calendar-${date}-`)) {
        delete newMessages[key];
      }
    });
    setTimeInputDrafts(newDrafts);
    setTimeInputMessages(newMessages);
    
    // Limpar erros relacionados a esta data
    const newErrors = { ...timeSlotErrors };
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${date}-`)) {
        delete newErrors[key];
      }
    });
    setTimeSlotErrors(newErrors);
  };
  
  // 🔴 VERIFICAR SE HÁ MUDANÇAS NÃO SALVAS
  const hasUnsavedChanges = (): boolean => {
    return Object.keys(dirtyDays).length > 0;
  };
  
  // 🔴 CONFIRMAÇÃO ANTES DE TROCAR DIA/MODO
  const confirmBeforeChange = (action: () => void) => {
    if (hasUnsavedChanges()) {
      const confirmed = window.confirm(
        'Você tem alterações não salvas. Deseja descartar as alterações e continuar?'
      );
      if (confirmed) {
        handleDiscard();
        action();
      }
    } else {
      action();
    }
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

    // 🔴 BLOQUEIO: Confirmar antes de trocar data se há mudanças não salvas
    confirmBeforeChange(() => {
      const newDates = new Map(specificDates);
      if (newDates.has(date)) {
        newDates.delete(date);
        setSelectedDate(null);
      } else {
        newDates.set(date, {
          date,
          timeSlots: ['-'], // 🔴 UX CANÔNICO: Criar intervalo completamente vazio (sem horários pré-definidos)
        });
        setSelectedDate(date);
      }
      setSpecificDates(newDates);
    });
  };

  const updateDateTimeSlots = (date: string, timeSlots: string[]) => {
    // 🔴 ESTADO SUJO: Marcar dia como modificado
    const dayKey = `calendar-${date}`;
    setDirtyDays(prev => ({ ...prev, [dayKey]: true }));
    
    // Validar todos os horários (apenas para exibir avisos, não bloquear)
    const errors: Record<string, string> = {};
    
    for (let i = 0; i < timeSlots.length; i++) {
      const { start, end } = parseTimeRange(timeSlots[i]);
      
      // 🔴 BUGFIX: NÃO validar se campos contêm "--" ou são drafts incompletos
      const hasIncompleteStart = !start || start.trim() === '' || start.includes('--');
      const hasIncompleteEnd = !end || end.trim() === '' || end.includes('--');
      const isDraftIncomplete = hasIncompleteStart || hasIncompleteEnd;
      
      // 🔴 REGRA: Validar APENAS se ambos campos estão completos (sem "--")
      if (isDraftIncomplete) {
        // Campos incompletos: não validar, permitir estado intermediário
        continue;
      }
      
      // Ambos preenchidos: validar (apenas para aviso, não bloquear)
      const validation = validateTimeRange(start, end);
      if (!validation.valid) {
        errors[`${date}-${i}`] = validation.error || 'Horário inválido';
      } else {
        // 🔴 UX ORIENTATIVA: Validar coerência contextual no modo calendário (apenas aviso)
        const contextualError = validateContextualTimeCoherence(`calendar-${date}`, i, start, end);
        if (contextualError) {
          errors[`${date}-${i}`] = contextualError;
        }
      }
    }

    // 🔴 UX CANÔNICO: Avisos são apenas informativos, nunca bloqueiam
      const newErrors = { ...timeSlotErrors };
    
    // Atualizar erros encontrados na validação atual
    Object.keys(errors).forEach(key => {
      newErrors[key] = errors[key];
    });
    
    // 🔴 BUGFIX 1: Limpar erros antigos do mesmo dia quando slots válidos são atualizados
    // Se há slots válidos, limpar erros antigos que não sejam mais válidos
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`${date}-`)) {
        const slotIndex = parseInt(key.split('-').pop() || '', 10);
        if (!isNaN(slotIndex) && timeSlots[slotIndex]) {
          const slot = timeSlots[slotIndex];
          const { start, end } = parseTimeRange(slot);
          const hasIncomplete = !start || start.trim() === '' || start.includes('--') ||
                               !end || end.trim() === '' || end.includes('--');
          // Se o slot está completo e não tem erro na validação atual, limpar erro antigo
          if (!hasIncomplete && !errors[key]) {
            const contextualError = validateContextualTimeCoherence(`calendar-${date}`, slotIndex, start, end);
            if (!contextualError) {
          delete newErrors[key];
            }
          }
        }
        }
      });
    
      setTimeSlotErrors(newErrors);

    // 🔴 UX FECHAMENTO: Atualizar memória local do último end_time por contexto quando slot é confirmado
    for (let i = 0; i < timeSlots.length; i++) {
      const { start, end } = parseTimeRange(timeSlots[i]);
      if (end && end.trim() !== '' && end !== '00:00') {
        const contextKey = `calendar-${date}-${i}`;
        const context = contexts[contextKey];
        if (context) {
          const memoryKey = `calendar-${date}-${context}`;
          setLastEndTimeByContext(prev => ({
            ...prev,
            [memoryKey]: end,
          }));
        }
      }
    }

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
    // 🔴 ESTADO SUJO: Marcar como modificado (períodos de descanso afetam todo o schedule)
    setDirtyDays(prev => ({ ...prev, 'rest': true }));
  };

  const removeRestPeriod = (index: number) => {
    setRestPeriods(restPeriods.filter((_, i) => i !== index));
    // 🔴 ESTADO SUJO: Marcar como modificado
    setDirtyDays(prev => ({ ...prev, 'rest': true }));
  };

  const updateRestPeriod = (index: number, field: 'startDate' | 'endDate' | 'reason', value: string) => {
    const updated = [...restPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setRestPeriods(updated);
    // 🔴 ESTADO SUJO: Marcar como modificado
    setDirtyDays(prev => ({ ...prev, 'rest': true }));

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
      // 🔴 UX CANÔNICO: Criar intervalo inicial completamente vazio (sem horários pré-definidos)
      // Usuário deve definir explicitamente todos os horários
      newSchedule[dayKey] = ['-'];
    }
    updateSchedule(newSchedule, dayKey);
  };

  // 🔴 UX FECHAMENTO: LÓGICA DE HERANÇA DE HORÁRIO POR CONTEXTO (MELHORADA)
  // Esta função calcula o horário inicial baseado no contexto selecionado:
  // 
  // REGRA DE HERANÇA:
  // - Se existe intervalo anterior no mesmo dia com o MESMO contexto
  //   → retorna o endTime do último intervalo daquele contexto (encadeamento)
  // - Se NÃO existe intervalo anterior com esse contexto
  //   → retorna vazio (usuário define explicitamente)
  //
  // EXEMPLOS:
  // - Trabalho 07:00 → 12:00, novo intervalo + Trabalho → inicia em 12:00
  // - Trabalho 07:00 → 12:00, novo intervalo + Lazer → inicia vazio (--:--)
  // - Trabalho + Trabalho + Trabalho → sempre encadeia (herda endTime)
  //
  // IMPORTANTE: Esta é apenas UX orientativa, não regra de backend
  // IMPORTANTE: Contextos diferentes NÃO herdam horário entre si
  const calculateStartTimeByContext = (
    dayKey: string,
    context: 'WORK' | 'LEISURE' | 'STUDY' | null,
    currentIndex: number,
    isCalendarMode: boolean = false
  ): string => {
    // Se não há contexto, retornar vazio (usuário define explicitamente)
    if (!context) return '';

    // 🔴 UX FECHAMENTO: Primeiro tentar usar memória local (mais rápido e confiável)
    const memoryKey = `${dayKey}-${context}`;
    const memoryEndTime = lastEndTimeByContext[memoryKey];
    if (memoryEndTime && memoryEndTime.trim() !== '' && memoryEndTime !== '00:00') {
      return memoryEndTime;
    }

    // Fallback: buscar nos slots existentes
    // Obter slots corretos baseado no modo
    let currentSlots: string[] = [];
    if (isCalendarMode) {
      const date = dayKey.replace('calendar-', '');
      currentSlots = specificDates.get(date)?.timeSlots || [];
    } else {
      currentSlots = schedule[dayKey] || [];
    }

    // Encontrar último intervalo com o mesmo contexto ANTES do índice atual
    // Itera do início até o índice atual, mantendo o último endTime encontrado
    let lastEndTime = ''; // Vazio por padrão (usuário define explicitamente)

    for (let i = 0; i < currentIndex; i++) {
      const contextKey = isCalendarMode 
        ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
        : `${dayKey}-${i}`;
      const slotContext = contexts[contextKey];

      // Se o contexto do slot anterior é o mesmo do contexto selecionado
      // Atualiza lastEndTime (último encontrado é o que importa para encadeamento)
      if (slotContext === context) {
        const slot = currentSlots[i];
        if (slot) {
          const { end } = parseTimeRange(slot);
          if (end && end.trim() !== '' && end !== '00:00') {
            lastEndTime = end; // Atualiza para o último encontrado
            // 🔴 UX CANÔNICO: Limite máximo do dia é 23:59
            // Se já atingiu 23:59, não pode mais herdar (contexto esgotado)
            if (lastEndTime === '23:59') {
              break; // Para a busca, contexto está esgotado
            }
          }
        }
      }
    }

    return lastEndTime;
  };

  // 🔴 UX CANÔNICO: Verificar se um contexto está esgotado (atingiu 23:59)
  // REGRA: Se o último intervalo de um contexto termina em 23:59, esse contexto não pode mais ser selecionado
  // Retorna true se o contexto está esgotado, false caso contrário
  const isContextExhausted = (
    dayKey: string,
    context: 'WORK' | 'LEISURE' | 'STUDY',
    currentIndex: number,
    isCalendarMode: boolean = false
  ): boolean => {
    // 🔴 CORREÇÃO CONCEITUAL: Apenas WORK pode esgotar o dia
    // LEISURE e STUDY são oportunistas e NUNCA esgotam o dia
    if (context !== 'WORK') {
      return false;
    }

    // Obter slots corretos baseado no modo
    let currentSlots: string[] = [];
    if (isCalendarMode) {
      const date = dayKey.replace('calendar-', '');
      currentSlots = specificDates.get(date)?.timeSlots || [];
    } else {
      currentSlots = schedule[dayKey] || [];
    }

    // Verificar se há algum intervalo de WORK que termina em 23:59
    for (let i = 0; i < currentSlots.length; i++) {
      // Pular o slot atual (pode estar sendo editado)
      if (i === currentIndex) continue;
      
      const contextKey = isCalendarMode 
        ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
        : `${dayKey}-${i}`;
      const slotContext = contexts[contextKey];

      // Regra correta: apenas WORK pode esgotar o dia
      if (slotContext === 'WORK') {
        const slot = currentSlots[i];
        if (slot) {
          const { end } = parseTimeRange(slot);
          // Se termina em 23:59, WORK está esgotado para o dia
          if (end === '23:59') {
            return true;
          }
        }
      }
    }

    return false;
  };

  const addTimeSlot = (dayKey: string) => {
    const newSchedule = { ...schedule };
    if (!newSchedule[dayKey]) {
      newSchedule[dayKey] = [];
    }
    // 🔴 UX CANÔNICO: Criar novo intervalo completamente vazio (sem horários pré-definidos)
    // Usuário deve definir explicitamente todos os horários
    const newIndex = newSchedule[dayKey].length;
    newSchedule[dayKey].push('-');
    
    // 🔴 BUGFIX: Resetar explicitamente estado do slot novo
    const newDrafts = { ...timeInputDrafts };
    delete newDrafts[`${dayKey}-${newIndex}-start`];
    delete newDrafts[`${dayKey}-${newIndex}-end`];
    setTimeInputDrafts(newDrafts);
    
    const newMessages = { ...timeInputMessages };
    delete newMessages[`${dayKey}-${newIndex}-start`];
    delete newMessages[`${dayKey}-${newIndex}-end`];
    setTimeInputMessages(newMessages);
    
    const newErrors = { ...timeSlotErrors };
    delete newErrors[`${dayKey}-${newIndex}`];
    
    // 🔴 BUGFIX 1: Limpar erros antigos do mesmo dia quando novo slot é adicionado
    // Novo slot válido indica que o usuário seguiu em frente, limpar erros antigos que não sejam mais válidos
    Object.keys(newErrors).forEach(key => {
      if (key.startsWith(`${dayKey}-`)) {
        // Verificar se o slot relacionado ainda existe e está válido
        const otherIndex = parseInt(key.split('-').pop() || '', 10);
        if (!isNaN(otherIndex) && newSchedule[dayKey]?.[otherIndex]) {
          const otherSlot = newSchedule[dayKey][otherIndex];
          const { start: otherStart, end: otherEnd } = parseTimeRange(otherSlot);
          const otherHasIncomplete = !otherStart || otherStart.trim() === '' || otherStart.includes('--') ||
                                    !otherEnd || otherEnd.trim() === '' || otherEnd.includes('--');
          // Se o outro slot está completo, revalidar e limpar se não houver mais erro
          if (!otherHasIncomplete) {
            const otherContextualError = validateContextualTimeCoherence(dayKey, otherIndex, otherStart, otherEnd);
            if (!otherContextualError) {
              delete newErrors[key];
            }
          }
        } else {
          // Slot não existe mais, limpar erro
          delete newErrors[key];
        }
      }
    });
    
    setTimeSlotErrors(newErrors);
    
    // 🔴 A11Y FIX: Atualizar schedule sem forçar foco programático
    // A navegação por TAB seguirá a ordem natural do DOM
    updateSchedule(newSchedule, dayKey);
    
    // 🔴 BUGFIX: Revalidar todos os slots após adicionar (usa valores atualizados)
    // setTimeout garante que React atualizou o estado antes de revalidar
    // Isso garante que erros antigos não reapareçam e validação use estado correto
    setTimeout(() => {
      const updatedSlots = schedule[dayKey] || [];
      revalidateAllSlotsForDay(dayKey, false, updatedSlots);
    }, 0);
  };

  // 🔴 BUGFIX CRÍTICO: Função utilitária para reindexar objetos keyed por index (modo semanal)
  // Após remover slot, migra índices > removedIndex para (idx - 1)
  const reindexStateByDayKey = (
    state: Record<string, any>,
    dayKey: string,
    removedIndex: number,
    suffix: string = ''
  ): Record<string, any> => {
    const reindexed: Record<string, any> = {};
    const basePrefix = `${dayKey}-`;
    
    Object.keys(state).forEach(key => {
      // Verificar se a chave pertence a este dayKey
      if (key.startsWith(basePrefix)) {
        // Extrair índice da chave (formato: "dayKey-index" ou "dayKey-index-suffix")
        const afterPrefix = key.replace(basePrefix, '');
        const parts = afterPrefix.split('-');
        const idx = parseInt(parts[0], 10);
        
        if (isNaN(idx)) {
          // Não é uma chave indexada, manter como está
          reindexed[key] = state[key];
        } else {
          // Se suffix foi especificado, verificar se a chave tem esse sufixo
          // Se suffix não foi especificado, processar todas as chaves
          const hasExpectedSuffix = !suffix || (parts.length > 1 && parts[parts.length - 1] === suffix);
          
          if (suffix && !hasExpectedSuffix) {
            // Tem sufixo diferente ou não tem sufixo quando esperado - manter como está
            reindexed[key] = state[key];
          } else if (idx < removedIndex) {
            // idx < removedIndex → mantém
            reindexed[key] = state[key];
          } else if (idx === removedIndex) {
            // idx == removedIndex → ignora (slot removido)
            // Não adicionar ao reindexed
          } else {
            // idx > removedIndex → newIdx = idx - 1
            const newIdx = idx - 1;
            // Reconstruir a chave mantendo o sufixo original (se houver)
            const restOfParts = parts.slice(1).join('-');
            const newKey = restOfParts 
              ? `${dayKey}-${newIdx}-${restOfParts}`
              : `${dayKey}-${newIdx}`;
            reindexed[newKey] = state[key];
          }
        }
      } else {
        // Chave não pertence a este dayKey, manter como está
        reindexed[key] = state[key];
      }
    });
    
    return reindexed;
  };

  // 🔴 BUGFIX CRÍTICO: Função utilitária para reindexar objetos keyed por index (modo calendário)
  // Após remover slot, migra índices > removedIndex para (idx - 1)
  // Chaves no formato: "calendar-${date}-${index}" ou "calendar-${date}-${index}-${suffix}"
  const reindexStateByCalendarDate = (
    state: Record<string, any>,
    date: string,
    removedIndex: number,
    suffix: string = ''
  ): Record<string, any> => {
    const reindexed: Record<string, any> = {};
    const basePrefix = `calendar-${date}-`;
    
    Object.keys(state).forEach(key => {
      // Verificar se a chave pertence a esta data
      if (key.startsWith(basePrefix)) {
        // Extrair índice da chave (formato: "calendar-date-index" ou "calendar-date-index-suffix")
        const afterPrefix = key.replace(basePrefix, '');
        const parts = afterPrefix.split('-');
        const idx = parseInt(parts[0], 10);
        
        if (isNaN(idx)) {
          // Não é uma chave indexada, manter como está
          reindexed[key] = state[key];
        } else {
          // Se suffix foi especificado, verificar se a chave tem esse sufixo
          // Se suffix não foi especificado, processar todas as chaves
          const hasExpectedSuffix = !suffix || (parts.length > 1 && parts[parts.length - 1] === suffix);
          
          if (suffix && !hasExpectedSuffix) {
            // Tem sufixo diferente ou não tem sufixo quando esperado - manter como está
            reindexed[key] = state[key];
          } else if (idx < removedIndex) {
            // idx < removedIndex → mantém
            reindexed[key] = state[key];
          } else if (idx === removedIndex) {
            // idx == removedIndex → ignora (slot removido)
            // Não adicionar ao reindexed
          } else {
            // idx > removedIndex → newIdx = idx - 1
            const newIdx = idx - 1;
            // Reconstruir a chave mantendo o sufixo original (se houver)
            const restOfParts = parts.slice(1).join('-');
            const newKey = restOfParts 
              ? `calendar-${date}-${newIdx}-${restOfParts}`
              : `calendar-${date}-${newIdx}`;
            reindexed[newKey] = state[key];
          }
        }
      } else {
        // Chave não pertence a esta data, manter como está
        reindexed[key] = state[key];
      }
    });
    
    return reindexed;
  };

  // 🔴 BUGFIX: Revalidar todos os slots de um dia após add/remove
  // Garante que erros antigos não reapareçam e que validação use estado atual
  // Lê do state atual (já atualizado via setTimeout) para garantir sincronização
  const revalidateAllSlotsForDay = (dayKey: string, isCalendarMode: boolean, currentSlots: string[]) => {
    // Obter modo do dia atual (lê do state atualizado)
    const modeKey = isCalendarMode ? `calendar-${dayKey.replace('calendar-', '')}` : dayKey;
    const currentMode = dayMode[modeKey] || 'FLEXIBLE';
    
    // Revalidar todos os slots
    const revalidatedErrors: Record<string, string> = {};
    for (let i = 0; i < currentSlots.length; i++) {
      const slot = currentSlots[i];
      const { start, end } = parseTimeRange(slot);
      const hasIncomplete = !start || start.trim() === '' || start.includes('--') ||
                           !end || end.trim() === '' || end.includes('--');
      
      if (!hasIncomplete) {
        // Construir errorKey corretamente baseado no modo
        const errorKey = isCalendarMode 
          ? `${dayKey.replace('calendar-', '')}-${i}`
          : `${dayKey}-${i}`;
        // Usar modo atual para validação
        const contextualError = validateContextualTimeCoherence(dayKey, i, start, end, currentMode);
        if (contextualError) {
          // Em FLEXIBLE, converter erros bloqueantes em avisos (não impedir salvar)
          if (currentMode === 'FLEXIBLE' && contextualError.includes('Erro:')) {
            revalidatedErrors[errorKey] = contextualError.replace('Erro:', 'Aviso:');
          } else {
            revalidatedErrors[errorKey] = contextualError;
          }
        }
      }
    }
    
    // Atualizar erros: limpar erros antigos do dia e aplicar novos
    setTimeSlotErrors(prevErrors => {
      const newErrors = { ...prevErrors };
      Object.keys(newErrors).forEach(key => {
        if (isCalendarMode) {
          const date = dayKey.replace('calendar-', '');
          if (key.startsWith(`${date}-`)) {
            delete newErrors[key];
          }
        } else {
          if (key.startsWith(`${dayKey}-`)) {
            delete newErrors[key];
          }
        }
      });
      
      // Aplicar erros revalidados
      if (Object.keys(revalidatedErrors).length > 0) {
        Object.assign(newErrors, revalidatedErrors);
      }
      
      return newErrors;
    });
  };

  // 🔴 BUGFIX 2: Limpar erros e revalidar quando modo do dia muda
  const handleDayModeChange = (dayKey: string, newMode: 'FIXED' | 'FLEXIBLE') => {
    // Determinar se é modo calendário ou semanal
    const isCalendarMode = dayKey.startsWith('calendar-');
    
    // Limpar TODOS os erros daquele dia
    const newErrors = { ...timeSlotErrors };
    Object.keys(newErrors).forEach(key => {
      if (isCalendarMode) {
        // Modo calendário: erro key é `${date}-${index}`
        const date = dayKey.replace('calendar-', '');
        if (key.startsWith(`${date}-`)) {
          delete newErrors[key];
        }
      } else {
        // Modo semanal: erro key é `${dayKey}-${index}`
        if (key.startsWith(`${dayKey}-`)) {
          delete newErrors[key];
        }
      }
    });
    setTimeSlotErrors(newErrors);
    
    // Revalidar todos os slots do dia com o novo modo
    let currentSlots: string[] = [];
    
    if (isCalendarMode) {
      const date = dayKey.replace('calendar-', '');
      currentSlots = specificDates.get(date)?.timeSlots || [];
    } else {
      currentSlots = schedule[dayKey] || [];
    }
    
    // Revalidar cada slot
    const revalidatedErrors: Record<string, string> = {};
    for (let i = 0; i < currentSlots.length; i++) {
      const slot = currentSlots[i];
      const { start, end } = parseTimeRange(slot);
      const hasIncomplete = !start || start.trim() === '' || start.includes('--') ||
                           !end || end.trim() === '' || end.includes('--');
      
      if (!hasIncomplete) {
        // Construir errorKey corretamente baseado no modo
        const errorKey = isCalendarMode 
          ? `${dayKey.replace('calendar-', '')}-${i}`
          : `${dayKey}-${i}`;
        // 🔴 BUGFIX: Passar newMode diretamente para evitar ler state antigo (React async)
        const contextualError = validateContextualTimeCoherence(dayKey, i, start, end, newMode);
        if (contextualError) {
          // Em FLEXIBLE, converter erros bloqueantes em avisos (não impedir salvar)
          if (newMode === 'FLEXIBLE' && contextualError.includes('Erro:')) {
            // Manter como aviso, não como erro bloqueante
            revalidatedErrors[errorKey] = contextualError.replace('Erro:', 'Aviso:');
          } else {
            revalidatedErrors[errorKey] = contextualError;
          }
        }
      }
    }
    
    // Atualizar erros revalidados
    if (Object.keys(revalidatedErrors).length > 0) {
      setTimeSlotErrors({ ...newErrors, ...revalidatedErrors });
    }
  };

  const removeTimeSlot = (dayKey: string, index: number) => {
    // Remover slot do schedule primeiro
    const newSchedule = { ...schedule };
    if (newSchedule[dayKey]) {
      newSchedule[dayKey] = newSchedule[dayKey].filter((_, i) => i !== index);
      if (newSchedule[dayKey].length === 0) {
        delete newSchedule[dayKey];
      }
    }
    
    // 🔴 BUGFIX CRÍTICO: Reindexar TODOS os estados keyed por index
    // Processar todas as chaves de uma vez (sem sufixo específico)
    // contexts: "dayKey-index"
    const reindexedContexts = reindexStateByDayKey(contexts, dayKey, index);
    setContexts(reindexedContexts);
    
    // timeInputDrafts: "dayKey-index-start" e "dayKey-index-end"
    // Processar sem sufixo para capturar ambos
    const reindexedDrafts = reindexStateByDayKey(timeInputDrafts, dayKey, index);
    setTimeInputDrafts(reindexedDrafts);
    
    // timeInputMessages: "dayKey-index-start" e "dayKey-index-end"
    // Processar sem sufixo para capturar ambos
    const reindexedMessages = reindexStateByDayKey(timeInputMessages, dayKey, index);
    setTimeInputMessages(reindexedMessages);
    
    // timeSlotErrors: "dayKey-index"
    const reindexedErrors = reindexStateByDayKey(timeSlotErrors, dayKey, index);
    setTimeSlotErrors(reindexedErrors);
    
    updateSchedule(newSchedule, dayKey);
    
    // 🔴 BUGFIX: Revalidar todos os slots após remoção (usa valores atualizados)
    // setTimeout garante que React atualizou o estado antes de revalidar
    // Isso garante que erros antigos não reapareçam e validação use estado correto
    setTimeout(() => {
      const updatedSlots = schedule[dayKey] || [];
      revalidateAllSlotsForDay(dayKey, false, updatedSlots);
    }, 0);
  };

  // 🔴 UX FIX: Atualizar draft durante digitação (sem validação)
  const updateTimeInputDraft = (dayKey: string, index: number, field: 'start' | 'end', value: string) => {
    const draftKey = `${dayKey}-${index}-${field}`;
    setTimeInputDrafts(prev => ({ ...prev, [draftKey]: value }));
  };

  // 🔴 VALIDAÇÃO INCREMENTAL: Continuidade temporal APENAS para mesmo contexto
  // Valida que start[n] >= end[n-1] quando o contexto é o mesmo
  // Esta validação é incremental (onChange) e apenas informativa (UX)
  const validateTemporalContinuity = (dayKey: string, index: number, startValue: string): string | null => {
    // Se não há valor ou está incompleto, não validar
    if (!startValue || startValue.trim() === '' || startValue.includes('--')) {
      return null;
    }

    // Normalizar o valor para comparar
    const normalized = normalizeTimeValue(startValue);
    if (!normalized) {
      return null; // Formato inválido, deixar outra validação tratar
    }

    // Verificar se há contexto definido
    const contextKey = `${dayKey}-${index}`;
    const context = contexts[contextKey];
    if (!context) {
      return null; // Sem contexto, não validar continuidade
    }

    // Determinar se é modo calendário ou semanal
    const isCalendarMode = dayKey.startsWith('calendar-');
    let currentSlots: string[] = [];
    
    if (isCalendarMode) {
      const date = dayKey.replace('calendar-', '');
      currentSlots = specificDates.get(date)?.timeSlots || [];
    } else {
      currentSlots = schedule[dayKey] || [];
    }

    // Procurar slot anterior com o MESMO CONTEXTO
    let lastSameContextEnd: string | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const prevContextKey = isCalendarMode 
        ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
        : `${dayKey}-${i}`;
      const prevContext = contexts[prevContextKey];
      
      // Se encontrou slot anterior com o mesmo contexto
      if (prevContext === context) {
        const prevSlot = currentSlots[i];
        if (prevSlot) {
          const { end: prevEnd } = parseTimeRange(prevSlot);
          if (prevEnd && prevEnd.trim() !== '' && !prevEnd.includes('--')) {
            lastSameContextEnd = prevEnd;
            break;
          }
        }
      }
    }

    // Se não há slot anterior do mesmo contexto, não validar
    if (!lastSameContextEnd) {
      return null;
    }

    // Converter para minutos para comparar
    const timeToMinutes = (time: string): number => {
      if (!time) return 0;
      const [hour, min] = time.split(':').map(Number);
      return hour * 60 + min;
    };

    const startMinutes = timeToMinutes(normalized);
    const lastEndMinutes = timeToMinutes(lastSameContextEnd);

    // Se start < end anterior (mesmo contexto), retornar erro
    if (startMinutes < lastEndMinutes) {
      return `Para o mesmo tipo de atividade, o horário precisa começar a partir de ${lastSameContextEnd}.`;
    }

    return null;
  };

  // 🔴 REWRITE CONTROLADO: Persistir valor normalizado no onBlur
  // REGRA OBRIGATÓRIA: Fluxo de commit conforme especificação
  // NÃO COMMITAR DRAFT-ONLY
  const commitTimeInput = (dayKey: string, index: number, field: 'start' | 'end', rawValue: string) => {
    const draftKey = `${dayKey}-${index}-${field}`;
    const messageKey = `${dayKey}-${index}-${field}`;
    
    // 🔴 INSTRUMENTAÇÃO: Log temporário para debug (apenas em dev)
    if (import.meta.env.DEV) {
      console.log('[TIME BLUR]', { field, rawValue, dayKey, index });
    }
    
    // 1) Normalizar valor raw do input
    const normalized = normalizeTimeValue(rawValue);
    
    // 🔴 INSTRUMENTAÇÃO: Log após normalização
    if (import.meta.env.DEV) {
      console.log('[TIME BLUR] normalized', { rawValue, normalized });
    }
    
    // 2) CASO rawValue seja "" ou "--:--"
    if (!rawValue || rawValue.trim() === '' || rawValue === '--:--') {
      // setTimeInputDrafts(KEY+FIELD) = "00:00"
      setTimeInputDrafts({
        ...timeInputDrafts,
        [draftKey]: '00:00',
      });
      // setTimeInputMessages(KEY+FIELD) = "Ajuste se necessário"
      setTimeInputMessages({
        ...timeInputMessages,
        [messageKey]: 'Ajuste se necessário',
      });
      // RETURN IMEDIATO (sem updateTimeSlot)
      return;
    }
    
    // 3) CASO normalized seja null (formato inválido)
    if (normalized === null) {
      // manter draft como está
      // set mensagem "Formato inválido (HH:MM)"
      setTimeInputMessages({
        ...timeInputMessages,
        [messageKey]: 'Formato inválido (HH:MM)',
      });
      // RETURN (sem commit)
      return;
    }
    
    // 4) CASO normalized seja válido (ex: "07:00", "12:30")
    // limpar mensagem do campo
    const newMessages = { ...timeInputMessages };
    delete newMessages[messageKey];
    setTimeInputMessages(newMessages);
    
    // limpar draft do campo
    const newDrafts = { ...timeInputDrafts };
    delete newDrafts[draftKey];
    setTimeInputDrafts(newDrafts);

    // Obter valores atuais do schedule
    const currentSlot = schedule[dayKey]?.[index];
    if (!currentSlot) return;
    
    const { start: currentStart, end: currentEnd } = parseTimeRange(currentSlot);
    const newStart = field === 'start' ? normalized : currentStart;
    const newEnd = field === 'end' ? normalized : currentEnd;

    // 🔴 VALIDAÇÃO INCREMENTAL: Validar continuidade temporal no onBlur também (campo start)
    if (field === 'start' && normalized) {
      const continuityError = validateTemporalContinuity(dayKey, index, normalized);
      const errorKey = `${dayKey}-${index}`;
      const newErrors = { ...timeSlotErrors };
      
      if (continuityError) {
        newErrors[errorKey] = continuityError;
      } else {
        // Se não há erro de continuidade, verificar se há outros erros
        const hasOtherError = newErrors[errorKey] && !newErrors[errorKey].includes('Para o mesmo tipo de atividade');
        if (!hasOtherError) {
          delete newErrors[errorKey];
        }
      }
      setTimeSlotErrors(newErrors);
    }

    // COMMITAR no slot (a validação start<end será feita em updateTimeSlot)
    // que já verifica se campos contêm "--" antes de validar
    const timeRange = formatTimeRange(newStart, newEnd);
    updateTimeSlot(dayKey, index, timeRange);
    
    // 🔴 UX FECHAMENTO: Atualizar memória local do último end_time por contexto
    if (field === 'end' && normalized && normalized.trim() !== '' && normalized !== '00:00') {
      const contextKey = `${dayKey}-${index}`;
      const context = contexts[contextKey];
      if (context) {
        const memoryKey = `${dayKey}-${context}`;
        setLastEndTimeByContext({
          ...lastEndTimeByContext,
          [memoryKey]: normalized,
        });
      }
    }
  };

  // 🔴 REWRITE CONTROLADO: Persistir valor normalizado no onBlur (modo calendário)
  // Mesma lógica do commitTimeInput mas adaptada para modo calendário
  // REGRA OBRIGATÓRIA: Fluxo de commit conforme especificação
  // NÃO COMMITAR DRAFT-ONLY
  const commitTimeInputCalendar = (date: string, index: number, field: 'start' | 'end', rawValue: string) => {
    const dayKey = `calendar-${date}`;
    const draftKey = `${dayKey}-${index}-${field}`;
    const messageKey = `${dayKey}-${index}-${field}`;
    
    // 🔴 INSTRUMENTAÇÃO: Log temporário para debug (apenas em dev)
    if (import.meta.env.DEV) {
      console.log('[TIME BLUR CALENDAR]', { field, rawValue, date, index });
    }
    
    // 1) Normalizar valor raw do input
    const normalized = normalizeTimeValue(rawValue);
    
    // 🔴 INSTRUMENTAÇÃO: Log após normalização
    if (import.meta.env.DEV) {
      console.log('[TIME BLUR CALENDAR] normalized', { rawValue, normalized });
    }
    
    // 2) CASO rawValue seja "" ou "--:--"
    if (!rawValue || rawValue.trim() === '' || rawValue === '--:--') {
      // setTimeInputDrafts(KEY+FIELD) = "00:00"
      setTimeInputDrafts({
        ...timeInputDrafts,
        [draftKey]: '00:00',
      });
      // setTimeInputMessages(KEY+FIELD) = "Ajuste se necessário"
      setTimeInputMessages({
        ...timeInputMessages,
        [messageKey]: 'Ajuste se necessário',
      });
      // RETURN IMEDIATO (sem updateDateTimeSlots)
      return;
    }
    
    // 3) CASO normalized seja null (formato inválido)
    if (normalized === null) {
      // manter draft como está
      // set mensagem "Formato inválido (HH:MM)"
      setTimeInputMessages({
        ...timeInputMessages,
        [messageKey]: 'Formato inválido (HH:MM)',
      });
      // RETURN (sem commit)
      return;
    }
    
    // 4) CASO normalized seja válido (ex: "07:00", "12:30")
    // limpar mensagem do campo
    const newMessages = { ...timeInputMessages };
    delete newMessages[messageKey];
    setTimeInputMessages(newMessages);
    
    // limpar draft do campo
    const newDrafts = { ...timeInputDrafts };
    delete newDrafts[draftKey];
    setTimeInputDrafts(newDrafts);
    
    // Obter valores atuais do schedule
    const currentSlots = specificDates.get(date)?.timeSlots || [];
    const currentSlot = currentSlots[index];
    if (!currentSlot) return;
    
    const { start: currentStart, end: currentEnd } = parseTimeRange(currentSlot);
    const newStart = field === 'start' ? normalized : currentStart;
    const newEnd = field === 'end' ? normalized : currentEnd;

    // 🔴 VALIDAÇÃO INCREMENTAL: Validar continuidade temporal no onBlur também (campo start)
    if (field === 'start' && normalized) {
      const continuityError = validateTemporalContinuity(`calendar-${date}`, index, normalized);
      const errorKey = `${date}-${index}`;
      const newErrors = { ...timeSlotErrors };
      
      if (continuityError) {
        newErrors[errorKey] = continuityError;
      } else {
        // Se não há erro de continuidade, verificar se há outros erros
        const hasOtherError = newErrors[errorKey] && !newErrors[errorKey].includes('Para o mesmo tipo de atividade');
        if (!hasOtherError) {
          delete newErrors[errorKey];
        }
      }
      setTimeSlotErrors(newErrors);
    }

    // COMMITAR no slot (a validação start<end será feita em updateDateTimeSlots)
    // que já verifica se campos contêm "--" antes de validar
    const newSlots = [...currentSlots];
    newSlots[index] = formatTimeRange(newStart, newEnd);
    updateDateTimeSlots(date, newSlots);
    
    // 🔴 UX FECHAMENTO: Atualizar memória local do último end_time por contexto
    if (field === 'end' && normalized && normalized.trim() !== '' && normalized !== '00:00') {
      const contextKey = `${dayKey}-${index}`;
      const context = contexts[contextKey];
      if (context) {
        const memoryKey = `${dayKey}-${context}`;
        setLastEndTimeByContext({
          ...lastEndTimeByContext,
          [memoryKey]: normalized,
        });
      }
    }
  };

  // 🔴 UX FIX: Limpar apenas erros contextuais (não erros de formato básico)
  const clearContextualErrors = (errorKey: string) => {
    const currentError = timeSlotErrors[errorKey];
    
    // Se não há erro, não fazer nada
    if (!currentError) return;
    
    // Verificar se o erro é contextual (contém palavras-chave)
    const isContextualError = 
      currentError.includes('Horário incoerente') ||
      currentError.includes('contexto de Trabalho') ||
      currentError.includes('Aviso: horário sobrepõe') ||
      currentError.includes('não podem se sobrepor');
    
    // Se é erro contextual, limpar
    if (isContextualError) {
      const newErrors = { ...timeSlotErrors };
      delete newErrors[errorKey];
      setTimeSlotErrors(newErrors);
    }
  };

  // 🔴 UX FIX: Validar coerência com contexto específico (para uso imediato no onChange)
  const validateContextualCoherenceWithContext = (
    dayKey: string, 
    index: number, 
    start: string, 
    end: string,
    context: 'WORK' | 'LEISURE' | 'STUDY' | null,
    isCalendarMode: boolean = false
  ): string | null => {
    // Se não há contexto, não validar
    if (!context) return null;
    
    // Obter modo do dia (default: FLEXIBLE)
    // No modo calendário, a chave é "calendar-${date}", no modo semanal é apenas "dayKey"
    const modeKey = isCalendarMode ? `calendar-${dayKey.replace('calendar-', '')}` : dayKey;
    const mode = dayMode[modeKey] || 'FLEXIBLE';
    
    // Helper para converter tempo em minutos
    const timeToMinutes = (time: string): number => {
      if (!time) return 0;
      const [hour, min] = time.split(':').map(Number);
      return hour * 60 + min;
    };
    
    // Helper para verificar sobreposição
    const hasOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
      const s1 = timeToMinutes(start1);
      const e1 = timeToMinutes(end1);
      const s2 = timeToMinutes(start2);
      const e2 = timeToMinutes(end2);
      return !(e1 <= s2 || e2 <= s1);
    };
    
    // Obter slots corretos baseado no modo
    let currentSlots: string[] = [];
    if (isCalendarMode) {
      const date = dayKey.replace('calendar-', '');
      currentSlots = specificDates.get(date)?.timeSlots || [];
    } else {
      currentSlots = schedule[dayKey] || [];
    }
    
    // 🔴 VALIDAÇÃO INTRA-CONTEXTO: Slots do mesmo contexto NUNCA podem se sobrepor
    // Esta é uma regra estrutural/temporal, independente de FIXED ou FLEXIBLE
    for (let i = 0; i < currentSlots.length; i++) {
      if (i === index) continue; // Pular o slot atual
      
      const otherContextKey = isCalendarMode 
        ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
        : `${dayKey}-${i}`;
      const otherContext = contexts[otherContextKey];
      
      // Verificar apenas slots do MESMO contexto
      if (otherContext === context) {
        const otherSlot = currentSlots[i];
        if (otherSlot) {
          const { start: otherStart, end: otherEnd } = parseTimeRange(otherSlot);
          // Verificar se o outro slot está completo antes de validar
          const otherHasIncomplete = !otherStart || otherStart.trim() === '' || otherStart.includes('--') ||
                                    !otherEnd || otherEnd.trim() === '' || otherEnd.includes('--');
          if (!otherHasIncomplete) {
            // Verificar sobreposição usando função existente
            if (hasOverlap(start, end, otherStart, otherEnd)) {
              // Retornar erro específico por contexto
              const contextName = context === 'WORK' 
                ? 'Trabalho' 
                : context === 'STUDY' 
                  ? 'Estudo' 
                  : 'Lazer e Cuidados Pessoais';
              return `Erro: dois horários de ${contextName} não podem se sobrepor.`;
            }
          }
        }
      }
    }
    
    // 🔴 MODO POR DIA: Lógica diferente para FIXED vs FLEXIBLE
    if (mode === 'FIXED') {
      // FIXED: WORK bloqueia TODOS os outros contextos
    if (context === 'WORK') {
        // WORK valida apenas contra outros WORK (ordem temporal)
        let lastSameContextEnd: string | null = null;
        for (let i = index - 1; i >= 0; i--) {
          const contextKey = isCalendarMode 
            ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
            : `${dayKey}-${i}`;
          const slotContext = contexts[contextKey];
          if (slotContext === 'WORK') {
            const slot = currentSlots[i];
            if (slot) {
              const { end: prevEnd } = parseTimeRange(slot);
              if (prevEnd && prevEnd.trim() !== '') {
                lastSameContextEnd = prevEnd;
                break;
              }
            }
          }
        }
        if (lastSameContextEnd) {
          const startMinutes = timeToMinutes(start);
          const lastEndMinutes = timeToMinutes(lastSameContextEnd);
          if (startMinutes < lastEndMinutes) {
            return `Horário incoerente: em contexto de Trabalho, o início (${start}) não pode ser antes do fim do intervalo anterior (${lastSameContextEnd})`;
          }
        }
      } else {
        // LEISURE/STUDY: verificar sobreposição com WORK (erro em FIXED)
        for (let i = 0; i < currentSlots.length; i++) {
          if (i === index) continue;
          const contextKey = isCalendarMode 
            ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
            : `${dayKey}-${i}`;
          const slotContext = contexts[contextKey];
          if (slotContext === 'WORK') {
            const slot = currentSlots[i];
            if (slot) {
              const { start: prevStart, end: prevEnd } = parseTimeRange(slot);
              if (hasOverlap(start, end, prevStart, prevEnd)) {
                return `Erro: em dia com horário fixo, ${context === 'LEISURE' ? 'Lazer e Cuidados Pessoais' : 'Estudo'} não pode sobrepor Trabalho (${prevStart}-${prevEnd})`;
              }
            }
          }
        }
      }
    } else {
      // FLEXIBLE: WORK só bloqueia WORK, LEISURE/STUDY nunca bloqueiam
      if (context === 'WORK') {
        // WORK valida apenas contra outros WORK (ordem temporal)
        let lastSameContextEnd: string | null = null;
        for (let i = index - 1; i >= 0; i--) {
          const contextKey = isCalendarMode 
            ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
            : `${dayKey}-${i}`;
          const slotContext = contexts[contextKey];
          if (slotContext === 'WORK') {
            const slot = currentSlots[i];
            if (slot) {
              const { end: prevEnd } = parseTimeRange(slot);
              if (prevEnd && prevEnd.trim() !== '') {
                lastSameContextEnd = prevEnd;
                break;
              }
            }
          }
        }
        if (lastSameContextEnd) {
          const startMinutes = timeToMinutes(start);
          const lastEndMinutes = timeToMinutes(lastSameContextEnd);
          if (startMinutes < lastEndMinutes) {
            return `Horário incoerente: em contexto de Trabalho, o início (${start}) não pode ser antes do fim do intervalo anterior (${lastSameContextEnd})`;
          }
        }
      }
      // LEISURE/STUDY: nunca bloqueiam em FLEXIBLE (apenas aviso se quiser)
    }
    
    return null;
  };

  // ⚠️ REGRA CANÔNICA — AGENDA DECLARATIVA (UX)
  // Este componente define APENAS disponibilidade declarativa.
  // Configurar horários NÃO significa aceitar compromissos.
  // Nenhum bloqueio real ocorre aqui.
  // Bloqueios reais só acontecem após decisão humana explícita
  // registrada via evento/ledger no backend (fora deste componente).

  // 🔴 BUGFIX: Validar coerência temporal baseada em contexto
  // REGRA: NÃO validar se start ou end contém "--" (draft incompleto)
  const validateContextualTimeCoherence = (dayKey: string, index: number, start: string, end: string, modeOverride?: 'FIXED' | 'FLEXIBLE'): string | null => {
    const contextKey = `${dayKey}-${index}`;
    const context = contexts[contextKey];
    
    // Se não há contexto, não validar
    if (!context) return null;
    
    // 🔴 BUGFIX: NÃO validar se campos contêm "--" ou são drafts incompletos
    const hasIncompleteStart = !start || start.trim() === '' || start.includes('--');
    const hasIncompleteEnd = !end || end.trim() === '' || end.includes('--');
    if (hasIncompleteStart || hasIncompleteEnd) {
      return null; // Não validar enquanto campos estão incompletos
    }
    
    // Obter modo do dia (default: FLEXIBLE)
    // Se modeOverride for fornecido, usar ele (evita ler state antigo)
    // Caso contrário, ler do state (comportamento padrão)
    const isCalendarMode = dayKey.startsWith('calendar-');
    const modeKey = isCalendarMode ? `calendar-${dayKey.replace('calendar-', '')}` : dayKey;
    const mode = modeOverride !== undefined ? modeOverride : (dayMode[modeKey] || 'FLEXIBLE');
    
    // Helper para converter tempo em minutos
    const timeToMinutes = (time: string): number => {
      if (!time) return 0;
      const [hour, min] = time.split(':').map(Number);
      return hour * 60 + min;
    };
    
    // Helper para verificar sobreposição
    const hasOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
      const s1 = timeToMinutes(start1);
      const e1 = timeToMinutes(end1);
      const s2 = timeToMinutes(start2);
      const e2 = timeToMinutes(end2);
      return !(e1 <= s2 || e2 <= s1);
    };
    
    // Determinar se é modo calendário ou semanal (já declarado acima)
    let currentSlots: string[] = [];
    
    if (isCalendarMode) {
      // Modo calendário: extrair data da chave
      const date = dayKey.replace('calendar-', '');
      currentSlots = specificDates.get(date)?.timeSlots || [];
    } else {
      // Modo semanal
      currentSlots = schedule[dayKey] || [];
    }
    
    // 🔴 VALIDAÇÃO INTRA-CONTEXTO: Slots do mesmo contexto NUNCA podem se sobrepor
    // Esta é uma regra estrutural/temporal, independente de FIXED ou FLEXIBLE
    for (let i = 0; i < currentSlots.length; i++) {
      if (i === index) continue; // Pular o slot atual
      
      const otherContextKey = isCalendarMode 
        ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
        : `${dayKey}-${i}`;
      const otherContext = contexts[otherContextKey];
      
      // Verificar apenas slots do MESMO contexto
      if (otherContext === context) {
        const otherSlot = currentSlots[i];
        if (otherSlot) {
          const { start: otherStart, end: otherEnd } = parseTimeRange(otherSlot);
          // Verificar se o outro slot está completo antes de validar
          const otherHasIncomplete = !otherStart || otherStart.trim() === '' || otherStart.includes('--') ||
                                    !otherEnd || otherEnd.trim() === '' || otherEnd.includes('--');
          if (!otherHasIncomplete) {
            // Verificar sobreposição usando função existente
            if (hasOverlap(start, end, otherStart, otherEnd)) {
              // Retornar erro específico por contexto
              const contextName = context === 'WORK' 
                ? 'Trabalho' 
                : context === 'STUDY' 
                  ? 'Estudo' 
                  : 'Lazer e Cuidados Pessoais';
              return `Erro: dois horários de ${contextName} não podem se sobrepor.`;
            }
          }
        }
      }
    }
    
    // 🔴 MODO POR DIA: Lógica diferente para FIXED vs FLEXIBLE
    if (mode === 'FIXED') {
      // FIXED: WORK bloqueia TODOS os outros contextos
      if (context === 'WORK') {
        // WORK valida apenas contra outros WORK (ordem temporal)
        let lastSameContextEnd: string | null = null;
        for (let i = index - 1; i >= 0; i--) {
          const prevContextKey = isCalendarMode 
            ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
            : `${dayKey}-${i}`;
          const slotContext = contexts[prevContextKey];
          if (slotContext === 'WORK') {
            const slot = currentSlots[i];
            if (slot) {
              const { end: prevEnd } = parseTimeRange(slot);
              if (prevEnd && prevEnd.trim() !== '') {
                lastSameContextEnd = prevEnd;
                break;
              }
            }
          }
        }
        if (lastSameContextEnd) {
          const startMinutes = timeToMinutes(start);
          const lastEndMinutes = timeToMinutes(lastSameContextEnd);
          if (startMinutes < lastEndMinutes) {
            return `Horário incoerente: em contexto de Trabalho, o início (${start}) não pode ser antes do fim do intervalo anterior (${lastSameContextEnd})`;
          }
        }
      } else {
        // LEISURE/STUDY: verificar sobreposição com WORK (erro em FIXED)
        for (let i = 0; i < currentSlots.length; i++) {
          if (i === index) continue;
          const prevContextKey = isCalendarMode 
            ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
            : `${dayKey}-${i}`;
          const slotContext = contexts[prevContextKey];
          if (slotContext === 'WORK') {
            const slot = currentSlots[i];
            if (slot) {
              const { start: prevStart, end: prevEnd } = parseTimeRange(slot);
              if (hasOverlap(start, end, prevStart, prevEnd)) {
                return `Erro: em dia com horário fixo, ${context === 'LEISURE' ? 'Lazer e Cuidados Pessoais' : 'Estudo'} não pode sobrepor Trabalho (${prevStart}-${prevEnd})`;
              }
            }
          }
        }
      }
    } else {
      // FLEXIBLE: WORK só bloqueia WORK, LEISURE/STUDY nunca bloqueiam
      if (context === 'WORK') {
        // WORK valida apenas contra outros WORK (ordem temporal)
        let lastSameContextEnd: string | null = null;
        for (let i = index - 1; i >= 0; i--) {
          const prevContextKey = isCalendarMode 
            ? `calendar-${dayKey.replace('calendar-', '')}-${i}`
            : `${dayKey}-${i}`;
          const slotContext = contexts[prevContextKey];
          if (slotContext === 'WORK') {
            const slot = currentSlots[i];
            if (slot) {
              const { end: prevEnd } = parseTimeRange(slot);
              if (prevEnd && prevEnd.trim() !== '') {
                lastSameContextEnd = prevEnd;
                break;
              }
            }
          }
        }
        if (lastSameContextEnd) {
          const startMinutes = timeToMinutes(start);
          const lastEndMinutes = timeToMinutes(lastSameContextEnd);
          if (startMinutes < lastEndMinutes) {
            return `Horário incoerente: em contexto de Trabalho, o início (${start}) não pode ser antes do fim do intervalo anterior (${lastSameContextEnd})`;
          }
        }
      }
      // LEISURE/STUDY: nunca bloqueiam em FLEXIBLE
    }
    
    return null;
  };

  const updateTimeSlot = (dayKey: string, index: number, timeRange: string) => {
    // Validar intervalo de horário (apenas para exibir avisos, não bloquear)
    const { start, end } = parseTimeRange(timeRange);
    
    // 🔴 BUGFIX: NÃO validar se campos contêm "--" ou são drafts incompletos
    const hasIncompleteStart = !start || start.trim() === '' || start.includes('--');
    const hasIncompleteEnd = !end || end.trim() === '' || end.includes('--');
    const isDraftIncomplete = hasIncompleteStart || hasIncompleteEnd;
    
    const errorKey = `${dayKey}-${index}`;
    const newErrors = { ...timeSlotErrors };
    
    // 🔴 REGRA: Validação APENAS se ambos campos estão completos (sem "--")
    if (!isDraftIncomplete && end && end.trim() !== '') {
      const validation = validateTimeRange(start, end);
      
      if (!validation.valid) {
        newErrors[errorKey] = validation.error || 'Horário inválido';
        setTimeSlotErrors(newErrors);
        // 🔴 UX CANÔNICO: Avisos são apenas informativos, nunca bloqueiam
        // Continuar atualização mesmo com erro (usuário pode corrigir depois)
      } else {
        // Remover erro de formato se validação passou
        delete newErrors[errorKey];
      }
    } else {
      // 🔴 BUGFIX: Se campos estão incompletos, limpar erros de ordem
      delete newErrors[errorKey];
    }

    // 🔴 UX ORIENTATIVA: Validar coerência contextual (apenas aviso)
    // APENAS se ambos campos estão completos
    if (!isDraftIncomplete) {
    const contextualError = validateContextualTimeCoherence(dayKey, index, start, end);
    if (contextualError) {
      newErrors[errorKey] = contextualError;
      } else if (!newErrors[errorKey]) {
        // Remover erro se não há erro contextual e não há erro de formato
      delete newErrors[errorKey];
      }
    }

    setTimeSlotErrors(newErrors);
    
    // 🔴 UX CANÔNICO: Sempre atualizar, avisos são apenas informativos
    const newSchedule = { ...schedule };
    if (newSchedule[dayKey]) {
      newSchedule[dayKey][index] = timeRange;
    }
    
    // 🔴 BUGFIX 1: Limpar erros antigos do mesmo dia quando slot válido é atualizado
    // Se o slot atual está válido (sem erro), limpar erros antigos do mesmo dia que não sejam mais válidos
    if (!newErrors[errorKey] && !isDraftIncomplete) {
      const cleanedErrors = { ...newErrors };
      // Limpar todos os erros do mesmo dia que não sejam do slot atual
      Object.keys(cleanedErrors).forEach(key => {
        if (key.startsWith(`${dayKey}-`) && key !== errorKey) {
          // Verificar se o slot relacionado ainda existe e está válido
          const otherIndex = parseInt(key.split('-').pop() || '', 10);
          if (!isNaN(otherIndex) && newSchedule[dayKey]?.[otherIndex]) {
            const otherSlot = newSchedule[dayKey][otherIndex];
            const { start: otherStart, end: otherEnd } = parseTimeRange(otherSlot);
            const otherHasIncomplete = !otherStart || otherStart.trim() === '' || otherStart.includes('--') ||
                                      !otherEnd || otherEnd.trim() === '' || otherEnd.includes('--');
            // Se o outro slot está completo, revalidar e limpar se não houver mais erro
            if (!otherHasIncomplete) {
              const otherContextualError = validateContextualTimeCoherence(dayKey, otherIndex, otherStart, otherEnd);
              if (!otherContextualError) {
                delete cleanedErrors[key];
              }
            }
          } else {
            // Slot não existe mais, limpar erro
            delete cleanedErrors[key];
          }
        }
      });
      setTimeSlotErrors(cleanedErrors);
    }
    
    // 🔴 UX FECHAMENTO: Atualizar memória local do último end_time por contexto quando slot é confirmado
    if (end && end.trim() !== '' && end !== '00:00') {
      const contextKey = `${dayKey}-${index}`;
      const context = contexts[contextKey];
      if (context) {
        const memoryKey = `${dayKey}-${context}`;
        setLastEndTimeByContext(prev => ({
          ...prev,
          [memoryKey]: end,
        }));
      }
    }
    
    updateSchedule(newSchedule, dayKey);
  };

  const parseTimeRange = (range: string): { start: string; end: string } => {
    const [start, end] = range.split('-');
    // 🔴 UX CANÔNICO: Retornar strings vazias quando não há valores (não usar defaults)
    return { start: start || '', end: end || '' };
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

    // 🔴 Marcar todos os dias modificados como sujos
    const allDays = Object.keys(newSchedule);
    const newDirtyDays: Record<string, boolean> = {};
    allDays.forEach(day => {
      newDirtyDays[day] = true;
    });
    setDirtyDays(prev => ({ ...prev, ...newDirtyDays }));
    setSchedule(newSchedule);
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
            {/* 🔴 MODO POR DIA: Pergunta sobre horário fixo (modo calendário) */}
            <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <span>Neste dia, seu horário de trabalho é fixo ou flexível?</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                  <input
                    type="radio"
                    name={`day-mode-calendar-${selectedDate}`}
                    checked={dayMode[`calendar-${selectedDate}`] === 'FIXED'}
                    onChange={() => {
                      const dayKey = `calendar-${selectedDate}`;
                      const newMode: Record<string, 'FIXED' | 'FLEXIBLE'> = { ...dayMode, [dayKey]: 'FIXED' };
                      setDayMode(newMode);
                      handleDayModeChange(dayKey, 'FIXED');
                    }}
                  />
                  <span>Fixo</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                  <input
                    type="radio"
                    name={`day-mode-calendar-${selectedDate}`}
                    checked={dayMode[`calendar-${selectedDate}`] === 'FLEXIBLE' || dayMode[`calendar-${selectedDate}`] === undefined}
                    onChange={() => {
                      const dayKey = `calendar-${selectedDate}`;
                      const newMode: Record<string, 'FIXED' | 'FLEXIBLE'> = { ...dayMode, [dayKey]: 'FLEXIBLE' };
                      setDayMode(newMode);
                      handleDayModeChange(dayKey, 'FLEXIBLE');
                    }}
                  />
                  <span>Flexível</span>
                </label>
              </label>
            </div>
            {specificDates.get(selectedDate)?.timeSlots.map((slot, index) => {
              const { start, end } = parseTimeRange(slot);
              const errorKey = `${selectedDate}-${index}`;
              const hasError = !!timeSlotErrors[errorKey];
              
              // 🔴 UX FIX: Usar draft se existir, senão usar valor do schedule
              const calendarStartDraftKey = `calendar-${selectedDate}-${index}-start`;
              const calendarEndDraftKey = `calendar-${selectedDate}-${index}-end`;
              const calendarStartValue = timeInputDrafts[calendarStartDraftKey] !== undefined ? timeInputDrafts[calendarStartDraftKey] : start;
              const calendarEndValue = timeInputDrafts[calendarEndDraftKey] !== undefined ? timeInputDrafts[calendarEndDraftKey] : end;
              
              // 🔴 UX TEMPORAL CANÔNICO: Chave para contexto do slot no modo calendário
              const calendarContextKey = `calendar-${selectedDate}-${index}`;

              return (
                <div key={index} className="time-slot">
                  {/* 🔴 LAYOUT RESPONSIVO: Container principal com grid/flex */}
                  <div className="time-slot-main">
                    {/* 🔴 UX TEMPORAL CANÔNICO: Seletor de contexto - SEMPRE VISÍVEL ANTES DOS HORÁRIOS */}
                    {/* 🔴 A11Y: Sempre renderizar para manter ordem do DOM estável */}
                    {/* 🔴 CONTEXTO: Metadata de UX, opcional mas sempre visível para definir lógica de validação */}
                    <select
                      value={contexts[calendarContextKey] || ''}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : e.target.value as 'WORK' | 'LEISURE' | 'STUDY';
                        
                        const errorKey = `${selectedDate}-${index}`;
                        
                        // 🔴 UX FIX: Limpar erros contextuais ANTES de mudar contexto (modo calendário)
                        clearContextualErrors(errorKey);
                        
                        /**
                         * REGRA CANÔNICA DE AGENDA:
                         * Contextos NÃO herdam horários entre si.
                         * Herança temporal só é permitida dentro do mesmo contexto.
                         * Troca de contexto implica reset completo de start/end.
                         */
                        
                        // Obter contexto anterior do slot
                        const previousContext = contexts[calendarContextKey];
                        const currentSlots = specificDates.get(selectedDate)?.timeSlots || [];
                        
                        // 🔒 REGRA CANÔNICA: troca de contexto zera herança
                        if (previousContext !== value) {
                          // Contexto mudou: resetar completamente start e end
                          // NÃO herdar horários de contexto anterior
                          const newSlots = [...currentSlots];
                          newSlots[index] = '-'; // Resetar para vazio
                          updateDateTimeSlots(selectedDate, newSlots);
                          
                          // Limpar drafts relacionados
                          const startDraftKey = `calendar-${selectedDate}-${index}-start`;
                          const endDraftKey = `calendar-${selectedDate}-${index}-end`;
                          const newDrafts = { ...timeInputDrafts };
                          delete newDrafts[startDraftKey];
                          delete newDrafts[endDraftKey];
                          setTimeInputDrafts(newDrafts);
                          
                          // Limpar mensagens relacionadas
                          const newMessages = { ...timeInputMessages };
                          delete newMessages[startDraftKey];
                          delete newMessages[endDraftKey];
                          setTimeInputMessages(newMessages);
                        } else if (value && currentSlots[index]) {
                          // ✅ Herança permitida SOMENTE se contexto for o mesmo
                          const { start: currentStart, end: currentEnd } = parseTimeRange(currentSlots[index]);
                          
                          // Verificar se slot está vazio (novo)
                          const isStartEmpty = !currentStart || currentStart.trim() === '' || currentStart === '--:--';
                          const startDraftKey = `calendar-${selectedDate}-${index}-start`;
                          const startDraft = timeInputDrafts[startDraftKey];
                          const isDraftEmpty = !startDraft || startDraft.trim() === '' || startDraft === '--:--';
                          const isSlotNew = isStartEmpty && isDraftEmpty;
                          
                          // Apenas herdar se slot é novo e contexto é o mesmo
                          if (isSlotNew) {
                            const calculatedStartTime = calculateStartTimeByContext(`calendar-${selectedDate}`, value, index, true);
                            if (calculatedStartTime && calculatedStartTime.trim() !== '' && calculatedStartTime !== '00:00') {
                              const newTimeRange = formatTimeRange(calculatedStartTime, currentEnd || '');
                              const newSlots = [...currentSlots];
                              newSlots[index] = newTimeRange;
                              updateDateTimeSlots(selectedDate, newSlots);
                              
                              // Limpar draft do startTime para forçar atualização do input
                              const newDrafts = { ...timeInputDrafts };
                              delete newDrafts[startDraftKey];
                              setTimeInputDrafts(newDrafts);
                            }
                          }
                        }
                        
                        setContexts({
                          ...contexts,
                          [calendarContextKey]: value,
                        });
                        
                        if (onContextChange) {
                          onContextChange(selectedDate, index, value);
                        }
                        
                        // 🔴 CORREÇÃO CONCEITUAL: Trocar contexto NÃO deve revalidar ordem temporal
                        // Apenas limpar erros contextuais antigos
                        // Validação temporal só deve ocorrer quando horários são alterados, não quando contexto muda
                        // clearContextualErrors já foi chamado acima, então apenas garantir que erros antigos foram limpos
                      }}
                      className="context-selector"
                      title="Contexto (opcional) - Define lógica de validação temporal"
                      tabIndex={0}
                      disabled={!showContextSelector}
                      style={{ display: showContextSelector ? undefined : 'none' }}
                    >
                      <option value="">Sem contexto</option>
                      <option 
                        value="WORK" 
                        title={isContextExhausted(`calendar-${selectedDate}`, 'WORK', index, true) ? 'Contexto esgotado (atingiu 23:59). Ainda pode ser selecionado.' : ''}
                      >
                        Trabalho{isContextExhausted(`calendar-${selectedDate}`, 'WORK', index, true) ? ' (esgotado)' : ''}
                      </option>
                      <option 
                        value="LEISURE"
                      >
                        Lazer e Cuidados Pessoais
                      </option>
                      <option 
                        value="STUDY"
                      >
                        Estudo
                      </option>
                    </select>
                    <div className="time-inputs-group">
                      <div className="time-input-wrapper">
                      <input
                          type="text"
                          inputMode="numeric"
                        placeholder="--:--"
                          autoComplete="off"
                          value={calendarStartValue || ''}
                        onChange={(e) => {
                            // 🔴 REWRITE CONTROLADO: Atualizar draft durante digitação (permite valores intermediários)
                          updateTimeInputDraft(`calendar-${selectedDate}`, index, 'start', e.target.value);
                            // Limpar mensagem ao começar a digitar
                            const messageKey = `calendar-${selectedDate}-${index}-start`;
                            const newMessages = { ...timeInputMessages };
                            delete newMessages[messageKey];
                            
                            // 🔴 VALIDAÇÃO INCREMENTAL: Validar continuidade temporal (mesmo contexto)
                            const continuityError = validateTemporalContinuity(`calendar-${selectedDate}`, index, e.target.value);
                            const errorKey = `${selectedDate}-${index}`;
                            const newErrors = { ...timeSlotErrors };
                            
                            if (continuityError) {
                              // Adicionar erro de continuidade temporal
                              newErrors[errorKey] = continuityError;
                            } else {
                              // Se não há erro de continuidade, verificar se há outros erros
                              // Se não há outros erros, remover
                              const hasOtherError = newErrors[errorKey] && !newErrors[errorKey].includes('Para o mesmo tipo de atividade');
                              if (!hasOtherError) {
                                delete newErrors[errorKey];
                              }
                            }
                            setTimeSlotErrors(newErrors);
                            setTimeInputMessages(newMessages);
                        }}
                        onBlur={(e) => {
                            // 🔴 REWRITE CONTROLADO: Normalizar e persistir apenas no onBlur (modo calendário)
                            commitTimeInputCalendar(selectedDate, index, 'start', e.currentTarget.value);
                        }}
                        className={`time-input ${hasError ? 'error' : ''}`}
                      />
                        {timeInputMessages[`calendar-${selectedDate}-${index}-start`] && (
                          <span className="time-input-hint">{timeInputMessages[`calendar-${selectedDate}-${index}-start`]}</span>
                        )}
                      </div>
                      <span className="time-separator">até</span>
                      <div className="time-input-wrapper">
                      <input
                          type="text"
                          inputMode="numeric"
                        placeholder="--:--"
                          autoComplete="off"
                          value={calendarEndValue || ''}
                        onChange={(e) => {
                            // 🔴 REWRITE CONTROLADO: Atualizar draft durante digitação (permite valores intermediários)
                          updateTimeInputDraft(`calendar-${selectedDate}`, index, 'end', e.target.value);
                            // Limpar mensagem ao começar a digitar
                            const messageKey = `calendar-${selectedDate}-${index}-end`;
                            const newMessages = { ...timeInputMessages };
                            delete newMessages[messageKey];
                            setTimeInputMessages(newMessages);
                        }}
                        onBlur={(e) => {
                            // 🔴 REWRITE CONTROLADO: Normalizar e persistir apenas no onBlur (modo calendário)
                            commitTimeInputCalendar(selectedDate, index, 'end', e.currentTarget.value);
                        }}
                        className={`time-input ${hasError ? 'error' : ''}`}
                      />
                        {timeInputMessages[`calendar-${selectedDate}-${index}-end`] && (
                          <span className="time-input-hint">{timeInputMessages[`calendar-${selectedDate}-${index}-end`]}</span>
                        )}
                        {/* 🔴 UX FECHAMENTO: Sugestão visual de 23:59 quando apropriado */}
                        {calendarStartValue && calendarStartValue.trim() !== '' && 
                         (!calendarEndValue || calendarEndValue.trim() === '') &&
                         contexts[calendarContextKey] &&
                         calculateStartTimeByContext(`calendar-${selectedDate}`, contexts[calendarContextKey], index, true) === calendarStartValue && (
                          <span className="time-input-suggestion" title="Sugestão: 23:59 é o limite do dia">
                            (até 23:59)
                          </span>
                        )}
                      </div>
                    </div>
                    {/* 🔴 LAYOUT RESPONSIVO: Mensagens de orientação (desktop: inline, mobile: abaixo) */}
                    {hasError && (
                      <span className="field-error-small field-error-desktop">{timeSlotErrors[errorKey]}</span>
                    )}
                    {/* 🔴 LAYOUT RESPONSIVO: Botões sempre lado a lado */}
                    <div className="time-slot-actions">
                      <button
                        type="button"
                        onClick={() => {
                          const current = specificDates.get(selectedDate)?.timeSlots || [];
                          const newIndex = current.length;
                          // 🔴 UX CANÔNICO: Criar novo intervalo completamente vazio
                          // O start_time será pré-preenchido visualmente quando o usuário selecionar um contexto
                          // (via calculateStartTimeByContext quando contexto é selecionado)
                          updateDateTimeSlots(selectedDate, [...current, '-']);
                          
                          // 🔴 BUGFIX: Resetar explicitamente estado do slot novo
                          const newDrafts = { ...timeInputDrafts };
                          delete newDrafts[`calendar-${selectedDate}-${newIndex}-start`];
                          delete newDrafts[`calendar-${selectedDate}-${newIndex}-end`];
                          setTimeInputDrafts(newDrafts);
                          
                          const newMessages = { ...timeInputMessages };
                          delete newMessages[`calendar-${selectedDate}-${newIndex}-start`];
                          delete newMessages[`calendar-${selectedDate}-${newIndex}-end`];
                          setTimeInputMessages(newMessages);
                          
                          // 🔴 BUGFIX: Revalidar todos os slots após adicionar (usa valores atualizados)
                          // setTimeout garante que React atualizou o estado antes de revalidar
                          setTimeout(() => {
                            const currentSlots = specificDates.get(selectedDate)?.timeSlots || [];
                            revalidateAllSlotsForDay(`calendar-${selectedDate}`, true, currentSlots);
                          }, 0);
                          
                          const newErrors = { ...timeSlotErrors };
                          delete newErrors[`${selectedDate}-${newIndex}`];
                          setTimeSlotErrors(newErrors);
                          
                          // 🔴 BUGFIX: Revalidar todos os slots após adicionar (usa valores atualizados)
                          // setTimeout garante que React atualizou o estado antes de revalidar
                          setTimeout(() => {
                            const currentSlots = specificDates.get(selectedDate)?.timeSlots || [];
                            revalidateAllSlotsForDay(`calendar-${selectedDate}`, true, currentSlots);
                          }, 0);
                        }}
                        className="add-slot-button-inline"
                        title="Adicionar outro intervalo"
                      >
                        + Horário
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Remover slot do array primeiro
                          const newSlots = specificDates.get(selectedDate)?.timeSlots.filter((_, i) => i !== index) || [];
                          if (newSlots.length === 0) {
                            toggleDateAvailability(selectedDate);
                          } else {
                            updateDateTimeSlots(selectedDate, newSlots);
                          }
                          
                          // 🔴 BUGFIX CRÍTICO: Reindexar TODOS os estados keyed por index (modo calendário)
                          // Processar todas as chaves de uma vez (sem sufixo específico)
                          // contexts: "calendar-date-index"
                          const reindexedContexts = reindexStateByCalendarDate(contexts, selectedDate, index);
                          setContexts(reindexedContexts);
                          
                          // timeInputDrafts: "calendar-date-index-start" e "calendar-date-index-end"
                          // Processar sem sufixo para capturar ambos
                          const reindexedDrafts = reindexStateByCalendarDate(timeInputDrafts, selectedDate, index);
                          setTimeInputDrafts(reindexedDrafts);
                          
                          // timeInputMessages: "calendar-date-index-start" e "calendar-date-index-end"
                          // Processar sem sufixo para capturar ambos
                          const reindexedMessages = reindexStateByCalendarDate(timeInputMessages, selectedDate, index);
                          setTimeInputMessages(reindexedMessages);
                          
                          // timeSlotErrors: "date-index"
                          const reindexedErrors = reindexStateByDayKey(timeSlotErrors, selectedDate, index);
                          setTimeSlotErrors(reindexedErrors);
                          
                          // 🔴 BUGFIX: Revalidar todos os slots após remoção (usa valores atualizados)
                          // setTimeout garante que React atualizou o estado antes de revalidar
                          // Isso garante que erros antigos não reapareçam e validação use estado correto
                          setTimeout(() => {
                            const currentSlots = specificDates.get(selectedDate)?.timeSlots || [];
                            revalidateAllSlotsForDay(`calendar-${selectedDate}`, true, currentSlots);
                          }, 0);
                        }}
                        className="remove-slot-button"
                        title="Remover horário"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* 🔴 LAYOUT RESPONSIVO: Mensagens de orientação (mobile: sempre abaixo) */}
                  {hasError && (
                    <span className="field-error-small field-error-mobile">{timeSlotErrors[errorKey]}</span>
                  )}
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => {
                const current = specificDates.get(selectedDate)?.timeSlots || [];
                const newIndex = current.length;
                // 🔴 UX CANÔNICO: Criar novo intervalo completamente vazio
                // O start_time será pré-preenchido visualmente quando o usuário selecionar um contexto
                // (via calculateStartTimeByContext quando contexto é selecionado)
                updateDateTimeSlots(selectedDate, [...current, '-']);
                
                // 🔴 BUGFIX: Resetar explicitamente estado do slot novo
                const newDrafts = { ...timeInputDrafts };
                delete newDrafts[`calendar-${selectedDate}-${newIndex}-start`];
                delete newDrafts[`calendar-${selectedDate}-${newIndex}-end`];
                setTimeInputDrafts(newDrafts);
                
                // 🔴 BUGFIX: Revalidar todos os slots após adicionar (usa valores atualizados)
                // setTimeout garante que React atualizou o estado antes de revalidar
                setTimeout(() => {
                  const currentSlots = specificDates.get(selectedDate)?.timeSlots || [];
                  revalidateAllSlotsForDay(`calendar-${selectedDate}`, true, currentSlots);
                }, 0);
                
                const newMessages = { ...timeInputMessages };
                delete newMessages[`calendar-${selectedDate}-${newIndex}-start`];
                delete newMessages[`calendar-${selectedDate}-${newIndex}-end`];
                setTimeInputMessages(newMessages);
                
                const newErrors = { ...timeSlotErrors };
                delete newErrors[`${selectedDate}-${newIndex}`];
                setTimeSlotErrors(newErrors);
              }}
              className="add-slot-button"
            >
              + Adicionar Horário
            </button>
            {/* 🔴 BOTÕES SALVAR/DESCARTAR POR DATA - Após todos os slots (modo calendário) */}
            {dirtyDays[`calendar-${selectedDate}`] && (
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '1rem',
                paddingTop: '1rem',
                borderTop: '1px solid #e5e7eb',
                justifyContent: 'flex-end',
              }}>
                <button
                  type="button"
                  onClick={() => handleSaveDate(selectedDate)}
                  disabled={saveState.status === 'saving'}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: saveState.status === 'saving' ? '#6ee7b7' : '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: saveState.status === 'saving' ? 'wait' : 'pointer',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Salvar alterações de ${selectedDate}`}
                >
                  {saveState.status === 'saving' ? '⏳ Salvando…' : '💾 Salvar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscardDate(selectedDate)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontWeight: '500',
                    fontSize: '0.875rem',
                    whiteSpace: 'nowrap',
                  }}
                  title={`Descartar alterações de ${selectedDate}`}
                >
                  ✕ Descartar
                </button>
              </div>
            )}
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
          Configure seus horários disponíveis.
          Esta é a agenda base do seu perfil como Pessoa Física e será usada para trabalho, convites, eventos, lazer, estudos e cuidados pessoais.
        </p>
      </div>

      {/* 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2: feedback REAL do save (espelha o backend). */}
      {saveState.status !== 'idle' && (
        <div
          role="status"
          aria-live="polite"
          style={{
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            border: '1px solid',
            backgroundColor:
              saveState.status === 'saved' ? '#ecfdf5'
              : saveState.status === 'partial' ? '#fffbeb'
              : saveState.status === 'error' ? '#fef2f2'
              : '#f3f4f6',
            borderColor:
              saveState.status === 'saved' ? '#6ee7b7'
              : saveState.status === 'partial' ? '#fbbf24'
              : saveState.status === 'error' ? '#fca5a5'
              : '#d1d5db',
            color:
              saveState.status === 'saved' ? '#065f46'
              : saveState.status === 'partial' ? '#92400e'
              : saveState.status === 'error' ? '#991b1b'
              : '#374151',
          }}
        >
          <div>
            {saveState.status === 'saving' && '💾 '}
            {saveState.status === 'saved' && '✓ '}
            {saveState.status === 'partial' && '⚠️ '}
            {saveState.status === 'error' && '⚠️ '}
            {saveState.message}
          </div>
          {saveState.detail && (
            <div style={{ marginTop: '0.25rem', fontWeight: 400, fontSize: '0.8125rem' }}>
              {saveState.detail}
            </div>
          )}
        </div>
      )}

      {/* 🔴 BOTÕES SALVAR/DESCARTAR - POSICIONAMENTO CLARO E SEM AMBIGUIDADE */}
      {hasUnsavedChanges() && (
        <div className="save-discard-buttons" style={{
          display: 'flex',
          gap: '0.75rem',
          marginBottom: '1.5rem',
          padding: '1rem',
          backgroundColor: '#fef3c7',
          borderRadius: '0.5rem',
          border: '1px solid #fbbf24',
          position: 'sticky',
          top: '0',
          zIndex: 100,
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
        }}>
          <span style={{ 
            flex: 1, 
            color: '#92400e',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            fontWeight: '500',
          }}>
            ⚠️ Você tem alterações não salvas na agenda
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveState.status === 'saving'}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: saveState.status === 'saving' ? '#6ee7b7' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: saveState.status === 'saving' ? 'wait' : 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
            }}
            title="Salvar todas as alterações da agenda"
          >
            {saveState.status === 'saving' ? '⏳ Salvando…' : '💾 Salvar'}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
              whiteSpace: 'nowrap',
            }}
            title="Descartar todas as alterações não salvas"
          >
            ✕ Descartar
          </button>
        </div>
      )}

      {/* Modo de Visualização */}
      <div className="view-mode-selector">
        <button
          type="button"
          className={`view-mode-button ${viewMode === 'weekly' ? 'active' : ''}`}
          onClick={() => confirmBeforeChange(() => setViewMode('weekly'))}
        >
          📅 Semanal
        </button>
        <button
          type="button"
          className={`view-mode-button ${viewMode === 'calendar' ? 'active' : ''}`}
          onClick={() => confirmBeforeChange(() => setViewMode('calendar'))}
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
                    <>
                      {/* 🔴 MODO POR DIA: Pergunta sobre horário fixo */}
                      <div style={{ marginBottom: '0.75rem', fontSize: '0.875rem', color: '#374151' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                          <span>Neste dia, seu horário de trabalho é fixo ou flexível?</span>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                            <input
                              type="radio"
                              name={`day-mode-${day.key}`}
                              checked={dayMode[day.key] === 'FIXED'}
                              onChange={() => {
                                const newMode: Record<string, 'FIXED' | 'FLEXIBLE'> = { ...dayMode, [day.key]: 'FIXED' };
                                setDayMode(newMode);
                                handleDayModeChange(day.key, 'FIXED');
                              }}
                            />
                            <span>Fixo</span>
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: '0.5rem' }}>
                            <input
                              type="radio"
                              name={`day-mode-${day.key}`}
                              checked={dayMode[day.key] === 'FLEXIBLE' || dayMode[day.key] === undefined}
                              onChange={() => {
                                const newMode: Record<string, 'FIXED' | 'FLEXIBLE'> = { ...dayMode, [day.key]: 'FLEXIBLE' };
                                setDayMode(newMode);
                                handleDayModeChange(day.key, 'FLEXIBLE');
                              }}
                            />
                            <span>Flexível</span>
                          </label>
                        </label>
                      </div>
                    <div className="time-slots">
                      {timeSlots.map((slot, index) => {
                        const { start, end } = parseTimeRange(slot);
                        const errorKey = `${day.key}-${index}`;
                        const hasError = !!timeSlotErrors[errorKey];
                        
                        // 🔴 UX FIX: Usar draft se existir, senão usar valor do schedule
                        const startDraftKey = `${day.key}-${index}-start`;
                        const endDraftKey = `${day.key}-${index}-end`;
                        const startValue = timeInputDrafts[startDraftKey] !== undefined ? timeInputDrafts[startDraftKey] : start;
                        const endValue = timeInputDrafts[endDraftKey] !== undefined ? timeInputDrafts[endDraftKey] : end;

                        // 🔴 UX TEMPORAL CANÔNICO: Chave para contexto do slot
                        const contextKey = `${day.key}-${index}`;

                        return (
                          <div key={index} className="time-slot">
                            {/* 🔴 LAYOUT RESPONSIVO: Container principal com grid/flex */}
                            <div className="time-slot-main">
                              {/* 🔴 UX TEMPORAL CANÔNICO: Seletor de contexto (apenas para user actors) - PRIMEIRO */}
                              {/* 🔴 A11Y: Sempre renderizar para manter ordem do DOM estável */}
                              <select
                                value={contexts[contextKey] || ''}
                                onChange={(e) => {
                                  // 🔴 UX CANÔNICO: Contexto sempre disponível (metadata de UX para definir lógica de validação)
                                  const value = e.target.value === '' ? null : e.target.value as 'WORK' | 'LEISURE' | 'STUDY';
                                  
                                  const errorKey = `${day.key}-${index}`;
                                  
                                  // 🔴 UX FIX: Limpar erros contextuais ANTES de mudar contexto
                                  clearContextualErrors(errorKey);
                                  
                                  /**
                                   * REGRA CANÔNICA DE AGENDA:
                                   * Contextos NÃO herdam horários entre si.
                                   * Herança temporal só é permitida dentro do mesmo contexto.
                                   * Troca de contexto implica reset completo de start/end.
                                   */
                                  
                                  // Obter contexto anterior do slot
                                  const previousContext = contexts[contextKey];
                                  const currentSlot = schedule[day.key]?.[index];
                                  
                                  // 🔒 REGRA CANÔNICA: troca de contexto zera herança
                                  if (previousContext !== value) {
                                    // Contexto mudou: resetar completamente start e end
                                    // NÃO herdar horários de contexto anterior
                                    const newSchedule = { ...schedule };
                                    if (newSchedule[day.key]) {
                                      newSchedule[day.key][index] = '-'; // Resetar para vazio
                                      updateSchedule(newSchedule, day.key);
                                    }
                                    
                                    // Limpar drafts relacionados
                                    const startDraftKey = `${day.key}-${index}-start`;
                                    const endDraftKey = `${day.key}-${index}-end`;
                                    const newDrafts = { ...timeInputDrafts };
                                    delete newDrafts[startDraftKey];
                                    delete newDrafts[endDraftKey];
                                    setTimeInputDrafts(newDrafts);
                                    
                                    // Limpar mensagens relacionadas
                                    const newMessages = { ...timeInputMessages };
                                    delete newMessages[startDraftKey];
                                    delete newMessages[endDraftKey];
                                    setTimeInputMessages(newMessages);
                                  } else if (value && currentSlot) {
                                    // ✅ Herança permitida SOMENTE se contexto for o mesmo
                                    const { start: currentStart, end: currentEnd } = parseTimeRange(currentSlot);
                                    
                                    // Verificar se slot está vazio (novo)
                                    const startDraftKey = `${day.key}-${index}-start`;
                                    const startDraft = timeInputDrafts[startDraftKey];
                                    const isStartEmpty = (!currentStart || currentStart.trim() === '' || currentStart === '--:--');
                                    const isDraftEmpty = !startDraft || startDraft.trim() === '' || startDraft === '--:--';
                                    const isSlotNew = isStartEmpty && isDraftEmpty;
                                    
                                    // Apenas herdar se slot é novo e contexto é o mesmo
                                    if (isSlotNew) {
                                      const calculatedStartTime = calculateStartTimeByContext(day.key, value, index, false);
                                      if (calculatedStartTime && calculatedStartTime.trim() !== '' && calculatedStartTime !== '00:00') {
                                        const newTimeRange = `${calculatedStartTime}-${currentEnd || ''}`;
                                        const newSchedule = { ...schedule };
                                        if (newSchedule[day.key]) {
                                          newSchedule[day.key][index] = newTimeRange;
                                          updateSchedule(newSchedule, day.key);
                                        }
                                        
                                        // Limpar draft do startTime para forçar atualização do input
                                        const newDrafts = { ...timeInputDrafts };
                                        delete newDrafts[startDraftKey];
                                        setTimeInputDrafts(newDrafts);
                                      }
                                    }
                                  }
                                  
                                  // Atualizar contexto
                                  setContexts({
                                    ...contexts,
                                    [contextKey]: value,
                                  });
                                  
                                  if (onContextChange) {
                                    onContextChange(day.key, index, value);
                                  }
                                  
                                  // 🔴 CORREÇÃO CONCEITUAL: Trocar contexto NÃO deve revalidar ordem temporal
                                  // Apenas limpar erros contextuais antigos
                                  // Validação temporal só deve ocorrer quando horários são alterados, não quando contexto muda
                                  // clearContextualErrors já foi chamado acima, então apenas garantir que erros antigos foram limpos
                                }}
                                className="context-selector"
                                title="Contexto (opcional) - Define lógica de validação temporal"
                                tabIndex={0}
                                disabled={!showContextSelector}
                                style={{ display: showContextSelector ? undefined : 'none' }}
                              >
                                <option value="">Sem contexto</option>
                                <option 
                                  value="WORK" 
                                  title={isContextExhausted(day.key, 'WORK', index, false) ? 'Contexto esgotado (atingiu 23:59). Ainda pode ser selecionado.' : ''}
                                >
                                  Trabalho{isContextExhausted(day.key, 'WORK', index, false) ? ' (esgotado)' : ''}
                                </option>
                                <option 
                                  value="LEISURE"
                                >
                                  Lazer e Cuidados Pessoais
                                </option>
                                <option
                                  value="STUDY"
                                >
                                  Estudo
                                </option>
                              </select>
                              {/* 🔴 DECISION-0132: seletor de FINALIDADE TEMPORAL (4 concepts resolvidos do
                                  backend). Persistido como purpose_concept_id por janela. Slug = declaração. */}
                              {temporalPurposes && temporalPurposes.length > 0 && (
                                <div className="purpose-selector-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <select
                                    className="purpose-selector"
                                    aria-label={`Finalidade do horário ${slot} (${day.label})`}
                                    title="Finalidade deste tempo (DECISION-0132)"
                                    value={slot ? (slotPurposes[`${day.key}|${slot}`] || '') : ''}
                                    disabled={!slot}
                                    onChange={(e) => {
                                      if (!slot) return;
                                      const slug = e.target.value || null;
                                      const k = `${day.key}|${slot}`;
                                      setSlotPurposes(prev => {
                                        const next = { ...prev };
                                        if (slug) next[k] = slug; else delete next[k];
                                        return next;
                                      });
                                      setDirtyDays(prev => ({ ...prev, [day.key]: true }));
                                    }}
                                  >
                                    <option value="">Sem finalidade</option>
                                    {temporalPurposes.map(p => (
                                      <option key={p.slug} value={p.slug}>
                                        {PURPOSE_LABELS[p.slug] ?? p.slug}{p.bookable ? '' : ' 🔒'}
                                      </option>
                                    ))}
                                  </select>
                                  {slot && slotPurposes[`${day.key}|${slot}`] &&
                                    purposeBookableBySlug.get(slotPurposes[`${day.key}|${slot}`]) === false && (
                                      <span style={{ fontSize: '0.7rem', color: '#9a3412' }} title="Tempo pessoal protegido — não recebe agendamentos">
                                        🔒 não-bookável
                                      </span>
                                    )}
                                </div>
                              )}
                              <div className="time-inputs-group">
                                <div className="time-input-wrapper">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                  placeholder="--:--"
                                    autoComplete="off"
                                    value={startValue || ''}
                                  onChange={(e) => {
                                      // 🔴 REWRITE CONTROLADO: Atualizar draft durante digitação (permite valores intermediários)
                                    updateTimeInputDraft(day.key, index, 'start', e.target.value);
                                      // Limpar mensagem ao começar a digitar
                                      const messageKey = `${day.key}-${index}-start`;
                                      const newMessages = { ...timeInputMessages };
                                      delete newMessages[messageKey];
                                      
                                      // 🔴 VALIDAÇÃO INCREMENTAL: Validar continuidade temporal (mesmo contexto)
                                      const continuityError = validateTemporalContinuity(day.key, index, e.target.value);
                                      const errorKey = `${day.key}-${index}`;
                                      const newErrors = { ...timeSlotErrors };
                                      
                                      if (continuityError) {
                                        // Adicionar erro de continuidade temporal
                                        newErrors[errorKey] = continuityError;
                                      } else {
                                        // Se não há erro de continuidade, verificar se há outros erros
                                        // Se não há outros erros, remover
                                        const hasOtherError = newErrors[errorKey] && !newErrors[errorKey].includes('Para o mesmo tipo de atividade');
                                        if (!hasOtherError) {
                                          delete newErrors[errorKey];
                                        }
                                      }
                                      setTimeSlotErrors(newErrors);
                                      setTimeInputMessages(newMessages);
                                  }}
                                  onBlur={(e) => {
                                      // 🔴 REWRITE CONTROLADO: Normalizar e persistir apenas no onBlur
                                      commitTimeInput(day.key, index, 'start', e.currentTarget.value);
                                  }}
                                  className={`time-input ${hasError ? 'error' : ''}`}
                                />
                                  {timeInputMessages[`${day.key}-${index}-start`] && (
                                    <span className="time-input-hint">{timeInputMessages[`${day.key}-${index}-start`]}</span>
                                  )}
                                </div>
                                <span className="time-separator">até</span>
                                <div className="time-input-wrapper">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                  placeholder="--:--"
                                    autoComplete="off"
                                    value={endValue || ''}
                                  onChange={(e) => {
                                      // 🔴 REWRITE CONTROLADO: Atualizar draft durante digitação (permite valores intermediários)
                                    updateTimeInputDraft(day.key, index, 'end', e.target.value);
                                      // Limpar mensagem ao começar a digitar
                                      const messageKey = `${day.key}-${index}-end`;
                                      const newMessages = { ...timeInputMessages };
                                      delete newMessages[messageKey];
                                      setTimeInputMessages(newMessages);
                                  }}
                                  onBlur={(e) => {
                                      // 🔴 REWRITE CONTROLADO: Normalizar e persistir apenas no onBlur
                                      commitTimeInput(day.key, index, 'end', e.currentTarget.value);
                                  }}
                                  className={`time-input ${hasError ? 'error' : ''}`}
                                />
                                  {timeInputMessages[`${day.key}-${index}-end`] && (
                                    <span className="time-input-hint">{timeInputMessages[`${day.key}-${index}-end`]}</span>
                                  )}
                                  {/* 🔴 UX FECHAMENTO: Sugestão visual de 23:59 quando apropriado */}
                                  {startValue && startValue.trim() !== '' && 
                                   (!endValue || endValue.trim() === '') &&
                                   contexts[contextKey] &&
                                   calculateStartTimeByContext(day.key, contexts[contextKey], index, false) === startValue && (
                                    <span className="time-input-suggestion" title="Sugestão: 23:59 é o limite do dia">
                                      (até 23:59)
                                    </span>
                                  )}
                                </div>
                              </div>
                              {/* 🔴 LAYOUT RESPONSIVO: Mensagens de orientação (desktop: inline, mobile: abaixo) */}
                              {hasError && (
                                <span className="field-error-small field-error-desktop">{timeSlotErrors[errorKey]}</span>
                              )}
                              {/* 🔴 LAYOUT RESPONSIVO: Botões sempre lado a lado */}
                              <div className="time-slot-actions">
                                <button
                                  type="button"
                                  onClick={() => addTimeSlot(day.key)}
                                  className="add-slot-button-inline"
                                  title="Adicionar outro intervalo"
                                >
                                  + Horário
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    // 🔴 BUGFIX: removeTimeSlot já reindexa e atualiza erros
                                    // NÃO fazer double write - isso causa race condition
                                    removeTimeSlot(day.key, index);
                                  }}
                                  className="remove-slot-button"
                                  title="Remover horário"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            {/* 🔴 LAYOUT RESPONSIVO: Mensagens de orientação (mobile: sempre abaixo) */}
                            {hasError && (
                              <span className="field-error-small field-error-mobile">{timeSlotErrors[errorKey]}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* 🔴 BOTÕES SALVAR/DESCARTAR POR DIA - Após todos os slots */}
                    {dirtyDays[day.key] && (
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid #e5e7eb',
                        justifyContent: 'flex-end',
                      }}>
                        <button
                          type="button"
                          onClick={() => handleSaveDay(day.key)}
                          disabled={saveState.status === 'saving'}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: saveState.status === 'saving' ? '#6ee7b7' : '#10b981',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: saveState.status === 'saving' ? 'wait' : 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            whiteSpace: 'nowrap',
                          }}
                          title={`Salvar alterações de ${day.label}`}
                        >
                          {saveState.status === 'saving' ? '⏳ Salvando…' : '💾 Salvar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDiscardDay(day.key)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.875rem',
                            whiteSpace: 'nowrap',
                          }}
                          title={`Descartar alterações de ${day.label}`}
                        >
                          ✕ Descartar
                        </button>
                      </div>
                    )}
                    </>
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

