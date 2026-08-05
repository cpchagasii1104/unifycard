// frontend/src/components/events/SupplierCatalog.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — o CATÁLOGO de fornecedores para evento (face Consumir de /meus-eventos)
// ║ NORMA:   "a verdade vive no backend" · filtro temporal é SERVER-SIDE (SSOT temporal)
// ║ NÃO:     NÃO enumerar tipos de fornecedor aqui; NÃO filtrar janela no cliente; NÃO usar os
// ║          EVENTOS do usuário como eixo principal.
// ║ EM VEZ:  getSupplierCatalog() — tipos vêm do template governado, filtro roda no servidor.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O EIXO, QUE ESTAVA INVERTIDO (Clayton apontou 3×) ═══
// *"no lugar dos eventos que estão aparecendo, deveria aparecer os tipos de empresas, exemplo
// segurança, fotografia, tendas, etc. E eu poder filtrar por data e horário"*
//
// A versão anterior usava `getEventNeedSuppliers` (event-first) como menu: o topo listava os
// EVENTOS do organizador, e as necessidades vinham embaixo. Isso responde "de que este evento
// precisa?" — útil no painel de UM evento, errado como catálogo.
//
// Aqui o eixo é o TIPO DE FORNECEDOR (18, do template governado, através de todos os formatos), e
// o evento vira FILTRO DE CONTEXTO — quando escolhido, o servidor deriva a janela de data dele.
//
// ⚠️ O filtro por data roda NO SERVIDOR. Recortar no cliente daria "3 de 50" quando o teto já
// tivesse cortado o que interessa — e quem conhece o conjunto inteiro é o servidor.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSupplierCatalog, type NeedWithSuppliers, type Event } from '../../api/events';
import { formatSupplierPrice } from '../../utils/money';
import './EventSupplierBoard.css';
import './SupplierCatalog.css';

interface Props {
  /** Eventos do usuário — entram como CONTEXTO de data, nunca como eixo. */
  eventos: Event[];
}


function inicioDoEvento(ev: Event): string | null {
  return ev.startAt ?? ev.datetimeStart ?? null;
}

/**
 * Dia legível de uma janela que o SERVIDOR resolveu. Aceita null porque o servidor pode não ter
 * alternativa a oferecer — e nesse caso a tela não inventa uma: some.
 */
function formatarDia(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export default function SupplierCatalog({ eventos }: Props) {
  const [tipos, setTipos] = useState<NeedWithSuppliers[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  // Filtros — todos viram QUERY no servidor, nenhum recorta lista já recebida.
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('');
  const [eventoContexto, setEventoContexto] = useState<string>('');
  const [de, setDe] = useState<string>('');
  const [ate, setAte] = useState<string>('');
  const [soComFornecedor, setSoComFornecedor] = useState(false);

  const carregar = useCallback(async (): Promise<void> => {
    setErro(null);
    try {
      const dados = await getSupplierCatalog({
        // Janela explícita vence; senão o evento de contexto manda o servidor derivar a dele.
        availableFrom: de ? new Date(de).toISOString() : undefined,
        availableTo: ate ? new Date(ate).toISOString() : undefined,
        eventId: !de && !ate && eventoContexto ? eventoContexto : undefined,
        needConceptId: tipoSelecionado || undefined,
      });
      setTipos(dados);
    } catch (e) {
      // Falha NÃO vira lista vazia: vazio afirma "não há fornecedor", e não é o que aconteceu.
      setTipos(null);
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o catálogo.');
    }
  }, [de, ate, eventoContexto, tipoSelecionado]);

  useEffect(() => { void carregar(); }, [carregar]);

  /** Lista de tipos para o seletor — vem do próprio catálogo, nunca escrita à mão aqui. */
  const [todosOsTipos, setTodosOsTipos] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    getSupplierCatalog()
      .then((t) => { if (!cancelled) setTodosOsTipos(t.map((x) => ({ id: x.needConceptId, label: x.label }))); })
      // Falha aqui NÃO pode virar silêncio: o seletor sumiria e a tela pareceria "sem tipos".
      // Não derruba a lista principal (que tem o próprio tratamento), mas deixa o erro APARECER.
      .catch((e) => { if (!cancelled) console.error('[SupplierCatalog] seletor de tipos indisponível:', e); });
    return () => { cancelled = true; };
  }, []);

  const visiveis = useMemo(
    () => (tipos ?? []).filter((t) => !soComFornecedor || t.supplierCount > 0),
    [tipos, soComFornecedor]
  );
  const temFiltro = !!tipoSelecionado || !!eventoContexto || !!de || !!ate || soComFornecedor;
  const limpar = (): void => {
    setTipoSelecionado(''); setEventoContexto(''); setDe(''); setAte(''); setSoComFornecedor(false);
  };

  const eventoEscolhido = eventos.find((e) => e.id === eventoContexto);

  return (
    <div className="supplier-catalog">
      {/* ── FILTROS — este é o lugar que Clayton marcou de vermelho ── */}
      <div className="sc-filtros" role="search" aria-label="Filtrar fornecedores">
        <label className="sc-filtro">
          <span className="sc-filtro-rotulo">Tipo de fornecedor</span>
          <select value={tipoSelecionado} onChange={(e) => setTipoSelecionado(e.target.value)}>
            <option value="">Todos os tipos</option>
            {todosOsTipos.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>

        <label className="sc-filtro">
          <span className="sc-filtro-rotulo">Para o evento</span>
          <select
            value={eventoContexto}
            onChange={(e) => { setEventoContexto(e.target.value); setDe(''); setAte(''); }}
          >
            <option value="">Qualquer data</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        </label>

        <label className="sc-filtro">
          <span className="sc-filtro-rotulo">Disponível de</span>
          <input type="datetime-local" value={de} onChange={(e) => { setDe(e.target.value); setEventoContexto(''); }} />
        </label>

        <label className="sc-filtro">
          <span className="sc-filtro-rotulo">até</span>
          <input type="datetime-local" value={ate} onChange={(e) => { setAte(e.target.value); setEventoContexto(''); }} />
        </label>

        <label className="sc-filtro sc-filtro-check">
          <input type="checkbox" checked={soComFornecedor} onChange={(e) => setSoComFornecedor(e.target.checked)} />
          <span>Só com fornecedor</span>
        </label>

        {temFiltro && <button type="button" className="sc-limpar" onClick={limpar}>limpar</button>}
      </div>

      {eventoEscolhido && (
        <p className="organizer-hint organizer-hint-muted">
          Mostrando quem declarou atender na data de <strong>{eventoEscolhido.title}</strong>
          {inicioDoEvento(eventoEscolhido) ? ` (${new Date(inicioDoEvento(eventoEscolhido) as string).toLocaleString('pt-BR')})` : ''}.
          {/* A janela é derivada NO SERVIDOR a partir do evento — a tela não calcula data. */}
        </p>
      )}

      {erro && <p className="organizer-hint organizer-hint-warn">{erro}</p>}
      {tipos === null && !erro && <p className="organizer-hint">Procurando fornecedores…</p>}

      {tipos !== null && visiveis.length === 0 && !erro && (
        <p className="organizer-hint">
          {/* Vazio COM filtro ≠ vazio sem filtro: dizer "não há fornecedor" quando o filtro é que
              está restrito seria afirmar algo falso sobre o sistema. */}
          {temFiltro ? 'Nenhum fornecedor com esses filtros. Tente ampliar a busca.' : 'Nenhum tipo de fornecedor no catálogo.'}
        </p>
      )}

      <ul className="supplier-need-list">
        {visiveis.map((n) => (
          <li key={n.needConceptId} className="supplier-need">
            <div className="supplier-need-head">
              <span className="supplier-need-label">
                {n.label}
                {n.isRequired && <span className="supplier-need-required" title="Obrigatório em pelo menos um formato de evento">obrigatório</span>}
              </span>
              <span className="supplier-need-kind">
                {n.fulfillmentKind === 'rentable' ? '🔑 alugar' : '🛠️ contratar'}
              </span>
            </div>

            {n.supplierCount === 0 ? (
              // Zero MEDIDO — e o motivo muda com o filtro, então o texto muda junto.
              <p className="supplier-need-empty">
                {de || ate || eventoContexto
                  ? 'Ninguém declarou atender nessa data.'
                  : 'Ninguém oferece isso por aqui ainda.'}
              </p>
            ) : (
              <ul className="supplier-offer-list">
                {n.suppliers.map((s) => (
                  // 🔴 O CLIQUE LEVA À CASCA UNIVERSAL DO ACTOR (ActorPage) — corrigido 2026-08-04.
                  // Apontava para `/fornecedores/:id`, página paralela que eu criei e que foi
                  // absorvida. Chave = providerActorId, não offerId: quem fornece é o ACTOR, e a
                  // página dele mostra TUDO que oferece (produtos, serviços, locações) com as ações
                  // que o contrato acender. A oferta clicada é só a porta de entrada.
                  <li key={s.offerId} className="supplier-offer">
                    <Link
                      className="supplier-offer-name"
                      to={`/profile/${s.providerActorId}`}
                    >
                      {s.providerDisplayName ?? 'Fornecedor'}
                    </Link>
                    <span className="supplier-offer-what">{s.offerLabel ?? ''}</span>
                    <span className="supplier-offer-price">{formatSupplierPrice(s)}</span>
                    {/* 🔴 O ESTADO DE DISPONIBILIDADE (2026-08-05) — decisão de Clayton: *"ela
                        aparece, mas se for por filtro de data e horário informa que naquela janela
                        não está disponível, porém fica à disposição para outra janela já informada
                        por ela; e esta outra janela informará a disponibilidade mais próxima"*.
                        O servidor já resolvia `freeInRange`/`nextFreeStartAt` e NINGUÉM consumia —
                        capacidade sem consumidor, o defeito que esta sessão inteira consertou.
                        Três estados, e o terceiro é o que costuma sumir:
                          true  → livre no período pedido
                          false → não naquele período, e o servidor diz qual é a próxima
                          null  → ninguém perguntou período (ou não se sabe) → NÃO renderiza nada.
                        `null` NUNCA vira "indisponível": desconhecido não é negativa. */}
                    {s.freeInRange === true && (
                      <span className="supplier-offer-livre">livre no período</span>
                    )}
                    {s.freeInRange === false && (
                      <span className="supplier-offer-ocupado">
                        {s.nextFreeStartAt
                          ? `sem vaga no período · próxima: ${formatarDia(s.nextFreeStartAt)}`
                          : 'sem vaga no período'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
