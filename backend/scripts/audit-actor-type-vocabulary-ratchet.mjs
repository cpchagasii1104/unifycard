#!/usr/bin/env node
// Guard estrutural — F-ACTOR-TYPE-VOCABULARY-RATCHET (2026-08-04).
//
// ╔═ O QUE ELE TRAVA ═════════════════════════════════════════════════════════════════════════
// `actor_type` é o vocabulário FECHADO mais fundamental do sistema — o tipo de identidade. E ele
// vazou: o CHECK físico de `actors.actor_type` permite **10 valores, de TRÊS gerações**, e nenhuma
// geração anterior foi removida quando a seguinte chegou.
//
//   geração 1 ......... person · company · system
//   geração 2 ......... actor_human · actor_organizational · actor_system
//   geração 3 ......... user · page · group · channel
//
// Medido em `unificard_dev` em 2026-08-04: só **user (12) · page (8) · group (2)** têm linhas.
// Sete valores permitidos e sem uso — e a prova de que o sistema SABE que são sinônimos está no
// segundo CHECK da mesma tabela, que trata `user`, `actor_human` e `person` como o mesmo caso
// ("exige global_user_id"). Sabe que são a mesma coisa, e permite as três mesmo assim.
//
// ═══ POR QUE ESTE GUARD, E NÃO UMA MIGRATION QUE ESTREITA O CHECK ═══
// Porque estreitar QUEBRARIA. O código ainda referencia as gerações mortas — medido:
// `person` 17× · `actor_human` 17× · `channel` 16× · `company` 9× · `actor_system` 2× ·
// `actor_organizational` 1×. Convergir é frente própria, com raio real e decisão do dono sobre o
// que fazer com cada caminho. O que NÃO precisa de decisão é impedir que o buraco cresça.
//
// A instância de ARQUITETURA encerra o gate ontológico dizendo: *"sem checagem automática, esta
// regra tem o destino do `actor_type` que ela mesma denuncia"* — e planeja o script de CI para o
// sistema NOVO. Este é esse script, no legado, hoje.
//
// MORDE se:
//   1. aparecer um valor de `actor_type` fora dos 10 conhecidos (4ª geração);
//   2. o número de referências a uma geração morta CRESCER (código novo adotando valor morto).
// A contagem só DESCE. Convergiu uma? Baixe o teto no mesmo commit.
// ════════════════════════════════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const failures = [];

/** Os 10 valores que o CHECK permite hoje. Um 11º = 4ª geração = FAIL. */
const VOCABULARIO_CONHECIDO = new Set([
  'user', 'page', 'group', 'channel',                              // geração 3 (viva)
  'actor_human', 'actor_organizational', 'actor_system',            // geração 2
  'person', 'company', 'system',                                    // geração 1
]);

/**
 * 🔴 A 4ª GERAÇÃO JÁ EXISTE — e este guard a encontrou na primeira execução honesta dele.
 *
 * `marketplace/routes/marketplace-sla.routes.ts` e `marketplace-identity.routes.ts` declaram
 * `actor_type: 'store' | 'hub' | 'industry' | 'service_provider' | 'customer'` — CINCO valores que
 * NÃO estão no CHECK do banco, e que são exatamente a categoria que o gate ontológico proíbe:
 * *"nenhum nome de produto, mercado ou vertical (banda, canal, loja, motorista, restaurante...)
 * entra nesta lista, NUNCA"*. `store` é loja; `industry` é indústria; `customer` é papel de compra.
 *
 * Medido antes de classificar: os dois arquivos NÃO são importados por ninguém e não contêm SQL —
 * são rotas mortas. Então não corrompem dado hoje. Mas é literalmente a semente da geração 4, e as
 * três anteriores nasceram assim: um tipo declarado num canto, depois copiado.
 *
 * Congelada por NOME, com teto que só desce. Apagar módulo pré-existente é autorização do dono.
 */
// `cultural_profile` entrou na mesma medição: é um PERFIL de vertical cultural tratado como tipo
// de identidade — mesma categoria proibida (vertical), mesmo destino (congelado, só encolhe).
const QUARTA_GERACAO_MORTA = new Set([
  'store', 'hub', 'industry', 'service_provider', 'customer', 'cultural_profile',
]);

/**
 * Teto de referências no CÓDIGO por valor de geração morta. Medido em 2026-08-04.
 * SÓ DESCE. Cada descida é uma convergência real — registre qual caminho migrou.
 */
const TETO_REFERENCIAS = {
  person: 17,
  actor_human: 17,
  channel: 16,
  company: 9,
  system: 7,
  actor_system: 2,
  actor_organizational: 1,
  // 4ª geração (nomes de vertical) — tetos MEDIDOS em 2026-08-04, não estimados.
  store: 4,
  hub: 4,
  industry: 4,
  service_provider: 5,
  customer: 1,
  cultural_profile: 8,
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules') continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.ts$/.test(e)) out.push(full);
  }
  return out;
}

if (!existsSync(SRC)) {
  failures.push('src/ ausente — fail-closed.');
} else {
  const arquivos = walk(SRC);
  if (arquivos.length === 0) failures.push('src/ sem .ts — fail-closed.');

  // Só linhas que falam de actor_type — evita contar a palavra "system"/"company" solta.
  const linhasComActorType = [];
  for (const f of arquivos) {
    for (const linha of readFileSync(f, 'utf-8').split('\n')) {
      if (linha.includes('actor_type')) linhasComActorType.push(linha);
    }
  }

  // ── 1. nenhuma 4ª geração ──
  // 🔴 A 1ª VERSÃO DESTA CHECAGEM NÃO PODIA DISPARAR. Ela casava o candidato contra uma regex
  // que já continha os valores conhecidos — então um valor NOVO (`merchant`) simplesmente não
  // entrava no conjunto, e o guard passava verde. Guard que não detecta o que existe para
  // detectar é decoração; peguei rodando a prova vermelha, que era o único jeito de saber.
  //
  // Agora casa o CONTEXTO, não o valor: `actor_type` seguido de atribuição/comparação e um
  // literal. Qualquer literal ali é candidato — inclusive um que ninguém previu.
  const encontrados = new Set();
  for (const linha of linhasComActorType) {
    for (const m of linha.matchAll(/actor_type\s*(?::|===|!==|==|=)\s*.{0,12}?['"]([a-z_]+)['"]/g)) {
      encontrados.add(m[1]);
    }
  }
  // 🔴 ESTE BLOCO JÁ SUMIU UMA VEZ (2026-08-04). Ao consertar a regex acima por script, o meu
  // recorte levou junto o consumidor: `encontrados` era preenchido e NUNCA lido, e o guard passava
  // verde porque não havia o que falhar. Produtor sem consumidor — a mesma forma que este arquivo
  // existe para vigiar, cometida dentro dele. Só a prova vermelha revelou.
  for (const v of encontrados) {
    // `string` é ANOTAÇÃO DE TIPO TypeScript (`actor_type: string`), não valor de vocabulário.
    // O guard casa contexto, e o contexto de uma anotação é idêntico ao de uma atribuição —
    // por isso a exclusão é explícita, não uma regex mais esperta que erraria de outro jeito.
    if (v === 'string') continue;
    if (QUARTA_GERACAO_MORTA.has(v)) continue; // congelada abaixo, contada pelo teto
    if (!VOCABULARIO_CONHECIDO.has(v)) {
      failures.push(
        `valor de actor_type FORA das 3 gerações conhecidas: '${v}'. Vocabulário fechado não cresce ` +
        'por suposição — uma 4ª geração é exatamente como as três primeiras nasceram.'
      );
    }
  }

  // ── 2. 🔴 gerações mortas só podem ENCOLHER ──
  for (const [valor, teto] of Object.entries(TETO_REFERENCIAS)) {
    const n = linhasComActorType.filter((l) => l.includes(`'${valor}'`)).length;
    if (n > teto) {
      failures.push(
        `actor_type '${valor}': ${n} referências > teto ${teto}. Código NOVO adotando geração morta — ` +
        'a contagem só pode descer. Se a intenção era converger, converta e BAIXE o teto neste commit.'
      );
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [actor-type-vocabulary-ratchet]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log(
  'GATE OK [actor-type-vocabulary-ratchet] — nenhuma 4ª geração de `actor_type`, e as três gerações ' +
  'que convivem no CHECK não cresceram no código. Vocabulário fechado que vaza é a falha que o gate ' +
  'ontológico denuncia; o teto impede o vazamento de aumentar enquanto a convergência não acontece.'
);
