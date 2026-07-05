// src/pages/MyPageRedirect.tsx
// F-ACTOR-PAGE-SHELL-SLICE-3 — "Minha Página": a porta do menu para a casca universal.
// /perfil = o que eu CONFIGURO; /minha-pagina = como eu APAREÇO (a página como os outros veem).
// Resolvedor de APRESENTAÇÃO: lê o actor ATIVO (a mesma ActiveActorContext de todo o app) e
// projeta para a casca (/profile/:id ou /company/:id). Não cria verdade, não decide autoridade —
// a página revalida tudo no backend (contrato server-driven).

import { Navigate } from 'react-router-dom';
import { useActiveActor } from '../contexts/ActiveActorContext';

export default function MyPageRedirect() {
  const { activeActor, isLoading } = useActiveActor();

  if (isLoading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Abrindo sua página…</div>;
  }
  if (!activeActor?.actor_id) {
    // sem actor ativo resolvido → casa de configuração (recuperável, não beco)
    return <Navigate to="/perfil" replace />;
  }

  const dest = activeActor.actor_type === 'page'
    ? `/company/${activeActor.actor_id}`
    : `/profile/${activeActor.actor_id}`;
  return <Navigate to={dest} replace />;
}
