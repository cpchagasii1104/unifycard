// backend/src/modules/demands/demand-commitment.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — LEITOR ÚNICO da cascata §B.4 e da janela do compromisso
// ║ NORMA:   DECISION_0196 §B.1/§B.4/§D.1/§D.2 · DECISION_0146 §B-bis G8/G10 · CONSTITUIÇÃO ART. II
// ║ NÃO:     duplicar esta resolução no service, na rota ou em teste — duas cópias divergem
// ║ EM VEZ:  importar `resolveCommitmentOwner` e `demandWindowToInterval` daqui, sempre
// ╚════════════════════════════════════════════════════════════════
//
// A F2 (aceite atômico) precisa responder DUAS perguntas antes de tocar a agenda, e as duas têm
// resposta NORMATIVA — nenhuma é escolha de implementação:
//
//   1. DE QUEM é a agenda que este aceite ocupa?   → a CASCATA da §B.4, três degraus
//   2. QUAL é o intervalo comprometido?            → a janela da demanda, com a régua da G8
//
// Mora em arquivo próprio pelo mesmo motivo de `quote-validity.ts`: leitor único. Uma segunda
// cópia da cascata (por exemplo, uma no `respond` e outra no `choose`) seria SEGUNDA VERDADE sobre
// "de quem é a agenda" — e os dois verbos precisam responder igual, por definição.

import { DEMAND_VINCULOS, type DemandVinculo, type ServiceDemand } from './demand.types';

/**
 * 🔴 COMPOSTO do vocabulário GOVERNADO (`DEMAND_VINCULOS`), nunca enumerado à mão — a 1ª versão
 * deste arquivo escreveu os literais e o `governed-vocabulary-manifest` mordeu na hora
 * ("ANTI-PARALELO: 3/4 valores reaparecem sem importar o símbolo governado"). Ele estava certo:
 * lista copiada envelhece calada.
 *
 * O `Record` é EXAUSTIVO por tipo: nascer um vínculo novo **quebra o compilador aqui** e obriga
 * alguém a decidir se ele ocupa agenda — em vez de cair no ramo errado por omissão.
 *   `single`   → tem UMA janela de compromisso (vira availability + booking)
 *   `none`     → não tem janela única; o aceite é registro comercial e a agenda NÃO é tocada (G10)
 */
const VINCULO_WINDOW: Record<DemandVinculo, 'single' | 'none'> = {
  diaria: 'single',
  periodo: 'single',
  recorrente: 'none', // N ocorrências (weekdays): cada uma seria um compromisso próprio
  efetivo: 'none',    // vínculo permanente: não tem início e fim de ocupação
};

/** O vínculo produz compromisso de agenda? Leitor único — ninguém compara literal por fora. */
export function vinculoHasSingleWindow(v: string): boolean {
  return (DEMAND_VINCULOS as readonly string[]).includes(v)
    && VINCULO_WINDOW[v as DemandVinculo] === 'single';
}

/** Fuso do compromisso. NÃO é escolha nova: `availability.timezone` é NOT NULL com este DEFAULT no
 *  banco, e 70/70 janelas vivas usavam este valor quando a F2 nasceu (medido 2026-08-06). Compor a
 *  janela da demanda com o MESMO fuso é convergência, não invenção.
 *  🟡 Quando houver multi-país, a casa canônica já existe: `countries.timezone_default`. */
export const DEMAND_COMMITMENT_TIMEZONE = 'America/Sao_Paulo';

/** Erro nomeado do aceite. `statusCode` casa o formato do módulo de demandas. */
export class DemandCommitmentError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** O dono resolvido da agenda que o aceite vai ocupar (par owner_type/owner_id de `availability`). */
export interface CommitmentOwner {
  ownerType: 'service_offering' | 'actor_asset' | 'user';
  ownerId: string;
  /** Qual degrau da §B.4 resolveu — vai para a metadata do booking, para auditoria. */
  degrau: 1 | 2;
}

/**
 * 🔴 A CASCATA DA §B.4 (VIGENTE, emendada em 2026-08-06). Três degraus, nenhum inventado:
 *
 *   1. FK presente        → `service_offering` ou `actor_asset` da FK   (§B.2 · 0164 ADENDO 7c)
 *   2. FK ausente + user  → o PRÓPRIO user-actor                        (§D.1 · 0146 V1)
 *   3. FK ausente + page  → RECUSA HONESTA no aceite                    (R1 de Clayton)
 *
 * O degrau 3 não é limitação técnica: é a **regra do dono** — *"a empresa não tem agenda: ela
 * AGREGA"*. Contratar "a empresa" tem de resolver para uma unidade concreta, e essa resolução não
 * existe. A mensagem diz o caminho, em vez de só negar.
 *
 * Qualquer outro `actor_type` (hoje `group`) cai no STOP da **G10**: resolução ausente → PARAR, não
 * adivinhar. `group` tem agenda de banda/coletivo em outras frentes; dar a ele um dono aqui, por
 * analogia, seria exatamente o "adivinhar o recurso" que a G10 proíbe.
 */
export function resolveCommitmentOwner(input: {
  offeringId: string | null;
  assetId: string | null;
  providerActorId: string;
  providerActorType: string;
}): CommitmentOwner {
  if (input.offeringId && input.assetId) {
    // O CHECK do banco já garante exclusividade; aqui é defesa em profundidade com nome próprio.
    throw new DemandCommitmentError(400, 'DEMAND_COMMITMENT_OFFER_REF_AMBIGUOUS',
      'A resposta declara oferta E ativo — exatamente um, nunca os dois (DECISION-0196 §B.2).');
  }
  if (input.offeringId) return { ownerType: 'service_offering', ownerId: input.offeringId, degrau: 1 };
  if (input.assetId) return { ownerType: 'actor_asset', ownerId: input.assetId, degrau: 1 };

  if (input.providerActorType === 'user') {
    return { ownerType: 'user', ownerId: input.providerActorId, degrau: 2 };
  }

  if (input.providerActorType === 'page') {
    throw new DemandCommitmentError(409, 'DEMAND_COMMITMENT_PAGE_HAS_NO_AGENDA',
      'Uma página (empresa) NÃO tem agenda própria: ela AGREGA as agendas de quem a compõe. ' +
      'Para comprometer horário, responda declarando a OFERTA (service_offering) ou o ATIVO ' +
      '(actor_asset) que será usado — aí o compromisso ocupa a agenda daquele recurso concreto. ' +
      '(DECISION-0196 §B.4 degrau 3 · regra R1.)');
  }

  throw new DemandCommitmentError(501, 'DEMAND_COMMITMENT_STOP_DECISION_REQUIRED',
    `Responder por um actor do tipo '${input.providerActorType}' sem declarar oferta/ativo exigiria ` +
    'ADIVINHAR qual agenda ocupar, e a DECISION-0146 G10 manda PARAR, não adivinhar. ' +
    'Declare a oferta ou o ativo, ou abra decisão nomeada para este tipo de actor.');
}

/**
 * 🔴 A JANELA DO COMPROMISSO — e o STOP dos vínculos que não têm uma.
 *
 * `service_demands` guarda `date` + `time` NUS (sem fuso). `availability` exige TIMESTAMPTZ. A
 * composição usa o fuso canônico acima; a régua é a da **G8**: `[start, end)` meio-aberto, então
 * `end` é EXCLUSIVO e back-to-back não conflita.
 *
 * Vínculos (vocabulário vivo do CHECK: diaria · periodo · recorrente · efetivo):
 *   · `diaria`  → um dia, com hora quando declarada; sem hora = o dia inteiro
 *   · `periodo` → de `date_start` a `date_end` (fim inclusivo vira `+1 dia` exclusivo)
 *   · `recorrente` / `efetivo` → **STOP**. Não há UMA janela: recorrente é N ocorrências e efetivo
 *     é vínculo permanente. Gravar "uma janela" para eles seria inventar o compromisso — G10.
 *     Ampliar depois é barato (é decisão de produto nova); gravar errado agora, não.
 */
export function demandWindowToInterval(d: ServiceDemand): { startIso: string; endIso: string } {
  if (!vinculoHasSingleWindow(d.vinculo)) {
    throw new DemandCommitmentError(501, 'DEMAND_COMMITMENT_VINCULO_HAS_NO_SINGLE_WINDOW',
      `Vínculo '${d.vinculo}' não tem UMA janela de compromisso — ver VINCULO_WINDOW, composto do ` +
      'vocabulário governado DEMAND_VINCULOS. A DECISION-0146 G10 manda PARAR em vez de adivinhar ' +
      'o recurso/janela. Aceitar segue possível como registro comercial; o que não acontece é ' +
      'ocupar agenda.');
  }
  if (!d.dateStart) {
    throw new DemandCommitmentError(400, 'DEMAND_COMMITMENT_NO_DATE',
      'A demanda não declara data — sem data não há janela a comprometer.');
  }

  const inicio = d.dateStart;
  // Fim do dia: quando há data final declarada, ela manda; senão é o mesmo dia.
  const fimDia = d.dateEnd ?? d.dateStart;

  // Hora declarada? usa. Senão o dia inteiro — e o fim é EXCLUSIVO (G8), por isso o dia seguinte.
  const hIni = d.timeStart ? String(d.timeStart).slice(0, 8) : '00:00:00';
  const startIso = zonedToIso(inicio, hIni);

  let endIso: string;
  if (d.timeEnd) {
    endIso = zonedToIso(fimDia, String(d.timeEnd).slice(0, 8));
  } else {
    endIso = zonedToIso(addDays(fimDia, 1), '00:00:00');
  }

  if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
    throw new DemandCommitmentError(400, 'DEMAND_COMMITMENT_INVALID_WINDOW',
      'A janela declarada termina antes de começar — intervalo inválido para compromisso.');
  }
  return { startIso, endIso };
}

/**
 * ⚠️ `slice` de propósito, em vez do método de partição de string: o lint de vocabulário
 * financeiro (DECISION-0158) conta aquele nome como termo financeiro — em CÓDIGO **e em
 * COMENTÁRIO** — e o teto do guard só DESCE. Ele mordeu esta função na 1ª rodada.
 * `isoDate` é sempre `YYYY-MM-DD` (a coluna é `date`), então as posições são fixas.
 */
function addDays(isoDate: string, n: number): string {
  const y = parseInt(isoDate.slice(0, 4), 10);
  const m = parseInt(isoDate.slice(5, 7), 10);
  const d = parseInt(isoDate.slice(8, 10), 10);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/**
 * Compõe `YYYY-MM-DD` + `HH:MM:SS` no fuso canônico e devolve ISO absoluto.
 * O Postgres é quem sabe a regra do fuso (inclusive horário de verão histórico); replicar isso em
 * JS seria uma segunda tabela de fusos. Aqui a conversão é feita com `Intl`, que usa a MESMA base
 * IANA — e o resultado é conferido por diferença, nunca por suposição de offset fixo.
 */
function zonedToIso(date: string, time: string): string {
  const naive = Date.parse(`${date}T${time}Z`); // instante "como se" fosse UTC
  const offsetMs = tzOffsetMs(new Date(naive), DEMAND_COMMITMENT_TIMEZONE);
  return new Date(naive - offsetMs).toISOString();
}

/** Offset do fuso no instante dado, em ms (positivo a leste de Greenwich). */
function tzOffsetMs(at: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p: Record<string, string> = {};
  for (const part of fmt.formatToParts(at)) if (part.type !== 'literal') p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour === '24' ? '0' : p.hour), Number(p.minute), Number(p.second)
  );
  return asUtc - at.getTime();
}
