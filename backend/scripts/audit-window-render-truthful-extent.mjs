#!/usr/bin/env node
// backend/scripts/audit-window-render-truthful-extent.mjs
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO (F-WINDOW-RENDER-TRUTHFUL-EXTENT, 2026-08-06, fricção de uso do Clayton)
// ║ NORMA:   `project_frontend_nunca_cria_verdade` — a tela PROJETA verdade, não a encurta
// ║ NÃO:     renderizar a HORA do fim de uma janela ao lado da DATA do início, sem ramo de dia≠
// ║ EM VEZ:  compare os dias (`toDateString()`) e mostre a DATA do fim quando ele cair em outro dia
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE EXISTE ═══
// Clayton abriu "Solicitar orçamento" da Tenda 10x10 em 06/08 e leu: "ter., 04 de ago. · 08:00–18:00".
// Conclusão natural — e correta, dado o que a tela dizia: *a única opção já passou*.
// A janela NÃO tinha passado. Ela ia de 2026-08-04 08:00 a 2026-09-03 18:00: **30,4 dias, válida por
// mais 28**. `janelaLegivel` imprimia a data do INÍCIO e depois as duas HORAS, **descartando a data
// do FIM** — e uma janela de um mês virava um slot de 10 horas num dia que já passou.
//
// 🔴 O BACKEND ESTAVA SADIO. `event-need-supplier-discovery.service.ts:680` filtra
// `end_datetime >= now()` e o comentário de lá já dizia *"janela vencida não é agenda"*. Registro
// isso com destaque: quem for investigar de novo NÃO deve mexer no filtro — ele está certo.
//
// ⚠️ NÃO ERA BORDA: 56 das 70 janelas do banco (80%) atravessam mais de um dia.
//
// ═══ A FAMÍLIA (3 membros, achados pelo mesmo grep) ═══
//   frontend/src/components/entity/QuoteRequestDialog.tsx      ← o que Clayton viu (dado real)
//   frontend/src/components/events/EventCheckoutModal.tsx      ← mesmo defeito, 0 caso observável
//   frontend/src/components/social/CulturalEventCard.tsx       ← idem
//
// ═══ O QUE ELE MORDE (substância, não nome) ═══
// Para todo sítio que renderiza a HORA de um valor de FIM (`formatTime(...end)`,
// `toLocaleTimeString` sobre algo `end`/`fim`), exige que o MESMO arquivo compare os DIAS
// (`toDateString()`). Sem a comparação, não existe ramo para o caso multi-dia — e a tela volta a
// afirmar que a janela acaba no dia em que começou.
//
// Em validate:regression-guards.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = join(process.cwd(), '..');
const FE = join(ROOT, 'frontend', 'src');
const failures = [];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

// Comentários fora: comment-out não pode evadir nem inventar violação (padrão da casa).
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

if (!existsSync(FE)) {
  console.log('GATE FAIL [window-render-truthful-extent]:');
  console.log(`  ❌ frontend/src não encontrado a partir de ${process.cwd()} — não verificar não é aprovar.`);
  process.exit(1);
}

const files = walk(FE);
let sitesChecked = 0;

// A HORA de um FIM sendo renderizada. Duas formas vivas no repositório:
//   formatTime(<algo com end/fim>)      ·      <algo com end/fim>.toLocaleTimeString(
// 🔴 A 3ª forma custou uma correção do próprio guard: a v1 pegava 2 dos 3 membros e DEIXAVA DE FORA
// exatamente o sítio onde o defeito nasceu — `janelaLegivel(inicio, fim)` renomeia o fim para `f`
// antes de formatar, então nenhum padrão baseado no NOME da variável no ponto de uso o alcança.
// Guard que não vigia o caso que o originou é decoração. A 3ª entrada casa a ASSINATURA
// (função que recebe um par início/fim temporal), não o nome no ponto de uso.
const END_TIME_PATTERNS = [
  /formatTime\(\s*[A-Za-z0-9_.?[\]]*(?:end|fim|End|Fim)[A-Za-z0-9_.?[\]]*\s*\)/,
  /\b[A-Za-z0-9_.?[\]]*(?:end|fim|End|Fim)[A-Za-z0-9_.?[\]]*\.toLocaleTimeString\s*\(/,
  /function\s+\w+\s*\(\s*[A-Za-z0-9_]*(?:inicio|ini|start|comeco)[A-Za-z0-9_]*\s*:[^,)]*,\s*[A-Za-z0-9_]*(?:fim|end|termino)[A-Za-z0-9_]*\s*:/i,
];

for (const abs of files) {
  const src = stripTs(readFileSync(abs, 'utf-8'));
  // O guard vigia quem RENDERIZA, não quem valida. `validateDateRange(startDate, endDate)` casa a
  // assinatura e não desenha nada — foi o 1º falso positivo desta regra, e a correção é substância:
  // só conta como sítio se o arquivo também FORMATA data/hora.
  const formata = /toLocale(?:Time|Date)String\s*\(/.test(src);
  const hit = END_TIME_PATTERNS.find((re) => re.test(src));
  if (!hit || !formata) continue;
  sitesChecked++;
  // Exigência: o arquivo compara os DIAS em algum ramo. É o que distingue "acaba hoje" de
  // "acaba noutro dia" — sem isso, a hora sozinha MENTE sobre a extensão.
  if (!/toDateString\(\)/.test(src)) {
    failures.push(
      `${relative(ROOT, abs).replace(/\\/g, '/')}: renderiza a HORA de um valor de FIM sem comparar os DIAS ` +
      `(toDateString()). Janela/evento que atravessa o dia sai como se acabasse no dia em que começou — ` +
      `foi o defeito de 2026-08-06 (Tenda 10x10: 30 dias exibidos como 10 horas num dia já passado).`
    );
  }
}

// 🔴 PISO, não só o zero. A prova vermelha de 2026-08-06 mostrou o furo: renomeei o parâmetro `fim`
// de UM sítio e o guard passou VERDE — porque os outros 3 ainda casavam e a checagem de zero não
// disparava. Guard que perde um alvo em silêncio é o mesmo defeito do "excluído que não aparece".
// A família tem 4 membros conhecidos; cair abaixo disso = a detecção parou de alcançar alguém.
// Sobe quando um sítio novo entrar (ratchet: o piso só SOBE, como os tetos só descem).
const MIN_SITES = 4;
if (sitesChecked < MIN_SITES) {
  failures.push(
    `só ${sitesChecked} sítio(s) detectado(s), piso ${MIN_SITES} — o guard PERDEU alvo. ` +
    `Ou a regex de detecção parou de alcançar um sítio (renomear o parâmetro basta), ou um sítio foi ` +
    `removido. Nos dois casos a resposta é revisar, não baixar o piso.`
  );
}

if (failures.length) {
  console.log('GATE FAIL [window-render-truthful-extent]:');
  for (const f of failures) console.log('  ❌ ' + f);
  console.log('\n→ A tela PROJETA a verdade, não a encurta. Compare os dias e mostre a DATA do fim quando ele cair em outro dia.');
  console.log('→ O BACKEND está sadio (event-need-supplier-discovery.service.ts:680 filtra end_datetime >= now()) — NÃO mexa no filtro.');
  process.exit(1);
}

console.log(
  `GATE OK [window-render-truthful-extent] — ${sitesChecked} sítio(s) renderizam a hora de um FIM, e ` +
  `todos comparam os DIAS antes (toDateString): janela/evento que atravessa o dia mostra a DATA do fim. ` +
  `Denominador declarado: 56 das 70 janelas do banco (80%) são multi-dia — não é borda.`
);
