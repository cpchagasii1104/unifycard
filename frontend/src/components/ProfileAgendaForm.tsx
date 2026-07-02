import AvailabilityScheduleEnhanced from './AvailabilityScheduleEnhanced';
import type {
  UnifiedAvailability,
  UnifiedBooking,
  AvailabilityParticipant,
  MaterializeWeeklyTemplateResult,
  TemporalPurpose,
} from '../api/availability';
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
  // 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2 + DECISION-0132: persistência remota EXPLÍCITA, agora
  // enviando também a finalidade temporal por faixa (purposes).
  onSave: (
    newSchedule: AvailabilitySchedule,
    purposes: Record<string, string>
  ) => Promise<MaterializeWeeklyTemplateResult>;
  // 🔴 DECISION-0132: catálogo das 4 finalidades (do backend) + read-back das finalidades persistidas.
  temporalPurposes: TemporalPurpose[];
  initialPurposes: Record<string, string>;
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
  onSave,
  temporalPurposes,
  initialPurposes,
}: ProfileAgendaFormProps) {
  // 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2 + F-COMPANY-AGENDA-REAL-WIRING: esta tela edita a agenda
  // de Pessoa Física OU Empresa (page) — os dois tipos que o backend aceita nesta rota
  // (unified-availability.routes.ts restringe ownerType a user/page). Grupo NÃO tem fluxo aqui
  // (backend rejeitaria 400) — bloquear explicitamente em vez de mostrar um editor que finge persistir.
  const isEditableActorType = activeActor?.actor_type === 'user' || activeActor?.actor_type === 'page';
  const actorTypeLabel =
    activeActor?.actor_type === 'page' ? 'Empresa'
    : activeActor?.actor_type === 'group' ? 'Grupo'
    : activeActor?.actor_type === 'user' ? 'Pessoa Física'
    : (activeActor?.actor_type ?? 'desconhecido');
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
          Agenda do Ator – {actorTypeLabel}
        </h2>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          margin: 0,
        }}>
          <strong>Ator:</strong> {activeActor.display_name || activeActor.actor_id} ({actorTypeLabel})
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
            {activeActor?.actor_type === 'page'
              ? ' Esta é a agenda base da empresa e será usada para atendimentos e reservas.'
              : ' Esta é a agenda base do seu perfil como Pessoa Física e será usada para trabalho, convites, eventos, lazer, estudos e cuidados pessoais.'}
          </p>
        </div>
      )}

      {/* 🔴 F-AGENDA-EDITING-UX-TRUTHFULNESS-V2 + F-COMPANY-AGENDA-REAL-WIRING: edita como Pessoa
          Física OU Empresa (page) — os dois tipos aceitos pelo backend nesta rota. Grupo é bloqueado
          com mensagem explícita — sem editor que finja persistir (backend rejeitaria 400). */}
      {isEditableActorType ? (
        <AvailabilityScheduleEnhanced
          availability={schedule}
          onSave={onSave}
          // 🔴 DECISION-0132: finalidade temporal (4 concepts do backend) por faixa.
          temporalPurposes={temporalPurposes}
          initialPurposes={initialPurposes}
          // Selector de contexto legado segue oculto; a finalidade vem do seletor de purpose.
          showContextSelector={false}
        />
      ) : (
        <div
          role="note"
          style={{
            padding: '1.5rem',
            backgroundColor: '#fff7ed',
            border: '1px solid #fdba74',
            borderRadius: '0.75rem',
            color: '#9a3412',
            fontSize: '0.9375rem',
            lineHeight: 1.5,
          }}
        >
          <strong>🔒 Esta agenda edita Pessoa Física ou Empresa.</strong>
          <p style={{ margin: '0.5rem 0 0' }}>
            O ator ativo é <strong>um grupo</strong>, que tem fluxo próprio de disponibilidade — não
            editável por aqui. Para configurar sua agenda, selecione seu ator de Pessoa Física ou
            de Empresa.
          </p>
        </div>
      )}

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

