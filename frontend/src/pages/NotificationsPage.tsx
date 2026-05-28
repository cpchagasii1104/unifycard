// src/pages/NotificationsPage.tsx
//
// Página placeholder honesta para rota /notifications.
// Resolve DT-UX-GHOST-ROUTE-NOTIFICATIONS: link do sino no header existia,
// mas rota não, gerando tela em branco.
//
// IMPORTANTE — escolha consciente:
// Existem `frontend/src/api/system-notifications.ts` e
// `frontend/src/components/system-notifications/NotificationList.tsx` (consome
// API real). Esta página NÃO integra com eles intencionalmente porque:
//   (a) o prompt desta fatia pediu placeholder honesto, sem buscar backend;
//   (b) integração formal exige decisão de produto sobre filtros, contextos,
//       paginação, política de read/unread visíveis para o usuário etc.;
//   (c) o componente foi escrito para ser embutido em outro contexto, não
//       como rota dedicada.
// Quando a fatia de produto autorizar a central, esta página vira o host de
// <NotificationList /> ou equivalente.

import { useNavigate } from 'react-router-dom';

export default function NotificationsPage() {
  const navigate = useNavigate();

  return (
    <div
      style={{
        padding: '2.5rem 2rem',
        maxWidth: 720,
        margin: '0 auto',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>
        Notificações
      </h1>
      <p style={{ color: '#475569', lineHeight: 1.6, marginBottom: '1.5rem' }}>
        A central de notificações está em preparação. Quando ela for ativada,
        as notificações reais do sistema aparecerão aqui — sem badge fake e
        sem item simulado.
      </p>
      <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '2rem' }}>
        Nada novo por enquanto.
      </p>
      <button
        type="button"
        onClick={() => navigate('/home')}
        style={{
          padding: '0.6rem 1.4rem',
          background: '#0ea5e9',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Voltar para a Home
      </button>
    </div>
  );
}
