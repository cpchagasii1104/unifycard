// service-discovery-request-track-retirement.ts
// DECISION-0156 D5+D6: o trilho de descoberta paralela (services-discovery.service.ts) é APOSENTADO
// INCONDICIONALMENTE — não por flag (diferente do firewall financeiro DECISION-0110, que é reabrível).
// Duas violações da Lei de Coerência Sistêmica (Substratos Soberanos — uma verdade por domínio):
//
//   D5 — `services.metadata.availability` (blob JSON) é uma 2ª fonte de TEMPO. O SSOT temporal é
//        `availability`/`bookings` via Unified Availability (owner_type='service_offering'). Já
//        rejeitado como autoridade por DECISION-0132 §9; segue existindo só como legado sem poder
//        de decisão — nunca mais LIDO como fonte de disponibilidade.
//   D6 — `service_discovery_requests` é uma 2ª fonte de ESTADO (reserva). O SSOT de estado
//        reservável é `bookings`/`service_orders`. Nada CONVERGE pra essa tabela (0 linhas em
//        unificard_dev, zero consumidor backend fora deste módulo, zero caller no frontend
//        confirmado por grep cruzado) — "aposentar" (a alternativa que a norma permite a "convergir")
//        é a escolha de menor risco: não há dado real pra migrar, não há cliente ativo pra quebrar.
//
// Rotas cobertas por este arquivo: POST /offers, GET /search, GET /metrics, GET /my-requests,
// GET /provider-requests, POST /request/respond, GET /request/:requestId, POST /request.
// GET /search-by-term NÃO é afetada (não toca blob nem service_discovery_requests — confirmado
// via READ-FIRST — é o único caminho vivo do módulo, usado pelo frontend). POST /request/pay JÁ
// estava aposentada incondicionalmente por R8J/DECISION-0110 D2 (money-track, separado deste D5/D6).
//
// Reabrir exige decisão soberana nova (converger de verdade ao SSOT canônico OU redesenhar do zero) —
// nunca um flag. Os métodos do service (createOffer/search/createRequest/respondToRequest/
// listMyRequests/listProviderRequests/getRequest/metrics) permanecem no código, intocados e
// INALCANÇÁVEIS por estas rotas — preservados para auditoria, não apagados (Lei 2, forward-only).

export interface ServiceDiscoveryTrackRetiredBody {
  error: 'SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_BY_DECISION_0156';
  code: 'SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_BY_DECISION_0156';
  message: string;
  decision: 'DECISION-0156';
  route: string;
}

/** Corpo honesto de "trilho aposentado" para as rotas paralelas de descoberta/reserva/blob. */
export function serviceDiscoveryTrackRetiredBody(route: string): ServiceDiscoveryTrackRetiredBody {
  return {
    error: 'SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_BY_DECISION_0156',
    code: 'SERVICE_DISCOVERY_REQUEST_TRACK_RETIRED_BY_DECISION_0156',
    message:
      'Trilho de descoberta/reserva paralela aposentado por DECISION-0156 D5/D6 (Lei de Coerência ' +
      'Sistêmica: uma fonte de verdade por domínio). SSOT de agenda é a Unified Availability ' +
      '(availability/bookings); SSOT de reserva é bookings/service_orders. Use GET /services/discover ' +
      'e /services/offerings para a descoberta canônica.',
    decision: 'DECISION-0156',
    route,
  };
}
