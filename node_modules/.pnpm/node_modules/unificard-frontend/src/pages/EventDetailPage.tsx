// src/pages/EventDetailPage.tsx
// Página de detalhes de evento

import { useParams } from 'react-router-dom';
import EventPage from '../components/events/EventPage';

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();

  if (!id) {
    return <div>ID do evento não fornecido</div>;
  }

  return (
    <EventPage
      eventId={id}
      onNavigateToCheckout={(type) => {
        console.log('Navigate to checkout:', type);
        // Implementar navegação para checkout
      }}
    />
  );
}













