// src/pages/EventCreationPage.tsx
// 🔴 FRONTEND CANÔNICO — CAMADA DERIVADA
// Arquétipo: Entity Declaration / Creation Page
// FASE 5.0 — Event Creation Orchestration
//
// REGRAS SEMÂNTICAS OBRIGATÓRIAS:
// - Evento = Rascunho
// - Data = Janela possível
// - Local = Requisito de espaço
// - Fornecedor = Papel operacional
// - Valor = Intervalo estimado (TEST)

import { useSearchParams } from 'react-router-dom';
import EventCreationGuidedFlow from '../components/events/EventCreationGuidedFlow';
import EventDeclarationForm from '../components/events/EventDeclarationForm';

export default function EventCreationPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('id');

  // 🔴 P0-1: Rota única - /events/new SEMPRE inicia pelo EventCreationGuidedFlow
  // Formulário antigo (EventDeclarationForm) só é acessível via query param explícito
  // e apenas para edição de evento existente
  if (eventId && searchParams.get('form') === 'legacy') {
    // Apenas para edição de evento existente com formulário legado explícito
    return <EventDeclarationForm />;
  }

  // Padrão: sempre usar fluxo guiado FASE 5.0
  return <EventCreationGuidedFlow />;
}














