// src/pages/ServiceLegacyQuarantinePage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA (página-guia honesta / quarentena de rota)
// F-MVP-SERVICE-CHAIN-UX-DEAD-END-SWEEP (2026-06-26).
//
// LEI DA ROTA (não do botão): uma `service_order` nasce SOMENTE pelo fluxo canônico
//   reserva de oferta → decisão ACCEPTED do prestador → confirmBookingFromDecision → ordem (auto).
// POST /service-orders direto = 403 SERVICE_ORDER_DIRECT_CREATE_DISABLED (lei soberana do backend).
//
// Esta página é o TERMINAL HONESTO das rotas legadas de criação direta / System-A:
//   - /service-orders/new   (antiga CreateServiceOrderPage, formulário de criação direta)
//   - /booking-requests     (antiga ServiceBookingRequestsPage, lista System-A)
//   - /services/:id/bookings (antiga ServiceBookingsPage, gestão/cancelamento direto de reserva)
// Ela NÃO cria ordem, NÃO faz POST, NÃO navega para /service-orders/new, NÃO reabre o 403.
// Apenas explica a lei e oferece CTAs canônicos conforme a persona do actor ativo.
//
// F-SERVICE-BOOKING-ORPHAN-SURFACE-QUARANTINE (2026-06-26): a variante 'bookings-manage'
// quarentena /services/:id/bookings. O writer daquela página (updateServiceBooking →
// PUT /services/:serviceId/bookings/:bookingId) bate em rota INEXISTENTE no backend (404):
// não há writer vivo concorrente, apenas uma superfície oca alcançável. O cancel canônico
// vive no core (/availability/bookings/:id) e as reservas pendentes vivem na Central do
// prestador (fluxo de decisão). Esta página NÃO chama listServiceBooking/updateServiceBooking.

import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';
import './ServiceLegacyQuarantinePage.css';

// F-MVP-SERVICE-CHAIN-W1-OFFERING-AVAILABILITY-UX-CONTAINMENT (2026-06-27): a variante
//   'availability-offering-managed' quarentena /services/:id/availability (antiga ServiceAvailabilityPage,
//   que criava availability SERVICE-level via POST /services/:id/availability, owner=service). Essa agenda
//   é INVISÍVEL ao consumer, que reserva pela availability da OFERTA (owner_type='service_offering', lida
//   pelo ServiceOfferingSelector). Decisão de produto soberana (Clayton): no MVP a disponibilidade
//   reservável = availability da OFERTA, definida ao publicar o serviço (ServiceCreatePage →
//   declareOfferingAvailability). Esta página NÃO chama createServiceAvailability/listServiceAvailabilities;
//   apenas explica a lei e devolve para a superfície viva (Central do prestador / publicar serviço).
type QuarantineVariant = 'order-create' | 'booking-requests' | 'bookings-manage' | 'availability-offering-managed';

interface ServiceLegacyQuarantinePageProps {
  variant: QuarantineVariant;
}

const COPY: Record<QuarantineVariant, { title: string; lead: string }> = {
  'order-create': {
    title: 'Criação direta de ordem foi encerrada',
    lead:
      'Uma ordem de serviço não é mais criada manualmente. Ela nasce sozinha pelo fluxo canônico: ' +
      'o cliente reserva uma oferta, o prestador aceita a reserva e a ordem é gerada automaticamente a partir do aceite.',
  },
  'booking-requests': {
    title: 'As solicitações agora vivem na Central do prestador',
    lead:
      'A lista de solicitações de reserva foi unificada na Central do prestador. ' +
      'É lá que você decide cada reserva (aceitar ou recusar) — e a ordem de serviço nasce do aceite.',
  },
  'bookings-manage': {
    title: 'A gestão direta de reservas foi encerrada',
    lead:
      'Esta tela antiga listava e cancelava reservas por um caminho que o backend não oferece mais. ' +
      'As reservas agora seguem o fluxo canônico: o cliente reserva uma oferta e você decide cada ' +
      'reserva pendente na Central do prestador — onde o aceite gera a ordem de serviço automaticamente.',
  },
  'availability-offering-managed': {
    title: 'A agenda reservável é a da oferta',
    lead:
      'A disponibilidade que o cliente reserva é a da OFERTA do serviço — definida quando você publica o ' +
      'serviço. Não existe uma agenda separada por serviço: uma agenda paralela aqui ficaria invisível para ' +
      'quem tenta reservar. Para abrir ou ajustar horários reserváveis, publique/gerencie a oferta na Central.',
  },
};

export default function ServiceLegacyQuarantinePage({ variant }: ServiceLegacyQuarantinePageProps) {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const copy = COPY[variant];
  const isProvider = activeActor?.actor_type === 'page';

  return (
    <div className="service-legacy-quarantine-page">
      <div className="quarantine-card">
        <div className="quarantine-icon" aria-hidden="true">🧭</div>
        <h1>{copy.title}</h1>
        <p className="quarantine-lead">{copy.lead}</p>

        <ol className="quarantine-flow">
          <li>O cliente reserva uma oferta do serviço.</li>
          <li>O prestador decide a reserva (aceitar ou recusar).</li>
          <li>No aceite, a ordem de serviço é criada automaticamente.</li>
        </ol>

        <div className="quarantine-actions">
          {isProvider ? (
            <>
              <button className="btn-primary" onClick={() => navigate('/services')}>
                Ir para a Central do prestador
              </button>
              <button className="btn-secondary" onClick={() => navigate('/services/new')}>
                Publicar serviço
              </button>
            </>
          ) : (
            <>
              <button className="btn-primary" onClick={() => navigate('/discover/services')}>
                Explorar serviços
              </button>
              <button className="btn-secondary" onClick={() => navigate('/service-orders')}>
                Acompanhar meus pedidos
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
