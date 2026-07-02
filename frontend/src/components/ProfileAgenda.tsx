// src/components/ProfileAgenda.tsx
// Sistema de Agenda do Ator (Pessoa Física)
// Agenda unificada por ACTOR ATIVO
// 🔴 REGRA: Agenda pertence ao activeActor, não à pessoa física/jurídica

import { useEffect, useCallback, useState } from 'react';
import { DateTime } from 'luxon';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listAvailabilities,
  listBookings,
  listParticipants,
  createAvailability,
  updateAvailability,
  putWeeklyAvailabilityTemplate,
  fetchTemporalPurposes,
  type UnifiedAvailability,
  type UnifiedBooking,
  type AvailabilityParticipant,
  type AvailabilityOwnerType,
  type MaterializeWeeklyTemplateResult,
  type TemporalPurpose,
} from '../api/availability';
import { type AvailabilitySchedule } from '../api/categories';
import { useProfileAgendaState } from '../hooks/useProfileAgendaState';
import { useProfileAgendaLogic } from '../hooks/useProfileAgendaLogic';
import ProfileAgendaForm from './ProfileAgendaForm';
import './ProfileAgenda.css';

// 🔴 CORE TEMPORAL: AvailabilitySchedule é INPUT DECLARATIVO
// NÃO é verdade temporal e NÃO é salvo em availability.metadata.schedule (guard 400 do Core).
// F2 (DECISION-0072 B1): o save materializa a grade no SSOT `availability` via
// PUT /availability/weekly-template; o read-back reconstrói a grade a partir das janelas
// materializadas (metadata.source==='profile_weekly_template'), nunca de bookings nem de profile.

/** Marcador de procedência das janelas geradas pelo materializador semanal (F1). */
const WEEKLY_TEMPLATE_SOURCE = 'profile_weekly_template';

/** luxon weekday (1=Mon..7=Sun) → chave da grade. */
const LUXON_WEEKDAY_TO_KEY: Record<number, string> = {
  1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 7: 'sunday',
};

/**
 * Reconstrói a grade semanal declarativa a partir das janelas CONCRETAS materializadas no SSOT
 * `availability` (apenas as marcadas como template recorrente e ativas). Converte start/end para
 * dia-da-semana + "HH:mm-HH:mm" na timezone de cada janela. NÃO usa bookings nem metadata.schedule.
 */
function reconstructWeeklySchedule(
  avs: UnifiedAvailability[],
  conceptIdToSlug: Map<string, string>
): { schedule: AvailabilitySchedule; purposes: Record<string, string> } {
  const byDay: Record<string, Set<string>> = {};
  // 🔴 DECISION-0132: read-back da finalidade por faixa, keyed `${dayKey}|${range}` (estável).
  const purposes: Record<string, string> = {};
  for (const a of avs) {
    if (a.metadata?.source !== WEEKLY_TEMPLATE_SOURCE) continue;
    if (a.availabilityType !== 'recurring') continue;
    if (a.status !== 'active') continue;
    const tz = a.timezone || 'America/Sao_Paulo';
    const start = DateTime.fromISO(a.startDatetime, { zone: tz });
    const end = DateTime.fromISO(a.endDatetime, { zone: tz });
    if (!start.isValid || !end.isValid) continue;
    const dayKey = LUXON_WEEKDAY_TO_KEY[start.weekday];
    if (!dayKey) continue;
    const range = `${start.toFormat('HH:mm')}-${end.toFormat('HH:mm')}`;
    (byDay[dayKey] ??= new Set<string>()).add(range);
    if (a.purposeConceptId) {
      const slug = conceptIdToSlug.get(a.purposeConceptId);
      if (slug) purposes[`${dayKey}|${range}`] = slug;
    }
  }
  const schedule: AvailabilitySchedule = {};
  for (const [day, ranges] of Object.entries(byDay)) {
    schedule[day] = Array.from(ranges).sort();
  }
  return { schedule, purposes };
}

export default function ProfileAgenda() {
  const { activeActor } = useActiveActor();
  const {
    availabilities,
    setAvailabilities,
    bookings,
    setBookings,
    participantsMap,
    setParticipantsMap,
    conflictsMap,
    setConflictsMap,
    isLoading,
    setIsLoading,
    error,
    setError,
    schedule,
    setSchedule,
  } = useProfileAgendaState();
  const { formatDate, getStatusLabel, getStatusColor, getOwnerType: getOwnerTypeLogic } = useProfileAgendaLogic();

  // 🔴 DECISION-0132: catálogo das 4 finalidades (do backend) + read-back das finalidades persistidas.
  const [temporalPurposes, setTemporalPurposes] = useState<TemporalPurpose[]>([]);
  const [initialPurposes, setInitialPurposes] = useState<Record<string, string>>({});

  // 🔴 REGRA: Determinar ownerType baseado no activeActor
  const getOwnerType = useCallback((): AvailabilityOwnerType => {
    return getOwnerTypeLogic(activeActor);
  }, [activeActor, getOwnerTypeLogic]);

  // 🔴 REGRA: Carregar agenda quando actor ativo mudar
  useEffect(() => {
    if (activeActor) {
      loadAgenda();
    } else {
      setAvailabilities([]);
      setBookings([]);
      setParticipantsMap({});
      setConflictsMap({});
      setSchedule({});
      setIsLoading(false);
    }
  }, [activeActor?.actor_id, activeActor?.actor_type]);

  const loadAgenda = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ownerType = getOwnerType();

      // Buscar disponibilidades do actor ativo
      const availabilitiesData = await listAvailabilities({
        ownerType,
        ownerId: activeActor.actor_id,
        status: 'active',
      });

      setAvailabilities(availabilitiesData);

      // 🔴 DECISION-0132: catálogo das finalidades (CONCEPT, do backend) + mapa concept_id→slug p/ read-back.
      const purposesCatalog = temporalPurposes.length > 0 ? temporalPurposes : await fetchTemporalPurposes();
      if (purposesCatalog !== temporalPurposes) setTemporalPurposes(purposesCatalog);
      const conceptIdToSlug = new Map<string, string>(purposesCatalog.map((p) => [p.conceptId, p.slug]));

      // 🔴 CORE TEMPORAL (F2): read-back da grade reconstruído a partir das janelas CONCRETAS
      // materializadas no SSOT `availability` (template recorrente ativo), NÃO de metadata.schedule
      // nem de bookings. Antes era `setSchedule({})` (write-only sem read-back).
      // DECISION-0132: reconstrói também a finalidade por faixa.
      const { schedule: reconSchedule, purposes: reconPurposes } = reconstructWeeklySchedule(
        availabilitiesData,
        conceptIdToSlug
      );
      setSchedule(reconSchedule);
      setInitialPurposes(reconPurposes);

      // 🔴 F-AGENDA-SAVE-RATE-LIMIT-429: a grade semanal é materializada em MUITAS janelas (faixa × dia ×
      // horizonte 8 semanas → dezenas/centenas). Buscar bookings+participants POR JANELA disparava 2×N
      // requests a `/availability/*` no load, estourando o rate-limit (60/min) — e aí o PUT de Salvar
      // levava 429. Bookings/participants só alimentam os CARDS exibidos (`availabilities.slice(0,5)`),
      // então buscamos só desses 5 (cap constante, independente do tamanho da agenda). O laço de
      // detectConflicts foi REMOVIDO: `conflictsMap` é computado mas NUNCA exibido (não passa ao form) —
      // era fan-out morto. O save NÃO recarrega a agenda (handleSaveSchedule não chama loadAgenda).
      const displayed = availabilitiesData.slice(0, 5);
      const allBookings: UnifiedBooking[] = [];
      const participantsData: Record<string, AvailabilityParticipant[]> = {};

      for (const availability of displayed) {
        const availabilityBookings = await listBookings({
          availabilityId: availability.availabilityId,
        });
        allBookings.push(...availabilityBookings);

        const participants = await listParticipants(availability.availabilityId);
        participantsData[availability.availabilityId] = participants;
      }

      setBookings(allBookings);
      setParticipantsMap(participantsData);
      setConflictsMap({}); // conflitos não são exibidos nesta tela; evitamos o fan-out de detectConflicts
    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
      setError('Não foi possível carregar a agenda agora. Por favor, tente novamente em alguns instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 CORE TEMPORAL (F2 / DECISION-0072 B1): schedule é INPUT DECLARATIVO. A persistência
  // materializa a grade em janelas CONCRETAS no SSOT `availability` via PUT /availability/weekly-template
  // (NÃO mais via PUT /profile/professional, que responde 501). Verdade temporal vive só em `availability`.
  //
  // 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2: persistência é EXPLÍCITA e AGUARDADA, acionada só pelo
  // clique em Salvar do editor. SEM debounce (o recibo de "salvo" não pode anteceder o PUT real) e
  // SEM descartar o resultado: devolvemos o MaterializeWeeklyTemplateResult ao editor para que ele
  // decida limpar dirty (confirmação limpa) ou avisar "salvo parcialmente". Em erro, REJEITA (o
  // editor mantém dirty). NÃO mutamos `schedule` aqui — o editor é dono do rascunho durante a sessão;
  // mutar o prop dispararia o reset por `availability` e limparia dirty por fora (recibo falso).
  const handleSaveSchedule = useCallback(
    async (
      newSchedule: AvailabilitySchedule,
      purposes: Record<string, string>
    ): Promise<MaterializeWeeklyTemplateResult> => {
      if (!activeActor) {
        throw new Error('Ator não encontrado. Selecione um ator para editar a agenda.');
      }
      // Defesa em profundidade: a UI já bloqueia tipos não suportados; aqui falhamos ALTO (não em
      // silêncio). F-COMPANY-AGENDA-REAL-WIRING: 'page' (empresa) agora é suportado, espelhando o
      // backend (unified-availability.routes.ts restringe ownerType a user/page). 'group' segue FORA
      // — backend não aceita esse ownerType nesta rota (rejeitaria com 400).
      if (activeActor.actor_type !== 'user' && activeActor.actor_type !== 'page') {
        throw new Error('Esta agenda só pode ser salva como Pessoa Física ou Empresa. Selecione um ator desse tipo.');
      }
      // Timezone EXPLÍCITA (DECISION-0072 §3.4): sem fallback silencioso.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!timezone) {
        throw new Error('Não foi possível detectar seu fuso horário. A agenda não foi salva.');
      }
      // 🔴 DECISION-0132: envia a finalidade por faixa (purposes). Backend valida slug (z.enum) e resolve concept_id.
      // ownerType explícito (getOwnerType já mapeia 'page' corretamente) — sem isso o backend assumiria
      // 'user' por default e gravaria a grade no actor errado.
      return await putWeeklyAvailabilityTemplate({
        schedule: newSchedule,
        timezone,
        purposes,
        ownerType: getOwnerType() as 'user' | 'page',
      });
    },
    [activeActor, getOwnerType]
  );


  // 🔴 REGRA: Sem activeActor, não renderizar agenda
  if (!activeActor) {
    return (
      <div className="profile-agenda">
        <div className="empty-state" style={{
          padding: '3rem',
          textAlign: 'center',
          color: '#6b7280',
        }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            Selecione um actor para visualizar a agenda
          </p>
          <p style={{ fontSize: '0.875rem' }}>
            A agenda está vinculada ao actor ativo
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="profile-agenda">
        <div className="loading">Carregando agenda...</div>
      </div>
    );
  }

  if (error && !availabilities.length) {
    return (
      <div className="profile-agenda">
        <div className="error-message">{error}</div>
        <button onClick={loadAgenda} className="retry-button">
          Tentar novamente
        </button>
      </div>
    );
  }

  // 🔧 Estado vazio elegante
  const isEmpty = availabilities.length === 0 && Object.keys(schedule).length === 0;

  return (
    <div className="profile-agenda-wrapper">
      {/* 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2: o feedback de save (salvando/salvo/parcial/erro)
          é responsabilidade do editor, que reflete o resultado REAL do backend. */}
      <ProfileAgendaForm
        activeActor={activeActor}
        availabilities={availabilities}
        bookings={bookings}
        participantsMap={participantsMap}
        schedule={schedule}
        isEmpty={isEmpty}
        formatDate={formatDate}
        getStatusLabel={getStatusLabel}
        getStatusColor={getStatusColor}
        onSave={handleSaveSchedule}
        temporalPurposes={temporalPurposes}
        initialPurposes={initialPurposes}
      />
    </div>
  );
}
