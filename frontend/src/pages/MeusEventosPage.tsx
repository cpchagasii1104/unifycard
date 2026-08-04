// frontend/src/pages/MeusEventosPage.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — "Meus eventos", com as DUAS faces do modo operante
// ║ NORMA:   "Modo operante prioriza, NÃO esconde" (operatingMode.ts:9) · precedente de modo que
// ║          troca CONTEÚDO = RentalResourceListPage (não ProviderServiceHubPage, que só troca rótulo)
// ║ NÃO:     NÃO esconder a outra face — cada modo carrega o convite explícito para o oposto.
// ║ EM VEZ:  trocar a fonte de dados e o corpo, mantendo as duas alcançáveis.
// ╚════════════════════════════════════════════════════════════════
//
// Desenho de Clayton (2026-08-04):
//   OPERAR   → os eventos que eu administro, por situação (o que já existia)
//   CONSUMIR → as empresas que me ajudam a realizar: segurança, energia, banheiros, palcos, equipamento
//
// Distinta de EventosPage, que é DESCOBERTA (vitrine pública).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import OrganizerEventsDashboard from '../components/events/OrganizerEventsDashboard';
import SupplierCatalog from '../components/events/SupplierCatalog';
import { useOperatingMode } from '../hooks/useOperatingMode';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { listOrganizerEvents, type Event } from '../api/events';

export default function MeusEventosPage() {
  const { mode } = useOperatingMode();

  if (mode === 'consumir') {
    return <MeusEventosConsumir />;
  }

  return (
    <div className="page-container">
      <div className="flow-header">
        <h1>Meus eventos</h1>
        <p className="flow-subtitle">
          Tudo que você organiza, por situação. <Link to="/events/new">Criar novo evento</Link>.
        </p>
      </div>
      {/* "Prioriza, não esconde": a outra face segue anunciada, nunca removida. */}
      <div className="eventos-mode-banner" role="note">
        <strong>Você está operando.</strong> Procurando quem fornece som, segurança ou banheiro
        químico para os seus eventos? Troque para <em>Consumir</em> no topo da página.
      </div>
      <OrganizerEventsDashboard />
    </div>
  );
}

/**
 * Face CONSUMIR — o CATÁLOGO de quem me ajuda a realizar. Carrega os eventos que EU organizo
 * (mesma fonte da face Operar: o backend decide o que posso ver) e os passa ao catálogo apenas
 * como CONTEXTO DE DATA — o eixo da tela é o tipo de fornecedor, não o evento.
 */
function MeusEventosConsumir() {
  const { activeActor, actors } = useActiveActor();
  const [events, setEvents] = useState<Event[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      // Mesmo motivo da face Operar: "meus eventos" é o que EU organizo em QUALQUER papel, e o
      // organizador troca de chapéu no cabeçalho. Uma chamada por papel, tolerante a falha de um.
      const ids = Array.from(new Set([
        ...(actors ?? []).map((a) => a.actor_id),
        ...(activeActor?.actor_id ? [activeActor.actor_id] : []),
      ].filter(Boolean)));
      if (ids.length === 0) return;
      try {
        const results = await Promise.allSettled(ids.map((id) => listOrganizerEvents(id)));
        if (cancelled) return;
        const porId = new Map<string, Event>();
        for (const r of results) {
          if (r.status === 'fulfilled') for (const ev of r.value) porId.set(ev.id, ev);
        }
        const list = Array.from(porId.values());
        setEvents(list);
      } catch (e) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar seus eventos.');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [activeActor?.actor_id, actors]);

  return (
    <div className="page-container">
      <div className="flow-header">
        <h1>Quem me ajuda</h1>
        <p className="flow-subtitle">
          Empresas e profissionais que atendem o que os seus eventos precisam.
        </p>
      </div>

      <div className="eventos-mode-banner" role="note">
        <strong>Você está consumindo.</strong> Para acompanhar status, ingressos vendidos e o que
        falta publicar, troque para <em>Operar</em> no topo da página.
      </div>

      {erro && <p className="organizer-hint organizer-hint-warn">{erro}</p>}
      {events === null && !erro && <p className="organizer-hint">Carregando seus eventos…</p>}

      {events !== null && events.length === 0 && (
        <p className="organizer-hint">
          Você ainda não tem eventos — <Link to="/events/new">criar o primeiro</Link>. O catálogo
          abaixo funciona mesmo assim; o evento serve só para filtrar por data.
        </p>
      )}

      {/* 🔴 2026-08-04 — O EIXO FOI INVERTIDO (Clayton apontou 3×).
          Antes: abas com os EVENTOS do organizador no topo, e as necessidades daquele evento
          embaixo. Isso responde "de que ESTE evento precisa?" — pergunta do painel de UM evento,
          errada como catálogo, e foi o que ele marcou de vermelho no print.
          Agora: o eixo é o TIPO DE FORNECEDOR (18, do template governado), e o evento entra como
          FILTRO DE CONTEXTO — escolhê-lo faz o SERVIDOR derivar a janela de data dele.
          O componente antigo (EventSupplierBoard) NÃO foi apagado: segue servindo ao painel de um
          evento específico, que é onde a pergunta event-first é a certa. */}
      {/* 🔴 2026-08-04 — O CATÁLOGO NÃO DEPENDE DE TER EVENTO. Ele estava atrás de
          `events.length > 0`, então quem ainda não criou evento nenhum via a tela VAZIA — logo
          quem mais precisa descobrir fornecedor (quem está começando) era exatamente quem não via
          nada. A rota `/events/supplier-catalog` é desacoplada de evento POR DESENHO (não é
          organizer-gated); a tela é que reintroduzia o acoplamento. O evento entra só como filtro
          de contexto — e `eventos={[]}` apenas deixa o seletor "Para o evento" sem opções. */}
      {events !== null && <SupplierCatalog eventos={events} />}
    </div>
  );
}
