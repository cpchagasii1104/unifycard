// src/components/ProfileAgenda.tsx
// Sistema de Agenda do Ator (Pessoa Física)
// Agenda unificada por ACTOR ATIVO
// 🔴 REGRA: Agenda pertence ao activeActor, não à pessoa física/jurídica

import { useEffect, useCallback, useRef, useState } from 'react';
import { useActiveActor } from '../contexts/ActiveActorContext';
import {
  listAvailabilities,
  listBookings,
  listParticipants,
  detectConflicts,
  createAvailability,
  updateAvailability,
  type UnifiedAvailability,
  type UnifiedBooking,
  type AvailabilityParticipant,
  type AvailabilityConflict,
  type AvailabilityOwnerType,
} from '../api/availability';
import { updateProfessionalProfile, type AvailabilitySchedule } from '../api/categories';
import { useProfileAgendaState } from '../hooks/useProfileAgendaState';
import { useProfileAgendaLogic } from '../hooks/useProfileAgendaLogic';
import ProfileAgendaForm from './ProfileAgendaForm';
import './ProfileAgenda.css';

// 🔴 CORE TEMPORAL: AvailabilitySchedule é INPUT DECLARATIVO
// NÃO é verdade temporal e NÃO deve ser salvo em availability.metadata.schedule
// Este componente apenas mantém schedule como estado local para edição
// A persistência real de availability ocorre via Core canônico (sem schedule em metadata)

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

      // 🔴 CORE TEMPORAL: Schedule é apenas INPUT DECLARATIVO local
      // Não carregamos schedule de availability.metadata (violação do Core)
      // Schedule é mantido apenas como estado local para edição
      setSchedule({});

      // Buscar bookings associados às disponibilidades
      const allBookings: UnifiedBooking[] = [];
      const participantsData: Record<string, AvailabilityParticipant[]> = {};
      const conflictsData: Record<string, AvailabilityConflict[]> = {};

      for (const availability of availabilitiesData) {
        const availabilityBookings = await listBookings({
          availabilityId: availability.availabilityId,
        });
        allBookings.push(...availabilityBookings);

        const participants = await listParticipants(availability.availabilityId);
        participantsData[availability.availabilityId] = participants;

        for (const participant of participants) {
          const conflicts = await detectConflicts(
            availability.availabilityId,
            participant.actorId
          );
          if (conflicts.length > 0) {
            const conflictKey = `${availability.availabilityId}_${participant.actorId}`;
            conflictsData[conflictKey] = conflicts;
          }
        }
      }

      setBookings(allBookings);
      setParticipantsMap(participantsData);
      setConflictsMap(conflictsData);
    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
      setError('Não foi possível carregar a agenda agora. Por favor, tente novamente em alguns instantes.');
    } finally {
      setIsLoading(false);
    }
  };

  // 🔴 CORE TEMPORAL: schedule é INPUT DECLARATIVO. Persistência respeitando
  // AGENDA_UNIVERSAL_CONTRACT:
  //   - Schedule do profissional persiste em professional_profile.availability
  //     (preferências declaradas — NÃO é verdade temporal)
  //   - Verdade temporal continua exclusivamente em unified_availability
  //     (criada via Core canônico em frente futura "confirmar e ativar")
  //
  // 2026-05-15: implementada persistência de schedule via updateProfessionalProfile
  // com debounce (evita save a cada toggle do user).
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleScheduleChange = useCallback(async (newSchedule: AvailabilitySchedule) => {
    if (!activeActor) {
      setError('Actor não encontrado');
      return;
    }

    // Atualizar estado local imediatamente (UX responsiva)
    setSchedule(newSchedule);

    // Apenas user actor (PF) persiste schedule profissional — pages têm agenda
    // própria via outro caminho. Schedule é dimensão da PESSOA, não da empresa.
    if (activeActor.actor_type !== 'user') return;

    // Debounce: salvar 700ms após última mudança
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');

    saveTimerRef.current = setTimeout(async () => {
      try {
        await updateProfessionalProfile({ availability: newSchedule });
        setSaveStatus('saved');
        // Voltar para 'idle' depois de 2s
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        console.error('[ProfileAgenda] Erro ao salvar schedule:', err);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    }, 700);
  }, [activeActor, setSchedule, setError]);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);


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
      {/* Indicador de save status (schedule declarativo). Discreto. */}
      {saveStatus !== 'idle' && (
        <div
          className={`profile-agenda-save-status profile-agenda-save-status--${saveStatus}`}
          role="status"
          aria-live="polite"
        >
          {saveStatus === 'saving' && '💾 Salvando preferências…'}
          {saveStatus === 'saved' && '✓ Preferências salvas'}
          {saveStatus === 'error' && '⚠️ Erro ao salvar — tente novamente'}
        </div>
      )}
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
        handleScheduleChange={handleScheduleChange}
        onContextChange={(dayKey, slotIndex, context) => {
          // 🔴 UX TEMPORAL CANÔNICO: Metadata de contexto será persistida junto com availability
          // Este callback permite rastrear mudanças de contexto para persistência futura
          // Por enquanto, apenas armazenamos localmente (será persistido quando schedule for salvo)
        }}
      />
    </div>
  );
}
