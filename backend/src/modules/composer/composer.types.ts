// backend/src/modules/composer/composer.types.ts
// F-COMPOSER-CONTRACT-C1 — o CONTRATO server-driven do COMPOSITOR (o gêmeo write-side do actor-page).
//
// TESE (APRENDIZADO.md, reconciliação 2026-07-06): o backend ENUMERA quais atos um [actor, modo] pode
// CRIAR; o cliente só renderiza o que o servidor enumerou. Isso resolve a violação nomeada — hoje
// `frontend/src/utils/intent-classifier.ts` enumera 100% no client ("melhorar com backend depois"),
// contra a lei do próprio APRENDIZADO ("enumeração de atos sempre do servidor"). Com este contrato, o
// classifier local REBAIXA para HINT de UX (velocidade de preview) e PERDE o papel de enumerador.
//
// FRONTEIRAS (mesmas do actor-page, §2.4 SELADO):
//   · READ-MODEL puro — este módulo NUNCA escreve nada (só enumera capacidade de criação);
//   · autoridade: o actor-em-que-se-compõe precisa ser REPRESENTADO por req.user (canRepresentActor
//     fail-closed na rota — DECISION-0113); o composer age COMO um actor, não sobre um alvo;
//   · dinheiro é PORTA-1: intents cujo ATO DE CRIAÇÃO em si moveria dinheiro nascem enabled:false
//     gatedBy:'PORTA-1'. Criar uma OFERTA/BUSCA não move dinheiro (a transação é no fulfillment) → enabled;
//   · substrato morto não é oferecido como vivo: intent cujo pilar está contido/ghost (ex.: votes, L4)
//     nasce enabled:false gatedBy nomeado — o cliente não finge que existe;
//   · anti-PII: o contrato nunca carrega CPF/kyc/global_user_id/documento/valor monetário.

export type ComposerMode = 'consuming' | 'operating';

/** As 3 categorias econômicas do APRENDIZADO (substituem "consumir/operar" abstrato). */
export type EconomicFlow =
  | 'entrada' // dinheiro ENTRA (oferta/venda/vaga/aluguel) — receita futura
  | 'saida'   // dinheiro SAI (procura de serviço/produto/locação) — gasto futuro
  | 'social'; // SEM transação (post, projeto, enquete, coordenação)

/** A audiência que o ato pode atingir (mecânica de destino, Eixo 3). */
export type ComposerAudience = 'public' | 'friends' | 'connections' | 'only_me' | 'company' | 'group';

export interface ComposerIntent {
  /** chave canônica do ato (server-side; o cliente NÃO inventa novas). */
  key:
    | 'post_personal'
    | 'post_friends'
    | 'seek_service'
    | 'seek_product'
    | 'offer_service'
    | 'offer_product'
    | 'event'
    | 'project'
    | 'vote';
  label: string;
  /** categoria econômica (Eixo 4 / APRENDIZADO): saída/entrada/social. */
  economicFlow: EconomicFlow;
  /** habilitado para criação AGORA? */
  enabled: boolean;
  /** por que desabilitado (ex.: 'PORTA-1' dinheiro; 'EM_BREVE' fluxo não-wired; 'SUBSTRATO_CONTIDO_L4'). */
  gatedBy?: string;
  /** audiências permitidas para este ato neste contexto (Eixo 3). */
  audiences: ComposerAudience[];
  /** rota REAL do fluxo/wizard vivo quando o ato tem superfície própria (ex.: evento → wizard), ou null (in-composer). */
  deeplink: string | null;
}

export interface ComposerContract {
  /** o actor COMO QUAL se compõe (resolvido/validado server-side). */
  actingActorId: string;
  actorType: string;
  mode: ComposerMode;
  intents: ComposerIntent[];
}
