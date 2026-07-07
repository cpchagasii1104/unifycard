// frontend/src/pages/OpportunitiesPage.tsx
// DECISION-0164 fatia B — "Ver oportunidades" (pull do provider) + Minhas demandas (emissor)
// + Publicar demanda. A tela PROJETA o substrato; wizard se molda ao VÍNCULO (decisão Clayton).
import { useCallback, useEffect, useState } from 'react';
import { useActiveActor } from '../contexts/ActiveActorContext';
import { showToast } from '../components/common/Toast';
import {
  getDemand, listMyDemands, listOpportunities,
  respondDemand, chooseResponse, withdrawResponse,
  type DemandResponse, type ServiceDemand,
} from '../api/demands';
import DemandPublishForm, { VINCULO_PT, WEEKDAY_PT } from '../components/demands/DemandPublishForm';
import { useActorMode } from '../hooks/useActorMode';
import './OpportunitiesPage.css';
const money = (c: number | null) => (c === null ? '—' : `R$ ${(c / 100).toFixed(2)}`);
const conceptLabel = (slug?: string) => (slug ?? '').replace(/-/g, ' ');

function DemandCard({ d, footer }: { d: ServiceDemand; footer?: React.ReactNode }) {
  return (
    <div className="opp-card">
      <div className="opp-card-head">
        <span className="opp-concept">🎯 {conceptLabel(d.conceptSlug)}</span>
        <span className={`opp-status opp-status-${d.status}`}>{d.status === 'open' ? 'Aberta' : d.status === 'filled' ? 'Preenchida' : d.status}</span>
      </div>
      <strong className="opp-title">{d.title}</strong>
      {d.description && <p className="opp-desc">{d.description}</p>}
      <div className="opp-meta">
        <span>{VINCULO_PT[d.vinculo]}</span>
        {d.dateStart && <span>📅 {d.dateStart}{d.dateEnd ? ` → ${d.dateEnd}` : ''}</span>}
        {d.timeStart && <span>🕐 {d.timeStart.slice(0, 5)}–{d.timeEnd?.slice(0, 5)}{d.breakMinutes ? ` (⏸️ ${d.breakMinutes}min intervalo)` : ' (direto)'}</span>}
        {d.weekdays && d.weekdays.length > 0 && <span>{d.weekdays.map((w) => WEEKDAY_PT[w]).join('/')}</span>}
        {d.radiusKm !== null && <span>📍 raio {d.radiusKm} km</span>}
        <span>👥 {d.quantityFilled}/{d.quantity} vaga{d.quantity > 1 ? 's' : ''}</span>
        <span>{d.pricingMode === 'orcamento' ? '💬 Orçamento' : `💰 ${money(d.offeredPriceCents)}`}</span>
        <span>{d.acceptanceMode === 'automatico' ? '⚡ Aceite automático' : '🔍 Com análise'}</span>
        {d.cancelNoticeHours != null && <span>⏰ avisar {d.cancelNoticeHours}h antes</span>}
      </div>
      {footer}
    </div>
  );
}

export default function OpportunitiesPage() {
  const { activeActor } = useActiveActor();
  const { mode } = useActorMode();
  // Aba default por ?tab= OU pelo MODO OPERANTE (projeção, decisão registrada no pack):
  // Consumindo = eu PROCURO oportunidade (pull) · Operando = eu PUBLICO/giro minhas demandas.
  const initialTab = new URLSearchParams(window.location.search).get('tab');
  const [tab, setTab] = useState<'oportunidades' | 'minhas' | 'publicar'>(
    initialTab === 'publicar' ? 'publicar'
      : initialTab === 'minhas' ? 'minhas'
      : initialTab === 'oportunidades' ? 'oportunidades'
      : mode === 'operar' ? 'minhas' : 'oportunidades');
  const [onlyMatching, setOnlyMatching] = useState(false);
  const [opps, setOpps] = useState<ServiceDemand[]>([]);
  const [mine, setMine] = useState<ServiceDemand[]>([]);
  const [detail, setDetail] = useState<{ demand: ServiceDemand; responses: DemandResponse[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [quoteById, setQuoteById] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    if (!activeActor?.actor_id) return;
    listOpportunities(onlyMatching).then(setOpps).catch(() => setOpps([]));
    listMyDemands().then(setMine).catch(() => setMine([]));
  }, [activeActor?.actor_id, onlyMatching]);
  useEffect(() => { load(); }, [load]);

  const doRespond = async (d: ServiceDemand) => {
    const quote = quoteById[d.id];
    if (d.pricingMode === 'orcamento' && !quote) { showToast('Esta demanda pede orçamento — informe o valor.', 'error'); return; }
    setBusy(true);
    try {
      await respondDemand(d.id, d.pricingMode === 'orcamento' ? { quoteCents: Math.round(parseFloat(quote) * 100) } : {});
      showToast(d.acceptanceMode === 'automatico' ? 'Vaga aceita — fechou! 🎉' : 'Candidatura enviada — aguarde a análise.', 'success');
      load();
    } catch (e) { showToast((e as Error)?.message || 'Falha ao responder.', 'error'); }
    finally { setBusy(false); }
  };

  const openDetail = async (id: string) => {
    try { setDetail(await getDemand(id)); } catch { showToast('Falha ao abrir demanda.', 'error'); }
  };

  // Rota já vive dentro do shell autenticado (App.tsx) — sem layout próprio (evita shell duplo)
  return (
      <div className="opp-page">
        <h1>🎯 Oportunidades</h1>
        <p className="opp-sub">O motor de orquestração: demandas de trabalho e serviço da comunidade.</p>
        <nav className="opp-tabs">
          <button className={tab === 'oportunidades' ? 'active' : ''} onClick={() => setTab('oportunidades')}>Ver oportunidades</button>
          <button className={tab === 'minhas' ? 'active' : ''} onClick={() => { setTab('minhas'); setDetail(null); }}>Minhas demandas</button>
          <button className={tab === 'publicar' ? 'active' : ''} onClick={() => setTab('publicar')}>+ Publicar demanda</button>
        </nav>

        {tab === 'oportunidades' && (
          <>
            <label className="opp-matching">
              <input type="checkbox" checked={onlyMatching} onChange={(e) => setOnlyMatching(e.target.checked)} />
              Só o que combina com meu perfil profissional
            </label>
            {opps.length === 0 && <p className="opp-empty">Nenhuma oportunidade aberta {onlyMatching ? 'para o seu perfil — complete a aba Profissional do Meu Perfil' : 'no momento'}.</p>}
            {opps.map((d) => (
              <DemandCard key={d.id} d={d} footer={
                <div className="opp-actions">
                  {d.pricingMode === 'orcamento' && (
                    <input type="number" min="0" step="0.01" placeholder="Seu orçamento (R$)"
                      value={quoteById[d.id] ?? ''} onChange={(e) => setQuoteById((m) => ({ ...m, [d.id]: e.target.value }))} />
                  )}
                  <button disabled={busy} onClick={() => void doRespond(d)}>
                    {d.acceptanceMode === 'automatico' ? '⚡ Aceitar vaga' : '✋ Me candidatar'}
                  </button>
                </div>
              } />
            ))}
          </>
        )}

        {tab === 'minhas' && !detail && (
          <>
            {mine.length === 0 && <p className="opp-empty">Você ainda não publicou demandas.</p>}
            {mine.map((d) => (
              <DemandCard key={d.id} d={d} footer={
                <div className="opp-actions"><button onClick={() => void openDetail(d.id)}>Ver candidatos/aceites →</button></div>
              } />
            ))}
          </>
        )}

        {tab === 'minhas' && detail && (
          <div>
            <button className="opp-back" onClick={() => { setDetail(null); load(); }}>← Voltar</button>
            <DemandCard d={detail.demand} />
            <h3>Respostas ({detail.responses.length})</h3>
            {detail.responses.length === 0 && <p className="opp-empty">Ninguém respondeu ainda — o matching segue aberto.</p>}
            {detail.responses.map((r) => (
              <div key={r.id} className="opp-response">
                <div>
                  <a href={`/profile/${r.providerActorId}`}><strong>{r.providerDisplayName ?? 'Profissional'}</strong></a>
                  <span className={`opp-rstatus opp-rstatus-${r.status}`}> · {r.status === 'pending' ? 'candidato' : r.status === 'chosen' ? 'ESCOLHIDO ✓' : r.status === 'accepted' ? 'ACEITOU ✓' : r.status === 'withdrawn' ? 'cancelou' : r.status}</span>
                  {r.quoteCents !== null && <span> · orçou {money(r.quoteCents)}</span>}
                  {r.message && <p className="opp-desc">{r.message}</p>}
                </div>
                {detail.demand.acceptanceMode === 'com_analise' && r.status === 'pending' && detail.demand.status === 'open' && (
                  <button disabled={busy} onClick={async () => {
                    setBusy(true);
                    try { await chooseResponse(detail.demand.id, r.id); showToast('Escolhido! Vaga preenchida.', 'success'); await openDetail(detail.demand.id); }
                    catch (e) { showToast((e as Error)?.message || 'Falha.', 'error'); } finally { setBusy(false); }
                  }}>Escolher este</button>
                )}
                {(r.status === 'accepted' || r.status === 'chosen' || r.status === 'pending') && r.providerActorId === activeActor?.actor_id && (
                  <button disabled={busy} onClick={async () => {
                    setBusy(true);
                    try { await withdrawResponse(detail.demand.id, r.id); showToast('Cancelado — a vaga reabriu.', 'success'); await openDetail(detail.demand.id); }
                    catch (e) { showToast((e as Error)?.message || 'Falha.', 'error'); } finally { setBusy(false); }
                  }}>Cancelar minha resposta</button>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'publicar' && (
          <DemandPublishForm onPublished={() => { setTab('minhas'); load(); }} />
        )}
      </div>
  );
}
