// frontend/src/pages/MeusEventosPage.tsx
// Página de GESTÃO dos eventos do organizador (F-EVENT-ORGANIZER-DASHBOARD, 2026-08-03).
// Distinta de EventosPage, que é DESCOBERTA (feed público). Aqui é a visão de quem organiza:
// status, ingressos vendidos e o que falta para publicar.

import { Link } from 'react-router-dom';
import OrganizerEventsDashboard from '../components/events/OrganizerEventsDashboard';

export default function MeusEventosPage() {
  return (
    <div className="page-container">
      <div className="flow-header">
        <h1>Meus eventos</h1>
        <p className="flow-subtitle">
          Tudo que você organiza, por situação. <Link to="/events/new">Criar novo evento</Link>.
        </p>
      </div>
      <OrganizerEventsDashboard />
    </div>
  );
}
