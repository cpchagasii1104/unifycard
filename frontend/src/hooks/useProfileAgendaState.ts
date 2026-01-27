import { useState } from 'react';
import type { UnifiedAvailability, UnifiedBooking, AvailabilityParticipant, AvailabilityConflict } from '../api/availability';
import type { AvailabilitySchedule } from '../api/categories';

export function useProfileAgendaState() {
  const [availabilities, setAvailabilities] = useState<UnifiedAvailability[]>([]);
  const [bookings, setBookings] = useState<UnifiedBooking[]>([]);
  const [participantsMap, setParticipantsMap] = useState<Record<string, AvailabilityParticipant[]>>({});
  const [conflictsMap, setConflictsMap] = useState<Record<string, AvailabilityConflict[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<AvailabilitySchedule>({});

  return {
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
  };
}



