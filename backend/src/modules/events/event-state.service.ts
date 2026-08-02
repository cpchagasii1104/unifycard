// src/modules/events/event-state.service.ts
// Service para determinar estado do evento (PRE, DURING, POST)

export type EventState = 'PRE' | 'DURING' | 'POST';

export interface EventStateInfo {
  state: EventState;
  timeUntilStart?: number; // minutos até o início
  timeUntilEnd?: number; // minutos até o fim
  timeSinceEnd?: number; // minutos desde o fim
  isSoon?: boolean; // menos de 24h para começar
  isEnding?: boolean; // menos de 1h para terminar
}

export class EventStateService {
  /**
   * Determina o estado atual do evento
   */
  getEventState(event: {
    startTime: Date | string;
    endTime: Date | string;
    status?: string;
  }): EventStateInfo {
    const now = new Date();
    const startTime = typeof event.startTime === 'string' ? new Date(event.startTime) : event.startTime;
    const endTime = typeof event.endTime === 'string' ? new Date(event.endTime) : event.endTime;

    // Se evento foi cancelado ou encerrado, considerar como POST.
    // ⚠️ Era 'CANCELLED' || 'FINISHED' — vocabulário do desenho ANTERIOR ao gênesis
    // (migrations_archive/0790 tinha CHECK com 'FINISHED'). O enum vivo é minúsculo e o valor é
    // 'ended', não 'FINISHED' (regra do case por TIPO DE CAMPO + mapa não-1:1, CLAUDE.md §3.2).
    // Comparação em JS cala: nunca casava, e evento cancelado seguia ganhando estado temporal.
    if (event.status === 'cancelled' || event.status === 'ended') {
      return {
        state: 'POST',
        timeSinceEnd: Math.max(0, Math.floor((now.getTime() - endTime.getTime()) / (1000 * 60))),
      };
    }

    // Antes do início
    if (now < startTime) {
      const minutesUntilStart = Math.floor((startTime.getTime() - now.getTime()) / (1000 * 60));
      const isSoon = minutesUntilStart < 24 * 60; // menos de 24h

      return {
        state: 'PRE',
        timeUntilStart: minutesUntilStart,
        isSoon,
      };
    }

    // Durante o evento
    if (now >= startTime && now <= endTime) {
      const minutesUntilEnd = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60));
      const isEnding = minutesUntilEnd < 60; // menos de 1h

      return {
        state: 'DURING',
        timeUntilEnd: minutesUntilEnd,
        isEnding,
      };
    }

    // Após o evento
    const minutesSinceEnd = Math.floor((now.getTime() - endTime.getTime()) / (1000 * 60));

    return {
      state: 'POST',
      timeSinceEnd: minutesSinceEnd,
    };
  }

  /**
   * Formata mensagem de estado para exibição
   */
  getStateMessage(stateInfo: EventStateInfo): string {
    if (stateInfo.state === 'PRE') {
      if (stateInfo.isSoon) {
        const hours = Math.floor((stateInfo.timeUntilStart || 0) / 60);
        if (hours < 1) {
          return `Começa em ${stateInfo.timeUntilStart} minutos`;
        }
        return `Começa em ${hours} hora${hours > 1 ? 's' : ''}`;
      }
      const days = Math.floor((stateInfo.timeUntilStart || 0) / (60 * 24));
      return `Começa em ${days} dia${days > 1 ? 's' : ''}`;
    }

    if (stateInfo.state === 'DURING') {
      if (stateInfo.isEnding) {
        return `Termina em ${stateInfo.timeUntilEnd} minutos`;
      }
      const hours = Math.floor((stateInfo.timeUntilEnd || 0) / 60);
      return `Em andamento (termina em ${hours}h)`;
    }

    // Após o evento
    const daysSinceEnd = Math.floor((stateInfo.timeSinceEnd || 0) / (60 * 24));
    if (daysSinceEnd < 1) {
      return 'Finalizado há menos de 1 dia';
    }
    return `Finalizado há ${daysSinceEnd} dia${daysSinceEnd > 1 ? 's' : ''}`;
  }
}

export const eventStateService = new EventStateService();
