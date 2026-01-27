// frontend/src/pages/UnifiedAgendaPage.tsx
// AGENDA UNIFICADA - Consolida todas as fontes de agenda

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { 
  getUnifiedCalendar, 
  type UnifiedCalendarEntry,
  CalendarEntrySource,
  CalendarEntryType,
  type UnifiedCalendarFilters,
} from '../api/unified-calendar';
import { showToast } from '../components/common/Toast';
import './UnifiedAgendaPage.css';

type ViewMode = 'day' | 'week' | 'month';

export default function UnifiedAgendaPage() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [entries, setEntries] = useState<UnifiedCalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Filtros
  const [filters, setFilters] = useState<UnifiedCalendarFilters>({
    actorId: activeActor?.actor_id,
  });
  const [filterServiceId, setFilterServiceId] = useState<string>('');
  const [filterEventId, setFilterEventId] = useState<string>('');
  const [filterSource, setFilterSource] = useState<CalendarEntrySource | ''>('');
  const [filterType, setFilterType] = useState<CalendarEntryType | ''>('');

  useEffect(() => {
    loadEntries();
  }, [activeActor, selectedDate, viewMode, filterServiceId, filterEventId, filterSource, filterType]);

  const loadEntries = async () => {
    if (!activeActor) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Calcular período baseado no viewMode
      const startDate = new Date(selectedDate);
      const endDate = new Date(selectedDate);

      if (viewMode === 'day') {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
      } else if (viewMode === 'week') {
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else { // month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);
        endDate.setHours(23, 59, 59, 999);
      }

      const queryFilters: UnifiedCalendarFilters = {
        actorId: activeActor.actor_id,
        startTimeFrom: startDate.toISOString(),
        startTimeTo: endDate.toISOString(),
      };

      if (filterServiceId) queryFilters.serviceId = filterServiceId;
      if (filterEventId) queryFilters.eventId = filterEventId;
      if (filterSource) queryFilters.source = filterSource as CalendarEntrySource;
      if (filterType) queryFilters.type = filterType as CalendarEntryType;

      const data = await getUnifiedCalendar(queryFilters);
      setEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar agenda unificada';
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

  const getSourceLabel = (source: CalendarEntrySource) => {
    switch (source) {
      case CalendarEntrySource.SERVICE_AVAILABILITY:
        return 'Disponibilidade de Serviço';
      case CalendarEntrySource.CALENDAR_EVENT:
        return 'Evento de Agenda';
      case CalendarEntrySource.UNIFIED_AVAILABILITY:
        return 'Disponibilidade Unificada';
      case CalendarEntrySource.EVENT:
        return 'Evento';
      default:
        return source;
    }
  };

  const getTypeLabel = (type: CalendarEntryType) => {
    switch (type) {
      case CalendarEntryType.AVAILABLE:
        return 'Disponível';
      case CalendarEntryType.RESERVED:
        return 'Reservado';
      case CalendarEntryType.BLOCKED:
        return 'Bloqueado';
      case CalendarEntryType.UNAVAILABLE:
        return 'Indisponível';
      default:
        return type;
    }
  };

  const getTypeClass = (type: CalendarEntryType) => {
    switch (type) {
      case CalendarEntryType.AVAILABLE:
        return 'entry-available';
      case CalendarEntryType.RESERVED:
        return 'entry-reserved';
      case CalendarEntryType.BLOCKED:
        return 'entry-blocked';
      case CalendarEntryType.UNAVAILABLE:
        return 'entry-unavailable';
      default:
        return '';
    }
  };

  const handleEntryClick = (entry: UnifiedCalendarEntry) => {
    if (entry.serviceOrderId) {
      navigate(`/service-orders/${entry.serviceOrderId}`);
    } else if (entry.serviceId) {
      navigate(`/services/${entry.serviceId}`);
    } else if (entry.eventId) {
      navigate(`/events/${entry.eventId}`);
    }
  };

  const changeDate = (delta: number) => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + delta);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (delta * 7));
    } else { // month
      newDate.setMonth(newDate.getMonth() + delta);
    }
    setSelectedDate(newDate);
  };

  const getPeriodLabel = () => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
    } else if (viewMode === 'week') {
      const startOfWeek = new Date(selectedDate);
      const dayOfWeek = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} - ${endOfWeek.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    } else {
      return selectedDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    }
  };

  if (isLoading) {
    return (
      <div className="unified-agenda-page">
        <div className="loading">Carregando agenda unificada...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="unified-agenda-page">
        <div className="error">{error}</div>
        <button onClick={loadEntries}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="unified-agenda-page">
      <div className="page-header">
        <h1>Agenda Unificada</h1>
        <p className="page-subtitle">Consolida todas as fontes de agenda em uma única visão</p>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Fonte:</label>
          <select 
            value={filterSource} 
            onChange={(e) => setFilterSource(e.target.value as CalendarEntrySource | '')}
          >
            <option value="">Todas</option>
            <option value={CalendarEntrySource.SERVICE_AVAILABILITY}>Disponibilidade de Serviço</option>
            <option value={CalendarEntrySource.CALENDAR_EVENT}>Evento de Agenda</option>
            <option value={CalendarEntrySource.UNIFIED_AVAILABILITY}>Disponibilidade Unificada</option>
            <option value={CalendarEntrySource.EVENT}>Evento</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Tipo:</label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as CalendarEntryType | '')}
          >
            <option value="">Todos</option>
            <option value={CalendarEntryType.AVAILABLE}>Disponível</option>
            <option value={CalendarEntryType.RESERVED}>Reservado</option>
            <option value={CalendarEntryType.BLOCKED}>Bloqueado</option>
            <option value={CalendarEntryType.UNAVAILABLE}>Indisponível</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Serviço ID:</label>
          <input 
            type="text" 
            value={filterServiceId} 
            onChange={(e) => setFilterServiceId(e.target.value)}
            placeholder="Filtrar por serviço"
          />
        </div>

        <div className="filter-group">
          <label>Evento ID:</label>
          <input 
            type="text" 
            value={filterEventId} 
            onChange={(e) => setFilterEventId(e.target.value)}
            placeholder="Filtrar por evento"
          />
        </div>
      </div>

      {/* Controles de visualização */}
      <div className="view-controls">
        <div className="view-mode-selector">
          <button 
            className={viewMode === 'day' ? 'active' : ''}
            onClick={() => setViewMode('day')}
          >
            Dia
          </button>
          <button 
            className={viewMode === 'week' ? 'active' : ''}
            onClick={() => setViewMode('week')}
          >
            Semana
          </button>
          <button 
            className={viewMode === 'month' ? 'active' : ''}
            onClick={() => setViewMode('month')}
          >
            Mês
          </button>
        </div>

        <div className="date-navigation">
          <button onClick={() => changeDate(-1)}>← Anterior</button>
          <h2>{getPeriodLabel()}</h2>
          <button onClick={() => changeDate(1)}>Próximo →</button>
          <button onClick={() => setSelectedDate(new Date())}>Hoje</button>
        </div>
      </div>

      {/* Lista de entradas */}
      {entries.length === 0 ? (
        <div className="empty-state">
          <p>Nenhuma entrada encontrada no período selecionado.</p>
        </div>
      ) : (
        <div className="entries-list">
          {entries.map((entry) => (
            <div 
              key={entry.id} 
              className={`entry-card ${getTypeClass(entry.type)}`}
              onClick={() => handleEntryClick(entry)}
            >
              <div className="entry-header">
                <h3>{entry.title}</h3>
                <div className="entry-badges">
                  <span className="badge-source" title={`Fonte: ${getSourceLabel(entry.source)}`}>
                    {getSourceLabel(entry.source)}
                  </span>
                  <span className={`badge-type ${getTypeClass(entry.type)}`}>
                    {getTypeLabel(entry.type)}
                  </span>
                </div>
              </div>
              
              <div className="entry-info">
                <p><strong>Início:</strong> {formatDate(entry.startTime)}</p>
                <p><strong>Fim:</strong> {formatDate(entry.endTime)}</p>
                {entry.description && (
                  <p><strong>Descrição:</strong> {entry.description}</p>
                )}
                {entry.locationAddress && (
                  <p><strong>Local:</strong> {entry.locationAddress}</p>
                )}
                {entry.serviceId && (
                  <p className="entry-link">
                    <strong>Serviço:</strong> #{entry.serviceId.substring(0, 8)}
                  </p>
                )}
                {entry.eventId && (
                  <p className="entry-link">
                    <strong>Evento:</strong> #{entry.eventId.substring(0, 8)}
                  </p>
                )}
                {entry.serviceOrderId && (
                  <p className="entry-link">
                    <strong>Ordem de Serviço:</strong> #{entry.serviceOrderId.substring(0, 8)}
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




