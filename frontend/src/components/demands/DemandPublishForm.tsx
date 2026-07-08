// frontend/src/components/demands/DemandPublishForm.tsx
// DECISION-0164 — formulário de PUBLICAR DEMANDA, reutilizável (padrão Clayton: a verdade
// nasce no MOTOR /demands; a NAVEGAÇÃO fica onde o usuário está — modal no feed OU página).
import { useEffect, useState } from 'react';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { showToast } from '../common/Toast';
import { createDemand, listWorkConcepts, type CreateDemandInput } from '../../api/demands';
import { useAudienceOptions } from '../../hooks/useAudienceOptions';
import AudiencePicker from '../composer/AudiencePicker';
import '../../pages/OpportunitiesPage.css';

export const VINCULO_PT: Record<string, string> = {
  diaria: 'Diária', periodo: 'Período', recorrente: 'Fixo (dias da semana)', efetivo: 'Efetivo',
};
export const WEEKDAY_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const conceptLabel = (c: { slug?: string; label?: string | null }) => c.label ?? (c.slug ?? '').replace(/-/g, ' ');

export default function DemandPublishForm({ onPublished, onCancel }: {
  onPublished?: () => void;
  onCancel?: () => void;
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
  const [audienceKey, setAudienceKey] = useState('public');

  useEffect(() => {
    if (!activeActor?.actor_id) return;
    listWorkConcepts().then(setConcepts).catch(() => setConcepts([]));
  }, [activeActor?.actor_id]);

  const filteredConcepts = concepts.filter((c) =>
    !conceptSearch.trim() || conceptLabel(c).toLowerCase().includes(conceptSearch.trim().toLowerCase()) || c.slug.includes(conceptSearch.trim().toLowerCase()));

  const doPublish = async () => {
    if (!form.conceptSlug || !form.title.trim()) { showToast('Escolha a função (catálogo) e dê um título.', 'error'); return; }
    setBusy(true);
    try {
      const aud = audienceOptions.find((a) => a.key === audienceKey) ?? audienceOptions[0];
      // audienceOptions já exclui only_me (restrição de ato) → visibility ∈ {public, connections}
      const demandVisibility: 'public' | 'connections' = aud?.visibility === 'connections' ? 'connections' : 'public';
      await createDemand({
        ...form,
        visibility: demandVisibility,
        audienceRelationshipTypes: aud?.audienceRelationshipTypes ?? undefined,
        offeredPriceCents: form.pricingMode === 'preco_ofertado' && form.offeredPriceCents ? form.offeredPriceCents : undefined,
      });
      showToast('Demanda publicada — o matching começou. 🎯', 'success');
      setForm({ conceptSlug: '', title: '', vinculo: 'diaria', quantity: 1, acceptanceMode: 'com_analise', pricingMode: 'preco_ofertado', visibility: 'public' });
      onPublished?.();
    } catch (e) { showToast((e as Error)?.message || 'Falha ao publicar.', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div className="opp-form">
      <AudiencePicker options={audienceOptions} value={audienceKey} onChange={(o) => setAudienceKey(o.key)} title="1 · Para quem é isso?" />
      <label>2 · O que você precisa? (busque no catálogo) *
        <input placeholder="Digite pra buscar: garçom, pedreiro, manicure…" value={conceptSearch}
          onChange={(e) => { setConceptSearch(e.target.value); setForm((f) => ({ ...f, conceptSlug: '' })); }} />
        <select value={form.conceptSlug} size={Math.min(Math.max(filteredConcepts.length, 2), 6)}
          onChange={(e) => setForm((f) => ({ ...f, conceptSlug: e.target.value }))}>
          {filteredConcepts.length === 0 && <option value="" disabled>Nada no catálogo pra essa busca</option>}
          {filteredConcepts.map((c) => <option key={c.concept_id} value={c.slug}>{conceptLabel(c)}</option>)}
        </select>
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
