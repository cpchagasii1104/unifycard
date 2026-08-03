// src/components/events/guided-flow/Step2Description.tsx
// ETAPA 2 — Descrição e Intenção
// FASE 5.0 — Event Creation Orchestration
//
// 🔴 REGRAS:
// - Descrição livre
// - Acesso/custo (gratuito/pago/contribuição opcional) — ANÚNCIO, Δbank=0
// - Capacidade (mínimo/máximo de participantes)
// - Substitui o antigo "Tom do Evento" (confundia com a PLATEIA e com visibilidade)
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — único passo econômico do wizard vivo (guided flow)
// ║ NORMA:   "frontend nunca cria verdade — projeta verdade resolvida" (Clayton, 2026-08-03).
// ║          A LEI da capacidade é do backend: SUM(event_sectors.capacity) reconcilia A
// ║          events.max_attendees, NUNCA ao lado dela (event-sector.service.ts:8 e :107).
// ║ NÃO:     NÃO persistir "vai ter setores" como campo próprio. Seria um SEGUNDO SINAL sobre
// ║          um fato que já tem dono (existir linha em event_sectors) — o mesmo defeito que o
// ║          metadata.location_name causou no painel (falso "faltando" sobre dado existente).
// ║ EM VEZ:  a escolha único×por-área é NAVEGAÇÃO local: decide se faz sentido pedir um valor
// ║          único. A verdade do preço é event_sectors; sem setor, events.ticket_price_cents.
// ╚════════════════════════════════════════════════════════════════
//
// ORDEM DAS PERGUNTAS (decisão de Clayton, 2026-08-03) — cada uma só é respondível se a anterior
// foi: ① quantidade TOTAL (teto de tudo) → ② mínimo (liga a condição de acontecer) → ③ tem custo?
// → ④ preço igual para todos ou por área? → ⑤ o valor.
// Antes disto o passo pedia o preço de um ingresso ANTES de saber quantos ingressos existem, e
// nunca mencionava setores — foi assim que o evento 948b0278 anunciou R$50 e cobrou R$80
// (F-EVENT-FROM-PRICE-COHERENCE tratou a vitrine; a ORDEM da pergunta é a causa).

import { useState } from 'react';
import type { GuidedFlowData } from '../EventCreationGuidedFlow';
import SectorBuilder from './SectorBuilder';
import './Step2Description.css';

interface Step2DescriptionProps {
  data: GuidedFlowData;
  onUpdate: (updates: Partial<GuidedFlowData>) => void;
  onComplete: () => void;
}

export default function Step2Description({ data, onUpdate, onComplete }: Step2DescriptionProps) {
  // NAVEGAÇÃO, não verdade (ver ORIENTAÇÃO CANÔNICA acima). Inicializa DERIVANDO do único dado
  // real disponível: já haver um valor anunciado significa que o organizador escolheu preço único.
  const [priceShape, setPriceShape] = useState<'' | 'unico' | 'por_area'>(
    data.priceReais?.trim() ? 'unico' : ''
  );

  return (
    <div className="step2-description">
      <div className="step-header">
        <h2>Descrição e Intenção</h2>
        <p className="step-hint">
          Descreva o evento, quantas pessoas cabem e como o acesso é cobrado.
        </p>
      </div>

      <div className="step-content">
        <div className="form-group">
          <label className="form-label">Descrição</label>
          <textarea
            value={data.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value || null })}
            placeholder="Descreva o evento..."
            rows={4}
            className="form-textarea"
          />
        </div>

        {/* ① QUANTIDADE TOTAL — o teto de tudo. É contra ela que a soma dos setores é reconciliada
            no backend; perguntá-la depois do preço era pedir o valor de um ingresso sem saber
            quantos ingressos existem. */}
        <div className="form-group">
          <label className="form-label">Quantas pessoas cabem no total? (opcional)</label>
          <input type="number" min={1} className="form-textarea" placeholder="Ex.: 200"
            value={data.maxAttendees} onChange={(e) => onUpdate({ maxAttendees: e.target.value })} />
          <p className="step-hint">
            É o teto do evento. Se você criar áreas (pista, camarote…), o servidor exige que a soma
            das quantidades delas caiba aqui. Deixando em branco não há teto — e aí nada limita as
            áreas.
          </p>
        </div>

        {/* ② MÍNIMO — só faz sentido depois do total, e é ele que liga a condição de acontecer. */}
        <div className="form-group">
          <label className="form-label">Mínimo de participantes (opcional)</label>
          <input type="number" min={1} className="form-textarea" placeholder="Ex.: 100"
            value={data.minAttendees} onChange={(e) => onUpdate({ minAttendees: e.target.value })} />
          <p className="step-hint">Se você definir um mínimo, o evento pode depender desse número para acontecer.</p>
        </div>

        {/* ③ CUSTO */}
        <div className="form-group">
          <label className="form-label">O evento tem custo?</label>
          <div className="option-grid">
            <button type="button" className={`option-button ${data.eventAccessType === 'gratuito' ? 'selected' : ''}`}
              onClick={() => { setPriceShape(''); onUpdate({ eventAccessType: 'gratuito', priceReais: '' }); }}>Gratuito</button>
            <button type="button" className={`option-button ${data.eventAccessType === 'pago' ? 'selected' : ''}`}
              onClick={() => onUpdate({ eventAccessType: 'pago' })}>Pago</button>
            <button type="button" className={`option-button ${data.eventAccessType === 'contribuicao_opcional' ? 'selected' : ''}`}
              onClick={() => { setPriceShape(''); onUpdate({ eventAccessType: 'contribuicao_opcional', priceReais: '' }); }}>Contribuição opcional</button>
          </div>
        </div>

        {/* ④ A PERGUNTA QUE NÃO EXISTIA — antes do valor, nunca depois. */}
        {data.eventAccessType === 'pago' && (
          <div className="form-group">
            <label className="form-label">O preço é igual para todos?</label>
            <div className="option-grid">
              <button type="button" className={`option-button ${priceShape === 'unico' ? 'selected' : ''}`}
                onClick={() => setPriceShape('unico')}>Sim, preço único</button>
              <button type="button" className={`option-button ${priceShape === 'por_area' ? 'selected' : ''}`}
                onClick={() => { setPriceShape('por_area'); onUpdate({ priceReais: '' }); }}>Não — áreas com preços diferentes</button>
            </div>
          </div>
        )}

        {/* ⑤a VALOR ÚNICO — só quando ④ disse que é único. */}
        {data.eventAccessType === 'pago' && priceShape === 'unico' && (
          <div className="form-group">
            <label className="form-label">Valor anunciado (R$)</label>
            <input type="text" inputMode="decimal" className="form-textarea" placeholder="Ex.: 50,00"
              value={data.priceReais} onChange={(e) => onUpdate({ priceReais: e.target.value })} />
            <p className="step-hint">Pagamentos, estornos e devoluções entram em etapa futura (Bank). Aqui o valor é só anunciado.</p>
          </div>
        )}

        {/* ⑤b POR ÁREA — nada é anunciado aqui, e é assim de propósito: o preço passa a ser o das
            áreas. Anunciar um valor único junto criaria as duas verdades que o sistema já pagou
            para descobrir (evento 948b0278: anunciou R$50, cobrou R$80). */}
        {data.eventAccessType === 'pago' && priceShape === 'por_area' && (
          <>
            <p className="step-hint">
              Nenhum valor único é anunciado. O preço exibido passa a ser o <strong>menor</strong> das
              áreas ("a partir de").
            </p>
            <SectorBuilder eventId={data.event_id} maxAttendees={data.maxAttendees} />
          </>
        )}
      </div>

      <div className="step-actions">
        <button
          className="step-button step-button-primary"
          onClick={onComplete}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

