// backend/src/core/availability/free-time.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — a resposta ÚNICA de "está livre DE VERDADE nesta janela?"
// ║ NORMA:   DECISION-0146 §A.1 (declaração não bloqueia) · §A.2 (só compromisso bloqueia) ·
// ║          §A.3 (rollup do serviço é por provider_actor_id, não por oferta isolada)
// ║ NÃO:     NÃO responder "livre" só porque EXISTE janela declarada; NÃO recalcular esta
// ║          subtração em cada superfície (duas respostas divergem em silêncio).
// ║ EM VEZ:  chame computeFreeTime() — descoberta, vitrine e página do actor usam ESTA.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ESTE ARQUIVO EXISTE (2026-08-05) ═══
// A descoberta ("Quem me ajuda") provava que a janela EXISTE — nunca que ela está LIVRE. Um item
// com a agenda inteira reservada aparecia como disponível. A subtração correta já existia e rodava,
// mas ILHADA em `rentable-resource.service.ts:578` (*"DISPONIBILIDADE PROJETADA = janela macro −
// reservas confirmadas"*), servindo só a página de um recurso.
//
// Duas respostas para a MESMA pergunta é a segunda verdade mais perigosa deste desenho: a busca diz
// "tem", a página diz "não tem", e quem estiver errado vende o mesmo bem duas vezes. Esta função é
// a promoção daquela ilha a leitor único.
//
// ═══ AS DUAS ESPÉCIES TÊM RÉGUAS DIFERENTES, E ISSO NÃO É DUPLICAÇÃO ═══
// · LOCAÇÃO (`actor_asset`): a disputa é pelo ITEM. Com `quantity = 1`, compromisso confirmado
//   ocupa o período. Com `quantity > 1` a janela segue inteira — quem valida a lotação é o confirm,
//   dentro do lock (`pg_advisory_xact_lock`), e é lá que ela tem que ser validada mesmo.
//   ⚠️ Clayton decidiu em 05/08 que N unidades = N itens com N agendas, o que torna `quantity > 1`
//   uma forma em extinção. Enquanto o dado existir nessa forma, esta função respeita a regra vigente
//   em vez de antecipar a nova — antecipar seria decidir no lugar dele.
// · SERVIÇO (`service_offering`): a disputa é pela PESSOA/EMPRESA que presta, não pela oferta.
//   0146 §A.3 é explícita: o rollup é por `provider_actor_id` — o fotógrafo com booking confirmado
//   14h-18h numa oferta NÃO está livre 15h-17h em OUTRA oferta dele. Ignorar isso mostraria como
//   livre quem já está comprometido.
//
// ⚠️ STATUS BLOQUEANTES: 0146 §A.4 manda MAPEAR do schema vivo, nunca inventar. Medido em
// 2026-08-05: `bookings.status` em uso = requested · confirmed · expired. Bloqueiam apenas os de
// COMPROMISSO REAL — `requested` NÃO bloqueia (é pedido, e vários podem coexistir; só um confirma).

import { runQueriesWithTenant } from '@core/database/pool';

/** Um intervalo livre, já recortado pela janela declarada e pelos compromissos existentes. */
export interface FreeSlot {
  availabilityId: string;
  start: Date;
  end: Date;
}

/** A resposta por oferta. `freeInRange` responde à pergunta do usuário; `nextFree` dá a saída. */
export interface OfferFreeTime {
  /** Há tempo livre DENTRO do período perguntado? `null` = não foi perguntado período nenhum. */
  freeInRange: boolean | null;
  /**
   * A próxima janela livre a partir de agora (ou depois do período perguntado, quando ele não tem
   * nada). É o que permite dizer *"não nesta data, mas tenho no dia 22"* em vez de só recusar.
   * `null` = não há nenhuma janela livre futura declarada.
   */
  nextFree: { start: Date; end: Date } | null;
}

/**
 * 🔴 Estados de COMPROMISSO REAL — os únicos que ocupam agenda (0146 §A.4).
 * `requested` está deliberadamente FORA: pedido não é compromisso, e tratá-lo como tal esconderia
 * do próximo interessado um horário que ainda está em disputa.
 */
const STATUS_DE_COMPROMISSO = ['confirmed', 'checked_in', 'checked_out'];

/**
 * Subtrai períodos ocupados de uma janela e devolve as lacunas.
 *
 * 🔴 ESTA É A ÚNICA DEFINIÇÃO DESTA ARITMÉTICA NO REPOSITÓRIO, e é exportada por isso. Ela nasceu
 * privada em `rentable-resource.service.ts`; quando a descoberta precisou da mesma conta, copiar
 * teria criado duas respostas para "quanto sobra desta janela?" — que divergem no dia em que uma
 * das cópias for corrigida e a outra não. A REGRA de quem ocupa difere por espécie (item × provider);
 * a CONTA é uma só. Guard: audit-free-time-single-reader.mjs.
 */
export function subtrair(winStart: Date, winEnd: Date, busy: Array<{ start: Date; end: Date }>): Array<{ start: Date; end: Date }> {
  const overlaps = busy
    .filter((b) => b.end > winStart && b.start < winEnd)
    .map((b) => ({
      start: new Date(Math.max(b.start.getTime(), winStart.getTime())),
      end: new Date(Math.min(b.end.getTime(), winEnd.getTime())),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  const gaps: Array<{ start: Date; end: Date }> = [];
  let cursor = winStart;
  for (const o of overlaps) {
    if (o.start > cursor) gaps.push({ start: cursor, end: o.start });
    if (o.end > cursor) cursor = o.end;
  }
  if (cursor < winEnd) gaps.push({ start: cursor, end: winEnd });
  return gaps;
}

interface OwnerRef {
  /** id da oferta: `service_offerings.id` ou `actor_assets.id`. */
  offerId: string;
  kind: 'service' | 'rentable';
  /** SERVIÇO: o actor que presta — a disputa é dele (0146 §A.3). Ignorado em locação. */
  providerActorId?: string | null;
}

/**
 * Calcula, para um conjunto de ofertas, o tempo livre real.
 *
 * @param range período perguntado pelo usuário. Qualquer ponta pode faltar — meia-pergunta é
 *              pergunta legítima ("a partir do dia 16") e NÃO pode ser silenciosamente ignorada.
 */
export async function computeFreeTime(
  tenantId: string,
  offers: OwnerRef[],
  range: { from: Date | null; to: Date | null }
): Promise<Map<string, OfferFreeTime>> {
  const out = new Map<string, OfferFreeTime>();
  if (offers.length === 0) return out;

  const assetIds = offers.filter((o) => o.kind === 'rentable').map((o) => o.offerId);
  const offeringIds = offers.filter((o) => o.kind === 'service').map((o) => o.offerId);
  const providerIds = Array.from(
    new Set(offers.filter((o) => o.kind === 'service' && o.providerActorId).map((o) => o.providerActorId as string))
  );

  // ── janelas DECLARADAS, ativas e ainda úteis (janela vencida é histórico, não agenda) ──
  const janelas = await runQueriesWithTenant<{
    owner_type: string; owner_id: string; availability_id: string; start_datetime: Date; end_datetime: Date;
  }>(
    tenantId,
    `SELECT owner_type, owner_id::text AS owner_id, availability_id::text AS availability_id,
            start_datetime, end_datetime
       FROM availability
      WHERE tenant_id = $1::uuid
        AND status = 'active'
        AND end_datetime >= now()
        AND ( (owner_type = 'actor_asset'      AND owner_id = ANY($2::uuid[]))
           OR (owner_type = 'service_offering' AND owner_id = ANY($3::uuid[])) )
      ORDER BY start_datetime ASC`,
    [tenantId, assetIds, offeringIds]
  );

  // ── compromissos que OCUPAM, por asset (locação: a disputa é pelo item) ──
  const ocupadoPorAsset = new Map<string, Array<{ start: Date; end: Date }>>();
  if (assetIds.length > 0) {
    const rows = await runQueriesWithTenant<{ owner_id: string; s: Date; e: Date }>(
      tenantId,
      `SELECT a.owner_id::text AS owner_id,
              COALESCE(b.booked_start_datetime, a.start_datetime) AS s,
              COALESCE(b.booked_end_datetime,   a.end_datetime)   AS e
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1::uuid
          AND a.owner_type = 'actor_asset'
          AND a.owner_id = ANY($2::uuid[])
          AND b.status = ANY($3::text[])`,
      [tenantId, assetIds, STATUS_DE_COMPROMISSO]
    );
    for (const r of rows) {
      const arr = ocupadoPorAsset.get(r.owner_id) ?? [];
      arr.push({ start: new Date(r.s), end: new Date(r.e) });
      ocupadoPorAsset.set(r.owner_id, arr);
    }
  }

  // ── lotação declarada por asset. quantity > 1 = fungível: a janela segue inteira e o confirm
  //    valida a lotação dentro do lock. Ausente = 1 (o conservador: item único). ──
  const lotacao = new Map<string, number>();
  if (assetIds.length > 0) {
    const rows = await runQueriesWithTenant<{ asset_id: string; quantity: number }>(
      tenantId,
      // ⚠️ `actor_asset_rental_terms` NÃO tem `tenant_id` — conferido no catálogo depois de eu
      // assumir que tinha e a query estourar 42703. O isolamento vem do JOIN com `actor_assets`,
      // que tem. Nome de coluna que "deveria existir" é exatamente a evidência mais fraca da casa.
      `SELECT te.asset_id::text AS asset_id, te.quantity
         FROM actor_asset_rental_terms te
         JOIN actor_assets a ON a.id = te.asset_id AND a.tenant_id = $1::uuid
        WHERE te.asset_id = ANY($2::uuid[]) AND te.is_active = true`,
      [tenantId, assetIds]
    );
    for (const r of rows) lotacao.set(r.asset_id, Math.max(1, Number(r.quantity ?? 1)));
  }

  // ── compromissos que OCUPAM, por PROVIDER (serviço: 0146 §A.3, rollup cross-oferta) ──
  const ocupadoPorProvider = new Map<string, Array<{ start: Date; end: Date }>>();
  if (providerIds.length > 0) {
    const rows = await runQueriesWithTenant<{ provider: string; s: Date; e: Date }>(
      tenantId,
      `SELECT so.provider_actor_id::text AS provider,
              COALESCE(b.booked_start_datetime, a.start_datetime) AS s,
              COALESCE(b.booked_end_datetime,   a.end_datetime)   AS e
         FROM bookings b
         JOIN availability a ON a.availability_id = b.availability_id AND a.tenant_id = b.tenant_id
         JOIN service_offerings so ON so.id = a.owner_id AND so.tenant_id = b.tenant_id
        WHERE b.tenant_id = $1::uuid
          AND a.owner_type = 'service_offering'
          AND so.provider_actor_id = ANY($2::uuid[])
          AND b.status = ANY($3::text[])`,
      [tenantId, providerIds, STATUS_DE_COMPROMISSO]
    );
    for (const r of rows) {
      const arr = ocupadoPorProvider.get(r.provider) ?? [];
      arr.push({ start: new Date(r.s), end: new Date(r.e) });
      ocupadoPorProvider.set(r.provider, arr);
    }
  }

  const agora = new Date();
  for (const o of offers) {
    const minhasJanelas = janelas.filter(
      (j) => j.owner_id === o.offerId &&
        j.owner_type === (o.kind === 'rentable' ? 'actor_asset' : 'service_offering')
    );

    const fungivel = o.kind === 'rentable' && (lotacao.get(o.offerId) ?? 1) > 1;
    const ocupado = o.kind === 'rentable'
      ? (ocupadoPorAsset.get(o.offerId) ?? [])
      : (o.providerActorId ? (ocupadoPorProvider.get(o.providerActorId) ?? []) : []);

    // lacunas livres de TODAS as janelas declaradas desta oferta
    const livres: FreeSlot[] = [];
    for (const j of minhasJanelas) {
      const ws = new Date(j.start_datetime);
      const we = new Date(j.end_datetime);
      const gaps = fungivel ? [{ start: ws, end: we }] : subtrair(ws, we, ocupado);
      for (const g of gaps) if (g.end > agora) livres.push({ availabilityId: j.availability_id, start: g.start, end: g.end });
    }
    livres.sort((a, b) => a.start.getTime() - b.start.getTime());

    // 🔴 MEIA-PERGUNTA É PERGUNTA. Só "de" = a partir daí; só "até" = antes disso. O filtro antigo
    // exigia as DUAS pontas e, com uma só, ignorava tudo em silêncio — a tela mostrava o catálogo
    // inteiro e o usuário acreditava que havia filtrado.
    const perguntou = range.from !== null || range.to !== null;
    const dentro = livres.filter((s) =>
      (range.to === null || s.start <= range.to) && (range.from === null || s.end >= range.from)
    );

    const livreNoPedido = perguntou ? dentro.length > 0 : null;

    // 🔴 A "PRÓXIMA JANELA" É UMA SAÍDA, NÃO UM DADO SOLTO — e a primeira versão desta linha estava
    // ERRADA: com `?? livres[0]` de fallback, uma oferta LIVRE no dia 16 respondia
    // `nextFree = 4 de agosto` (o começo da janela declarada, ANTES do que foi perguntado). Provado
    // na matriz ponta a ponta antes de commitar. Sugerir uma data anterior à que a pessoa pediu não
    // é alternativa: é ruído que ela leria como resposta.
    //
    // Regra: alternativa só existe quando NÃO deu no período pedido. Se deu, a resposta é o próprio
    // período — `null` aqui significa "não precisa de alternativa", e a tela não mostra nada.
    let proxima: { start: Date; end: Date } | null = null;
    if (livreNoPedido === false) {
      // Primeiro a janela DEPOIS do que foi pedido. Se não houver nenhuma, cai para a mais próxima
      // que ainda existe no futuro — que pode ser ANTES da data pedida (quem procura dezembro e a
      // empresa só tem agosto). Clayton: *"esta outra janela informará a disponibilidade mais
      // próxima"*. Devolver nada aqui deixaria a pessoa de mãos vazias tendo o quê oferecer.
      const referencia = range.to ?? range.from ?? agora;
      const achada = livres.find((s) => s.start >= referencia) ?? livres.find((s) => s.end > agora);
      proxima = achada ? { start: achada.start, end: achada.end } : null;
    } else if (livreNoPedido === null) {
      // Ninguém perguntou período: a próxima janela livre é informação útil por si.
      const achada = livres.find((s) => s.end > agora);
      proxima = achada ? { start: achada.start, end: achada.end } : null;
    }

    out.set(o.offerId, { freeInRange: livreNoPedido, nextFree: proxima });
  }

  return out;
}
