// frontend/src/components/events/EventSupplierBoard.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — face CONSUMIR de "Meus eventos": quem me ajuda a realizar o evento
// ║ NORMA:   "a verdade vive no backend" — a junção necessidade→fornecedor é do servidor
// ║ NÃO:     NÃO cruzar needConceptId com oferta aqui; NÃO inferir fornecedor por nome;
// ║          NÃO transformar ausência de oferta em erro (zero medido ≠ falha de leitura).
// ║ EM VEZ:  getEventNeedSuppliers(eventId) → GET /api/events/:id/need-suppliers.
// ╚════════════════════════════════════════════════════════════════
//
// Pedido de Clayton (2026-08-04): em "Meus Eventos" no modo Consumir, *"aparecer as empresas
// pertinentes a me ajudar com os eventos, seja de segurança, coisas de energia, banheiros, palcos,
// equipamentos e etc."*
//
// A lista de necessidades NÃO é escrita aqui: vem do template governado do FORMATO do evento
// (o SHOW pede 17 — segurança, sonorização, brigadista, banheiro químico, palco…). Esta tela só
// projeta. Se o catálogo mudar, ela muda junto sem tocar em código.

import { useEffect, useState } from 'react';
import { getEventNeedSuppliers, type NeedWithSuppliers } from '../../api/events';
// Preço de fornecedor se lê num lugar SÓ — três cópias desta regra divergiriam em silêncio.
import { formatSupplierPrice } from '../../utils/money';
import './EventSupplierBoard.css';

interface Props {
  eventId: string;
  eventTitle: string;
}


export default function EventSupplierBoard({ eventId, eventTitle }: Props) {
  const [needs, setNeeds] = useState<NeedWithSuppliers[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEventNeedSuppliers(eventId)
      .then((n) => { if (!cancelled) setNeeds(n); })
      .catch((e) => {
        // Falha de leitura é DIFERENTE de "não há fornecedor" — não vira lista vazia.
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Não foi possível carregar os fornecedores.');
      });
    return () => { cancelled = true; };
  }, [eventId]);

  if (erro) return <p className="organizer-hint organizer-hint-warn">{erro}</p>;
  if (needs === null) return <p className="organizer-hint">Procurando quem pode ajudar…</p>;

  if (needs.length === 0) {
    return (
      <p className="organizer-hint">
        Este evento ainda não tem um formato com lista de necessidades — escolha o formato no
        wizard para ver quem pode ajudar.
      </p>
    );
  }

  const comFornecedor = needs.filter((n) => n.supplierCount > 0).length;

  return (
    <section className="supplier-board">
      <p className="organizer-hint organizer-hint-muted">
        Para <strong>{eventTitle}</strong>: {comFornecedor} de {needs.length} necessidades já têm
        alguém disponível. A lista de necessidades vem do formato do evento.
      </p>

      <ul className="supplier-need-list">
        {needs.map((n) => (
          <li key={n.needConceptId} className="supplier-need">
            <div className="supplier-need-head">
              <span className="supplier-need-label">
                {n.label}
                {n.isRequired && <span className="supplier-need-required" title="Necessidade obrigatória deste formato">obrigatório</span>}
                {n.declaredStatus && <span className="supplier-need-declared" title="Você já declarou esta necessidade">declarada</span>}
              </span>
              <span className="supplier-need-kind">
                {n.fulfillmentKind === 'rentable' ? '🔑 alugar' : '🛠️ contratar'}
              </span>
            </div>

            {n.supplierCount === 0 ? (
              // Zero MEDIDO — afirmação honesta de que não há oferta, não falha de busca.
              <p className="supplier-need-empty">Ninguém oferece isso por aqui ainda.</p>
            ) : (
              <ul className="supplier-offer-list">
                {n.suppliers.map((s) => (
                  <li key={s.offerId} className="supplier-offer">
                    <span className="supplier-offer-name">{s.providerDisplayName ?? 'Fornecedor'}</span>
                    <span className="supplier-offer-what">{s.offerLabel ?? ''}</span>
                    <span className="supplier-offer-price">{formatSupplierPrice(s)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
