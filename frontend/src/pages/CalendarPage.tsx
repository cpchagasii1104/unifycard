// src/pages/CalendarPage.tsx
// Agenda do Funcionário
// SPRINT 68: Service Orders + Agenda

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { listCalendarEvents, type CalendarEvent } from '../api/calendar';
import { showToast } from '../components/common/Toast';
import './CalendarPage.css';

export default function CalendarPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    loadEvents();
  }, [activeActor, selectedDate]);

  const loadEvents = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calcular início e fim do mês selecionado
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0, 23, 59, 59);

      const data = await listCalendarEvents({
        actorId: activeActor.actor_id,
        startTimeFrom: startOfMonth.toISOString(),
        startTimeTo: endOfMonth.toISOString(),
      });

      setEvents(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar agenda';
      setError(message);
      showToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'SERVICE_ORDER': return 'Ordem de Serviço';
      case 'BLOCK': return 'Bloqueio';
      case 'UNAVAILABLE': return 'Indisponível';
      case 'OTHER': return 'Outro';
      default: return type;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'Agendado';
      case 'IN_PROGRESS': return 'Em Andamento';
      case 'COMPLETED': return 'Concluído';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const handleEventClick = (event: CalendarEvent) => {
    if (event.serviceOrderId) {
      navigate(`/service-orders/${event.serviceOrderId}`);
    } else {
      navigate(`/calendar/events/${event.id}`);
    }
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setSelectedDate(newDate);
  };

  const monthName = selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  if (isLoading) {
    return (
      <div className="calendar-page">
        <div className="loading">Carregando agenda...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="calendar-page">
        <div className="error">{error}</div>
        <button onClick={loadEvents}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <h1>Minha Agenda</h1>
        <button 
          className="btn-primary"
          onClick={() => navigate('/calendar/events/new')}
        >
          Criar Bloqueio
        </button>
      </div>

      <div className="calendar-controls">
        <button onClick={() => changeMonth(-1)}>← Mês Anterior</button>
        <h2>{monthName}</h2>
        <button onClick={() => changeMonth(1)}>Próximo Mês →</button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <p>Nenhum evento agendado neste mês.</p>
        </div>
      ) : (
        <div className="events-list">
          {events.map((event) => (
            <div 
              key={event.id} 
              className="event-card"
              onClick={() => handleEventClick(event)}
            >
              <div className="event-header">
                <h3>{event.title}</h3>
                <span className="event-type">{getEventTypeLabel(event.eventType)}</span>
              </div>
              
              <div className="event-info">
                <p><strong>Status:</strong> {getStatusLabel(event.status)}</p>
                <p><strong>Início:</strong> {formatDate(event.startTime)}</p>
                <p><strong>Fim:</strong> {formatDate(event.endTime)}</p>
                {event.locationAddress && (
                  <p><strong>Local:</strong> {event.locationAddress}</p>
                )}
                {event.description && (
                  <p><strong>Descrição:</strong> {event.description}</p>
                )}
                {event.serviceOrderId && (
                  <p className="service-order-link">
                    <strong>Ordem de Serviço:</strong> #{event.serviceOrderId.substring(0, 8)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}




