// src/components/events/guided-flow/SectorBuilder.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — criação de áreas (setores) DENTRO do wizard (decisão de Clayton, 2026-08-03)
// ║ NORMA:   "o frontend só guia o usuário, a verdade sempre fica no backend" (Clayton).
// ║          As LEIS são do servidor, em event-sector.service/repository:
// ║            · SUM(capacity) <= events.max_attendees, sob pg_advisory_xact_lock (SECTOR_CAPACITY_EXCEEDS_EVENT)
// ║            · meia_price_cents = EXATAMENTE metade da inteira (SECTOR_MEIA_PRICE_NOT_HALF)
// ║            · cota de meia >= 4000 bps — piso legal Lei 12.933/2013 (SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR)
// ║ NÃO:     NÃO revalidar essas regras aqui como se fossem verdade do cliente, e NÃO bloquear o
// ║          envio por conta própria. O "restam N" abaixo é ORIENTAÇÃO visual, não autorização.
// ║ EM VEZ:  enviar e EXIBIR o erro nomeado que o servidor devolver. Quem recusa é ele.
// ╚════════════════════════════════════════════════════════════════
//
// Por que aqui e não só no painel: "elas irão determinar a lógica e sequência de inserção de dados
// no backend" (Clayton). Sem isto o evento sai do wizard com preço não resolvido — foi assim que o
// evento 948b0278 anunciou R$50 e cobrou R$80.

import { useState, useEffect, useCallback } from 'react';
import { createEventSector, listEventSectors, type EventSector } from '../../../api/events';
import { reaisToCents, centsToReaisString as centsToReais } from '../../../utils/money';

interface SectorBuilderProps {
  eventId: string | null;
  /** Teto declarado no passo. Vazio/0 = sem teto: o servidor não terá contra o que reconciliar. */
  maxAttendees: string;
}


/**
 * Traduz os códigos NOMEADOS que o servidor devolve (event-sector.service/repository) em orientação.
 * Código desconhecido volta CRU de propósito: mensagem genérica esconderia um defeito novo.
 */
function orientFromServerError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.includes('SECTOR_CAPACITY_EXCEEDS_EVENT')) {
    return 'Esta área não cabe: a soma das áreas passaria da capacidade total do evento. Reduza a quantidade desta área, ou volte e aumente o total.';
  }
  if (raw.includes('SECTOR_MEIA_PRICE_NOT_HALF')) {
    return 'A meia-entrada precisa ser exatamente a metade da inteira (Lei 12.933/2013). Ela é calculada automaticamente — se este erro apareceu, avise.';
  }
  if (raw.includes('SECTOR_MEIA_QUOTA_BELOW_LEGAL_FLOOR')) {
    return 'A cota de meia-entrada não pode ser menor que 40% das vagas (piso legal, Lei 12.933/2013).';
  }
  if (raw.includes('SECTOR_INVALID_CAPACITY')) return 'A quantidade da área precisa ser um número inteiro maior que zero.';
  if (raw.includes('SECTOR_INVALID_NAME')) return 'Dê um nome à área.';
  return raw;
}

export default function SectorBuilder({ eventId, maxAttendees }: SectorBuilderProps) {
  const [sectors, setSectors] = useState<EventSector[]>([]);
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [inteira, setInteira] = useState('');
  const [quotaPct, setQuotaPct] = useState('40');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Edição inline de área existente (F-EVENT-SECTOR-EDIT).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState('');
  const [editInteira, setEditInteira] = useState('');

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setSectors(await listEventSectors(eventId));
    } catch {
      // Falha ao LER não é "não há setores" — não zeramos a lista para não afirmar o que não sabemos.
      setError('Não foi possível carregar as áreas já criadas.');
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = maxAttendees.trim() ? Number.parseInt(maxAttendees, 10) : null;
  const used = sectors.reduce((acc, s) => acc + s.capacity, 0);
  const remaining = total != null && Number.isFinite(total) ? total - used : null;

  // A meia é DERIVADA, nunca digitada: metade exata, divisão inteira arredondando para baixo em
  // favor do consumidor (mesma conta do servidor, que recusa qualquer outro valor).
  const inteiraCents = reaisToCents(inteira);
  const meiaCents = inteiraCents != null ? Math.floor(inteiraCents / 2) : null;

  // AVISO EM TEMPO REAL (pedido de Clayton: "não precisar avançar para descobrir o erro").
  // ⚠️ Isto NÃO é o frontend criando verdade: é ANTECIPAR a recusa que o servidor já daria
  // (SECTOR_CAPACITY_EXCEEDS_EVENT). A trava real continua sendo dele, sob advisory lock — este
  // cálculo é conveniência, e se divergir do backend quem vale é o backend.
  const capacityBeingTyped = capacity.trim() ? Number.parseInt(capacity, 10) : null;
  const wouldExceed =
    remaining != null &&
    capacityBeingTyped != null &&
    Number.isInteger(capacityBeingTyped) &&
    capacityBeingTyped > remaining;
  const overBy = wouldExceed && remaining != null && capacityBeingTyped != null
    ? capacityBeingTyped - remaining
    : 0;

  // `isFull` é DERIVADO da lista que o backend devolveu — some/volta sozinho ao editar ou apagar.
  // Não é estado próprio do cliente: se fosse, divergiria da verdade na primeira falha de rede.
  const isFull = remaining != null && remaining <= 0;

  const startEdit = (s: EventSector) => {
    setError(null);
    setEditingId(s.id);
    setEditName(s.name);
    setEditCapacity(String(s.capacity));
    setEditInteira(centsToReais(s.inteiraPriceCents));
  };

  const handleSaveEdit = async (sectorId: string) => {
    if (!eventId) return;
    setError(null);
    const cap = editCapacity.trim() ? Number.parseInt(editCapacity, 10) : NaN;
    const inteiraC = reaisToCents(editInteira);
    if (!editName.trim()) { setError('Dê um nome à área.'); return; }
    if (!Number.isInteger(cap) || cap < 1) { setError('Informe quantas pessoas cabem nesta área.'); return; }
    if (inteiraC == null) { setError('Informe o preço da inteira.'); return; }

    setSaving(true);
    try {
      const { updateEventSector } = await import('../../../api/events');
      await updateEventSector(eventId, sectorId, {
        name: editName.trim(),
        capacity: cap,
        inteiraPriceCents: inteiraC,
        // A meia continua DERIVADA da inteira — nunca digitada, mesma conta do servidor.
        meiaPriceCents: Math.floor(inteiraC / 2),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(orientFromServerError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: EventSector) => {
    if (!eventId) return;
    // Confirmação explícita: apagar área é ato do organizador, não efeito colateral de clique.
    if (!window.confirm(`Remover a área "${s.name}" (${s.capacity} lugares)?`)) return;
    setError(null);
    setSaving(true);
    try {
      const { deleteEventSector } = await import('../../../api/events');
      await deleteEventSector(eventId, s.id);
      await load();
    } catch (err) {
      setError(orientFromServerError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!eventId) return;
    setError(null);
    const cap = capacity.trim() ? Number.parseInt(capacity, 10) : NaN;
    if (!name.trim()) { setError('Dê um nome à área (ex.: Pista, Camarote).'); return; }
    if (!Number.isInteger(cap) || cap < 1) { setError('Informe quantas pessoas cabem nesta área.'); return; }
    if (inteiraCents == null || meiaCents == null) { setError('Informe o preço da inteira.'); return; }

    // 🔴 AUTODEFESA (bug reproduzido por Clayton, 2026-08-03): sem capacidade total DECLARADA não há
    // teto contra o que reconciliar — o backend aceita qualquer soma ("max_attendees NULL = sem teto",
    // event-sector.service.ts:109). Áreas sem total é o cenário em que ninguém defende ninguém.
    if (total == null || !Number.isInteger(total) || total < 1) {
      setError('Informe primeiro quantas pessoas cabem no total (campo acima). Sem esse número o sistema não tem como conferir se as áreas cabem.');
      return;
    }

    setSaving(true);
    try {
      // 🔴 O TETO PRECISA ESTAR NO BACKEND ANTES DA ÁREA EXISTIR.
      // O bug: max_attendees só era persistido no "Continuar" (GuidedFlow handleStep2Complete), e o
      // SectorBuilder vive ANTES disso — o servidor via NULL e aceitava 400+150 num evento de 500.
      // O contador desta tela mostrava a conta certa, mas era conta de NAVEGADOR: a verdade tem de
      // estar no backend. Reenviamos a cada criação (barato, idempotente) para que uma edição do
      // total feita depois também chegue ao servidor antes de ele julgar.
      const { updateEvent } = await import('../../../api/events');
      await updateEvent(eventId, { max_attendees: total });

      await createEventSector(eventId, {
        sectorNumber: sectors.length + 1,
        name: name.trim(),
        capacity: cap,
        meiaQuotaBps: Math.round((Number.parseFloat(quotaPct.replace(',', '.')) || 40) * 100),
        inteiraPriceCents: inteiraCents,
        meiaPriceCents: meiaCents,
      });
      setName(''); setCapacity(''); setInteira(''); setQuotaPct('40');
      await load();
    } catch (err) {
      // O servidor é quem recusa. Traduzimos os códigos NOMEADOS dele para orientação em pt-BR —
      // sem inventar recusa própria: qualquer código desconhecido passa CRU, para o defeito
      // aparecer em vez de virar "erro genérico" que esconde a causa.
      setError(orientFromServerError(err));
    } finally {
      setSaving(false);
    }
  };

  if (!eventId) {
    return <p className="step-hint">O rascunho ainda está sendo criado — volte a este passo em instantes.</p>;
  }

  return (
    <div className="form-group">
      <label className="form-label">Áreas do local</label>

      {sectors.length > 0 && (
        <ul className="sector-list">
          {sectors.map((s) => (
            <li key={s.id}>
              {editingId === s.id ? (
                // EDIÇÃO INLINE: o backend revalida TUDO (meia = metade exata, cota ≥ 40%,
                // SUM(capacity) <= max_attendees sob advisory lock). Aqui só coletamos.
                <div className="option-grid">
                  <input className="form-textarea" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <input className="form-textarea" type="number" min={1} value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)} />
                  <input className="form-textarea" inputMode="decimal" value={editInteira}
                    onChange={(e) => setEditInteira(e.target.value)} />
                  <button type="button" className="step-button" disabled={saving} onClick={() => void handleSaveEdit(s.id)}>
                    {saving ? 'Salvando…' : 'Salvar'}
                  </button>
                  <button type="button" className="step-button" disabled={saving} onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </div>
              ) : (
                <>
                  <strong>{s.name}</strong> · {s.capacity} lugares · inteira R$ {centsToReais(s.inteiraPriceCents)} ·
                  meia R$ {centsToReais(s.meiaPriceCents)}
                  {' '}
                  <button type="button" className="sector-icon-button" title="Editar esta área"
                    onClick={() => startEdit(s)} disabled={saving}>✏️</button>
                  <button type="button" className="sector-icon-button" title="Excluir esta área"
                    onClick={() => void handleDelete(s)} disabled={saving}>🗑️</button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* AVISA E ORIENTA (pedido de Clayton, 2026-08-03). O estado "completo" e o "sobra" não são
          erro — sobra pode ser legítima (cortesia, staff, imprensa). Por isso orientam, não bloqueiam:
          bloquear engessa, calar esconde. Quem RECUSA é o servidor, e só quando a soma EXCEDE. */}
      <p className="step-hint">
        {total == null || remaining == null
          ? `${used} lugares distribuídos · você não declarou um total, então nada limita as áreas`
          : remaining === 0
            ? `✅ ${used} de ${total} lugares distribuídos — a capacidade está toda coberta por áreas.`
            : remaining > 0
              ? `${used} de ${total} lugares distribuídos · restam ${remaining} sem área. Você pode deixar assim (cortesia, staff, imprensa) ou criar outra área para cobrir.`
              : `⚠️ As áreas somam ${used}, acima do total de ${total}. Aumente a capacidade total ou reduza uma área — o servidor recusa salvar assim.`}
      </p>

      {/* AUTODEFESA (Clayton, 2026-08-03): "se o sistema completar a quantidade de ingressos definidos
          no início, tem como não aparecer mais a possibilidade de inserir nome de setor… e aí só
          aparecer o botão editar?". Com a capacidade coberta, o formulário SOME — só o lápis e a
          lixeira acima seguem disponíveis. Reduzir ou apagar uma área o traz de volta sozinho,
          porque `remaining` é derivado da lista que o backend devolve. */}
      {isFull ? (
        <p className="step-hint">
          Para criar outra área, reduza a quantidade de uma existente (✏️) ou remova uma (🗑️) — ou volte
          e aumente o total do evento.
        </p>
      ) : (
        <>
          <div className="option-grid">
            <input className="form-textarea" placeholder="Nome (ex.: Pista)" value={name}
              onChange={(e) => setName(e.target.value)} />
            <input className="form-textarea" type="number" min={1} placeholder="Quantas pessoas"
              value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>

          <div className="option-grid">
            <input className="form-textarea" inputMode="decimal" placeholder="Preço inteira (R$)"
              value={inteira} onChange={(e) => setInteira(e.target.value)} />
            <input className="form-textarea" type="number" min={40} max={100} placeholder="Cota de meia (%)"
              value={quotaPct} onChange={(e) => setQuotaPct(e.target.value)} />
          </div>

          {/* Avisa ENQUANTO digita, sem esperar o clique. */}
          {wouldExceed && (
            <p className="flow-error-message">
              Não cabe: restam <strong>{remaining}</strong> lugares e você digitou <strong>{capacityBeingTyped}</strong>
              {' '}— {overBy} a mais. Reduza esta área, ou volte e aumente o total do evento.
            </p>
          )}

          <p className="step-hint">
            Meia-entrada: {meiaCents != null ? `R$ ${centsToReais(meiaCents)}` : 'informe a inteira'} — sempre
            exatamente a metade, calculada automaticamente. A cota mínima é 40% das vagas (Lei 12.933/2013).
          </p>

          {error && <p className="flow-error-message">{error}</p>}

          <button type="button" className="step-button" disabled={saving || wouldExceed} onClick={handleCreate}>
            {saving ? 'Criando…' : wouldExceed ? 'Quantidade não cabe' : 'Adicionar área'}
          </button>
        </>
      )}

      {isFull && error && <p className="flow-error-message">{error}</p>}
    </div>
  );
}
