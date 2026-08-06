// frontend/src/components/demands/DemandPublishForm.tsx
// DECISION-0164 — formulário de PUBLICAR DEMANDA, reutilizável (padrão Clayton: a verdade
// nasce no MOTOR /demands; a NAVEGAÇÃO fica onde o usuário está — modal no feed OU página).
import { useEffect, useState } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../common/Toast';
import { createDemand, createDemandBatch, listWorkConcepts, type CreateDemandInput } from '../../api/demands';
import { useAudienceOptions } from '../../hooks/useAudienceOptions';
import AudiencePicker from '../composer/AudiencePicker';
import { resolveAudiencePayload } from '../composer/audience-payload';
import '../../pages/OpportunitiesPage.css';

export const VINCULO_PT: Record<string, string> = {
  diaria: 'Diária', periodo: 'Período', recorrente: 'Fixo (dias da semana)', efetivo: 'Efetivo',
};
export const WEEKDAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const conceptLabel = (c: { slug?: string; label?: string | null }) => c.label ?? (c.slug ?? '').replace(/-/g, ' ');

export default function DemandPublishForm({ onPublished, onCancel, initialAudienceKeys, target }: {
  onPublished?: () => void;
  onCancel?: () => void;
  /** CARRY-OVER: plateia herdada do composer inicial (exclui 'only_me' — demanda não pode ser só eu). */
  initialAudienceKeys?: string[];
  /**
   * 🔴 F4 / DECISION-0196 §G.1 — PEDIDO DIRIGIDO. Quando presente, esta MESMA entidade vira um
   * pedido PARA um actor (`target_actor_id`), e não um broadcast (§C/D4: duas entidades seriam
   * segunda verdade sobre "o que é um pedido"). É o que o botão `request_quote` da `ActorPage`
   * passa a abrir — em vez do diálogo de RESERVA, que pressupõe janela publicada.
   * ⚠️ Com alvo, a PLATEIA some da tela: perguntar "para quem?" depois de o usuário ter escolhido
   * uma pessoa seria pedir duas vezes a mesma coisa, com respostas que podem divergir.
   */
  target?: { actorId: string; name: string };
}) {
  const { activeActor } = useActiveActor();
  const [concepts, setConcepts] = useState<Array<{ concept_id: string; slug: string; label?: string | null }>>([]);
  const [conceptSearch, setConceptSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<CreateDemandInput>({
    conceptSlug: '', title: '', vinculo: 'diaria', quantity: 1,
    acceptanceMode: 'com_analise', pricingMode: 'preco_ofertado', visibility: 'public',
  });

  // FONTE ÚNICA de plateia (hook central /audience-options). Restrição de ATO (não invenção): uma
  // DEMANDA não pode ser 'só eu' — ninguém responderia. O ato ESCONDE a opção que não se aplica;
  // NÃO cria opção nova (a lista vem toda do transversal).
  const { options: audienceOptionsRaw } = useAudienceOptions();
  const audienceOptions = audienceOptionsRaw.filter((a) => a.visibility !== 'only_me');
  // Herda a plateia do composer inicial (carry-over), removendo 'only_me' (inválido p/ demanda).
  // Sem herança → default 'public'. A autoridade final segue no backend no submit.
  const [audienceKeys, setAudienceKeys] = useState<string[]>(
    (initialAudienceKeys && initialAudienceKeys.filter((k) => k !== 'only_me').length > 0)
      ? initialAudienceKeys.filter((k) => k !== 'only_me')
      : ['public']
  );
  // Veio do composer com plateia herdada → resumo colapsado (não re-pergunta). "Alterar" expande.
  const inheritedAudience = (initialAudienceKeys?.filter((k) => k !== 'only_me').length ?? 0) > 0;
  const [audienceExpanded, setAudienceExpanded] = useState<boolean>(!inheritedAudience);
  const audienceSummary = audienceKeys
    .map((k) => audienceOptions.find((o) => o.key === k)?.label)
    .filter(Boolean)
    .join(' + ') || 'Público';

  // 🔴 F4-b — NA PÁGINA DELE, O CATÁLOGO É O DELE (fricção de Clayton, 2026-08-06).
  // O formulário dirigido perguntava ao catálogo GLOBAL: na página da "Rio Verde Estruturas"
  // (tenda · gerador · banheiro químico) ele oferecia 315 conceitos, começando por "Alisamento
  // capilar". Ele sabia PARA QUEM era o pedido e não usava isso para nada — pedido dirigido com
  // lista de broadcast é o mesmo "nome e comportamento discordam" que a §G existe para matar.
  // A vitrine já existia e já é consumida pelo diálogo de RESERVA: getSupplierShowcase.
  // ⚠️ FALLBACK MEDIDO, e ele não é conveniência: 11 dos 12 actors `user` não têm NADA publicado.
  // "Só o que ele oferece", aplicado seco, deixaria a lista VAZIA para a persona central — o erro
  // que a §B.4 já cometeu nesta frente e que a medição derrubou. Sem vitrine, não há por que
  // estreitar: cai no catálogo. Escape manual NÃO existe, por decisão de Clayton.
  const [vitrineVazia, setVitrineVazia] = useState(false);
  useEffect(() => {
    if (!activeActor?.actor_id) return;
    let cancelado = false;
    (async () => {
      if (target?.actorId) {
        try {
          const { getSupplierShowcase } = await import('../../api/events');
          const v = await getSupplierShowcase(target.actorId);
          const doFornecedor = (v.offers ?? [])
            .filter((o) => o.conceptId)
            .map((o) => ({ concept_id: o.conceptId as string, slug: o.conceptId as string, label: o.label }));
          if (cancelado) return;
          if (doFornecedor.length > 0) { setConcepts(doFornecedor as any); setVitrineVazia(false); return; }
          setVitrineVazia(true); // sem vitrine: cai no catálogo (senão a página vira beco)
        } catch { if (!cancelado) setVitrineVazia(true); }
      }
      const todos = await listWorkConcepts().catch(() => []);
      if (!cancelado) setConcepts(todos);
    })();
    return () => { cancelado = true; };
  }, [activeActor?.actor_id, target?.actorId]);

  // 🔴 OS ITENS ESCOLHIDOS — chips, como o seletor de TEMA do /events/new.
  // Vários chips = vários itens no MESMO pedido (o que Clayton pediu: "se eu for ficar pedindo item
  // por item pode complicar"). No banco continuam N demandas: multi-item é conveniência de TELA,
  // nunca entidade — se virasse pacote, o fornecedor daria UM preço e a comparação por item morreria.
  const [itens, setItens] = useState<Array<{ slug: string; label: string }>>([]);
  const adicionarItem = (c: { concept_id: string; slug: string; label?: string | null }) => {
    const slug = c.slug;
    setItens((prev) => (prev.some((i) => i.slug === slug) ? prev : [...prev, { slug, label: conceptLabel(c) }]));
    setConceptSearch('');
    // o título ganha um padrão útil no 1º item; o usuário reescreve se quiser
    setForm((f) => (f.title.trim() ? f : { ...f, title: conceptLabel(c) }));
  };
  const removerItem = (slug: string) => setItens((prev) => prev.filter((i) => i.slug !== slug));

  // Sugestões: só o que ainda NÃO foi escolhido (chip já adicionado sai da lista).
  const filteredConcepts = concepts.filter((c) =>
    !conceptSearch.trim() || conceptLabel(c).toLowerCase().includes(conceptSearch.trim().toLowerCase()) || c.slug.includes(conceptSearch.trim().toLowerCase()));
  const sugestoes = filteredConcepts.filter((c) => !itens.some((i) => i.slug === c.slug));

  const doPublish = async () => {
    if (itens.length === 0 || !form.title.trim()) { showToast('Adicione ao menos um item e dê um título.', 'error'); return; }
    setBusy(true);
    try {
      // audienceOptions já exclui only_me (restrição de ATO/UX; o backend também rejeita — enforcement
      // não é do front). Resolve via helper central → visibility ∈ {public, connections}.
      const aud = resolveAudiencePayload(audienceOptions, audienceKeys);
      const demandVisibility: 'public' | 'connections' = aud.visibility === 'connections' ? 'connections' : 'public';
      const comum = {
        ...form,
        // Dirigido: a plateia é a própria pessoa. Mando 'public' porque o alvo é quem estreita a
        // audiência no servidor (isActorInAudience/listOpportunities) — a visibilidade aqui deixa
        // de ser o critério, e inventar um valor novo seria vocabulário paralelo.
        visibility: (target ? 'public' : demandVisibility) as 'public' | 'connections',
        audienceRelationshipTypes: target ? undefined : (aud.audienceRelationshipTypes ?? undefined),
        targetActorId: target?.actorId,
        offeredPriceCents: form.pricingMode === 'preco_ofertado' && form.offeredPriceCents ? form.offeredPriceCents : undefined,
      };
      // 1 item → o caminho de sempre. N itens → o LOTE ATÔMICO (entram os N ou nenhum): meio pedido
      // é pior que pedido nenhum, porque o fornecedor veria uma lista que o cliente não escreveu.
      if (itens.length === 1) {
        await createDemand({ ...comum, conceptSlug: itens[0].slug });
      } else {
        await createDemandBatch({
          targetActorId: target?.actorId,
          items: itens.map((i) => ({
            ...comum,
            conceptSlug: i.slug,
            // cada linha leva o NOME do próprio item — senão os 3 pedidos chegam com o mesmo título
            title: itens.length > 1 ? `${form.title.trim()} — ${i.label}` : form.title,
          })),
        });
      }
      const quantos = itens.length > 1 ? ` (${itens.length} itens)` : '';
      showToast(target ? `Pedido enviado a ${target.name}${quantos}. 📨` : `Demanda publicada${quantos} — o matching começou. 🎯`, 'success');
      setItens([]);
      setForm({ conceptSlug: '', title: '', vinculo: 'diaria', quantity: 1, acceptanceMode: 'com_analise', pricingMode: 'preco_ofertado', visibility: 'public' });
      onPublished?.();
    } catch (e) { showToast((e as Error)?.message || 'Falha ao publicar.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="opp-form">
      {target ? (
        // Pedido DIRIGIDO: a plateia já está decidida — é esta pessoa. Mostrar o picker aqui
        // perguntaria de novo o que o usuário já respondeu ao clicar no perfil dela.
        <div className="audience-collapsed">
          <span className="audience-collapsed-title">Pedido dirigido a</span>
          <span className="audience-collapsed-value">{target.name}</span>
        </div>
      ) : audienceExpanded ? (
        <AudiencePicker options={audienceOptions} selectedKeys={audienceKeys} onChange={setAudienceKeys} title="1 · Para quem é isso?" />
      ) : (
        <div className="audience-collapsed">
          <span className="audience-collapsed-title">Plateia</span>
          <span className="audience-collapsed-value">{audienceSummary}</span>
          <button type="button" className="audience-collapsed-alter" onClick={() => setAudienceExpanded(true)}>Alterar</button>
        </div>
      )}
      <label>
        {target && !vitrineVazia
          ? `2 · O que você precisa de ${target.name}?`
          : '2 · O que você precisa? (busque no catálogo) *'}
        {target && !vitrineVazia && (
          <small className="opp-hint">Só o que este fornecedor oferece.</small>
        )}
        {target && vitrineVazia && (
          // Estado HONESTO: ele não publicou nada, então não há o que estreitar. Dizer isso é mais
          // útil que uma lista vazia — e não inventa que ele oferece o catálogo inteiro.
          <small className="opp-hint">Este fornecedor ainda não publicou o que oferece — busque no catálogo.</small>
        )}
        {/* 🔴 F4-b · O ITEM VIRA CHIP AO CLICAR (fricção de Clayton, 2026-08-06).
            Era um <select size=N>: clicar só realçava a linha, e nada dizia que o item entrou —
            "eu preciso conseguir ADICIONAR o item". O padrão certo já existe no produto, no
            seletor de TEMA do /events/new (Step0EventType.tsx:128-149): busca → resultado
            clicável → CHIP com ✕. Reuso as MESMAS classes (theme-chips/theme-chip/theme-results)
            de propósito: superfície nova para o mesmo gesto seria a 2ª forma de escolher. */}
        {itens.length > 0 && (
          <div className="theme-chips">
            {itens.map((i) => (
              <span key={i.slug} className="theme-chip">
                {i.label}
                <button type="button" onClick={() => removerItem(i.slug)} aria-label={`remover ${i.label}`}>✕</button>
              </span>
            ))}
          </div>
        )}
        <input placeholder="Digite pra buscar: garçom, pedreiro, manicure…" value={conceptSearch}
          onChange={(e) => setConceptSearch(e.target.value)} />
        {/* 🔴 LISTA ROLÁVEL, não mural de botões. Clayton: *"se o fornecedor tiver inúmeros itens
            não pode virar uma bagunça na hora de procurar"* — um grid de chips cresce sem limite e
            empurra o resto do formulário para fora da tela. A lista tem ALTURA FIXA e rola; a busca
            filtra. Cada linha CLICA e vira chip (era um <select>, que só realçava e não adicionava). */}
        {sugestoes.length > 0 && (
          <>
            <div className="opp-item-list" role="listbox" aria-label="Itens disponíveis">
              {sugestoes.map((c) => (
                <button key={c.concept_id} type="button" className="opp-item-option"
                  role="option" aria-selected={false} onClick={() => adicionarItem(c)}>
                  <span>{conceptLabel(c)}</span>
                  <span className="opp-item-add" aria-hidden="true">+</span>
                </button>
              ))}
            </div>
            <small className="opp-hint">
              {conceptSearch.trim()
                ? `${sugestoes.length} resultado(s) para "${conceptSearch.trim()}" — clique para adicionar.`
                : `${sugestoes.length} item(ns) disponível(is) — clique para adicionar, ou busque acima.`}
            </small>
          </>
        )}
        {conceptSearch.trim().length > 0 && sugestoes.length === 0 && (
          <small className="opp-hint">Nada encontrado para “{conceptSearch.trim()}”.</small>
        )}
      </label>
      <label>Título *
        <input value={form.title} placeholder="Ex.: Garçom p/ churrascaria — sábado"
          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
      </label>
      <label>Descrição
        <textarea rows={2} value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
      </label>
      <label>Tipo de contratação *
        <select value={form.vinculo} onChange={(e) => setForm((f) => ({ ...f, vinculo: e.target.value as CreateDemandInput['vinculo'] }))}>
          {Object.entries(VINCULO_PT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {(form.vinculo === 'diaria' || form.vinculo === 'periodo') && (
        <div className="opp-row">
          <label>Data início *<input type="date" value={form.dateStart ?? ''} onChange={(e) => setForm((f) => ({ ...f, dateStart: e.target.value }))} /></label>
          {form.vinculo === 'periodo' && <label>Data fim *<input type="date" value={form.dateEnd ?? ''} onChange={(e) => setForm((f) => ({ ...f, dateEnd: e.target.value }))} /></label>}
        </div>
      )}
      {form.vinculo === 'recorrente' && (
        <div className="opp-weekdays">
          {WEEKDAY_PT.map((w, i) => (
            <label key={w} className="opp-wd">
              <input type="checkbox" checked={(form.weekdays ?? []).includes(i)}
                onChange={(e) => setForm((f) => ({ ...f, weekdays: e.target.checked ? [...(f.weekdays ?? []), i] : (f.weekdays ?? []).filter((x) => x !== i) }))} />{w}
            </label>
          ))}
        </div>
      )}
      <div className="opp-row">
        <label>Horário início<input type="time" value={form.timeStart ?? ''} onChange={(e) => setForm((f) => ({ ...f, timeStart: e.target.value }))} /></label>
        <label>Horário fim<input type="time" value={form.timeEnd ?? ''} onChange={(e) => setForm((f) => ({ ...f, timeEnd: e.target.value }))} /></label>
      </div>
      {/* Jornada (Clayton): direto ou com intervalo — na sequência lógica, logo após os horários */}
      <div className="opp-row">
        <label>Jornada
          <select value={form.breakMinutes ? 'com_intervalo' : 'direto'}
            onChange={(e) => setForm((f) => ({ ...f, breakMinutes: e.target.value === 'com_intervalo' ? (f.breakMinutes || 60) : undefined }))}>
            <option value="direto">▶️ Direto — sem intervalo</option>
            <option value="com_intervalo">⏸️ Com intervalo</option>
          </select>
        </label>
        {!!form.breakMinutes && (
          <label>Intervalo (minutos)
            <input type="number" min={5} step={5} value={form.breakMinutes}
              onChange={(e) => setForm((f) => ({ ...f, breakMinutes: Math.max(5, Number(e.target.value) || 5) }))} />
          </label>
        )}
      </div>
      <div className="opp-row">
        <label>Vagas<input type="number" min={1} value={form.quantity ?? 1} onChange={(e) => setForm((f) => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))} /></label>
        <label>Raio (km)<input type="number" min={0} step="0.5" value={form.radiusKm ?? ''} onChange={(e) => setForm((f) => ({ ...f, radiusKm: e.target.value ? Number(e.target.value) : undefined }))} /></label>
        <label>Avisar cancelamento (h)<input type="number" min={0} value={form.cancelNoticeHours ?? ''} onChange={(e) => setForm((f) => ({ ...f, cancelNoticeHours: e.target.value ? Number(e.target.value) : undefined }))} /></label>
      </div>
      <label>Regime de aceite *
        <select value={form.acceptanceMode} onChange={(e) => setForm((f) => ({ ...f, acceptanceMode: e.target.value as CreateDemandInput['acceptanceMode'] }))}>
          <option value="com_analise">🔍 Com análise — eu escolho entre os candidatos</option>
          <option value="automatico">⚡ Automático — quem aceitar primeiro, fechou</option>
        </select>
      </label>
      <label>Preço *
        <select value={form.pricingMode} onChange={(e) => setForm((f) => ({ ...f, pricingMode: e.target.value as CreateDemandInput['pricingMode'] }))}>
          <option value="preco_ofertado">💰 Eu ofereço o valor</option>
          <option value="orcamento">💬 Peço orçamento</option>
        </select>
      </label>
      {form.pricingMode === 'preco_ofertado' && (
        <label>Valor oferecido (R$)
          <input type="number" min={0} step="0.01"
            value={form.offeredPriceCents ? (form.offeredPriceCents / 100).toString() : ''}
            onChange={(e) => setForm((f) => ({ ...f, offeredPriceCents: e.target.value ? Math.round(parseFloat(e.target.value) * 100) : undefined }))} />
        </label>
      )}
      <div className="opp-row">
        <button className="opp-publish" disabled={busy} onClick={() => void doPublish()}>Publicar demanda</button>
        {onCancel && <button className="opp-back" onClick={onCancel}>← Voltar</button>}
      </div>
      <p className="opp-note">💡 Valores são o combinado registrado — pagamento dentro do sistema chega com a PORTA-1.</p>
    </div>
  );
}
