import AvailabilityScheduleEnhanced from './AvailabilityScheduleEnhanced';
import type { UnifiedAvailability, UnifiedBooking, AvailabilityParticipant } from '../api/availability';
import type { AvailabilitySchedule } from '../api/categories';

interface ProfileAgendaFormProps {
  activeActor: any;
  availabilities: UnifiedAvailability[];
  bookings: UnifiedBooking[];
  participantsMap: Record<string, AvailabilityParticipant[]>;
  schedule: AvailabilitySchedule;
  isEmpty: boolean;
  formatDate: (dateString: string) => string;
  getStatusLabel: (status: string) => string;
  getStatusColor: (status: string) => string;
  handleScheduleChange: (newSchedule: AvailabilitySchedule) => Promise<void>;
  onContextChange: (dayKey: string, slotIndex: number, context: 'WORK' | 'LEISURE' | 'STUDY' | null) => void;
}

export default function ProfileAgendaForm({
  activeActor,
  availabilities,
  bookings,
  participantsMap,
  schedule,
  isEmpty,
  formatDate,
  getStatusLabel,
  getStatusColor,
  handleScheduleChange,
  onContextChange,
}: ProfileAgendaFormProps) {
  return (
    <div className="profile-agenda">
      {/* 🔴 REGRA: Exibir claramente o actor da agenda */}
      <div className="agenda-header" style={{
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid #e5e7eb',
      }}>
        <h2 style={{ 
          fontSize: '1.5rem', 
          fontWeight: '600', 
          color: '#111827',
          margin: 0,
          marginBottom: '0.5rem',
        }}>
          Agenda do Ator – Pessoa Física
        </h2>
        <p style={{ 
          fontSize: '0.875rem', 
          color: '#6b7280',
          margin: 0,
        }}>
          <strong>Ator:</strong> {activeActor.display_name || activeActor.actor_id} (Pessoa Física)
          {activeActor.actor_type !== 'user' && (
            <span style={{ marginLeft: '0.5rem', fontStyle: 'italic' }}>
              ({activeActor.actor_type === 'page' ? 'Empresa' : activeActor.actor_type === 'group' ? 'Grupo' : activeActor.actor_type})
            </span>
          )}
        </p>
      </div>

      {/* Sistema de Agenda Avançado - Sempre visível */}
      {isEmpty && (
        <div className="empty-state-elegant" style={{
          padding: '2rem',
          textAlign: 'center',
          backgroundColor: '#f0f9ff',
          borderRadius: '0.75rem',
          border: '1px solid #bae6fd',
          marginBottom: '2rem',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</div>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            color: '#0369a1',
            marginBottom: '0.5rem',
          }}>
            Configure sua agenda para começar a receber agendamentos
          </h3>
          <p style={{ 
            fontSize: '0.875rem', 
            color: '#0284c7',
            maxWidth: '32rem',
            margin: '0 auto',
          }}>
            Configure seus horários disponíveis.
            Esta é a agenda base do seu perfil como Pessoa Física e será usada para trabalho, convites, eventos, lazer, estudos e cuidados pessoais.
          </p>
        </div>
      )}

      {/* Editor de Agenda Avançado - Sempre visível */}
      <AvailabilityScheduleEnhanced
        availability={schedule}
        onChange={handleScheduleChange}
        // 🔴 UX TEMPORAL CANÔNICO: Seletor de contexto apenas para user actors
        showContextSelector={activeActor?.actor_type === 'user'}
        onContextChange={onContextChange}
      />

      {/* Lista de Disponibilidades Existentes (se houver) */}
      {availabilities.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ 
            fontSize: '1.125rem', 
            fontWeight: '600', 
            marginBottom: '1rem',
            color: '#374151',
          }}>
            Disponibilidades Ativas ({availabilities.length})
          </h3>
          <div className="availabilities-list">
            {availabilities.slice(0, 5).map((availability) => {
              const availabilityBookings = bookings.filter(
                b => b.availabilityId === availability.availabilityId
              );
              const participants = participantsMap[availability.availabilityId] || [];

              return (
                <div key={availability.availabilityId} className="availability-card" style={{
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  backgroundColor: '#ffffff',
                }}>
                  <div className="availability-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                  }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>
                      {availability.availabilityType === 'recurring' ? '🔄 Recorrente' : '📅 Fixa'}
                    </h4>
                    <span
                      className="status-badge"
                      style={{ 
                        backgroundColor: getStatusColor(availability.status),
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                      }}
                    >
                      {getStatusLabel(availability.status)}
                    </span>
                  </div>

                  <div className="availability-details" style={{
                    fontSize: '0.875rem',
                    color: '#6b7280',
                  }}>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Início:</strong> {formatDate(availability.startDatetime)}
                    </div>
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Fim:</strong> {formatDate(availability.endDatetime)}
                    </div>
                    {availability.capacity && (
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>Capacidade:</strong> {availability.capacity}
                      </div>
                    )}
                    {availabilityBookings.length > 0 && (
                      <div style={{ 
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid #e5e7eb',
                      }}>
                        <strong>Agendamentos:</strong> {availabilityBookings.length}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {availabilities.length > 5 && (
              <p style={{ 
                textAlign: 'center', 
                color: '#6b7280',
                fontSize: '0.875rem',
                marginTop: '1rem',
              }}>
                Mostrando 5 de {availabilities.length} disponibilidades
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

