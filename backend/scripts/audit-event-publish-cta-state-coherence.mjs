#!/usr/bin/env node
// Guard estrutural — F-EVENT-PUBLISH-FUNNEL ② (CTA de publicar × máquina de estado real).
//
// A máquina de transição canônica de evento (core/events/event.aggregate.ts, ALLOWED_TRANSITIONS)
// só permite chegar a 'published' a partir de 'declared' (draft->declared->published->active->ended).
// O defeito original (medido 2026-08-01): EventPage.tsx e EventosPage.tsx condicionavam o CTA
// "Publicar" a `status === 'draft'` — o ÚNICO estado de onde a transição para 'published' é
// PROIBIDA. O botão aparecia exatamente onde o backend sempre recusaria, e sumia no estado certo
// (declared, onde os 13 eventos presos estavam).
//
// MORDE se: algum arquivo de frontend chama `publishEvent(` dentro de um bloco JSX guardado por
// `event.status === '<valor>'` (ou `.status === '<valor>'`) onde <valor> NÃO está no conjunto de
// estados que ALLOWED_TRANSITIONS permite levar a 'published' — reextraído do próprio
// event.aggregate.ts a cada corrida (não hardcoded), então se a máquina de estado mudar, o guard
// re-deriva o conjunto certo sozinho.
//
// Heurística textual comment-stripped, ancorada por região (padrão addendum-2). NÃO altera runtime.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const FRONTEND_ROOT = join(ROOT, '..', 'frontend', 'src');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const read = (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null);
const failures = [];

// 1. Deriva do PRÓPRIO event.aggregate.ts (não hardcoded) quais status podem chegar a 'published'.
const aggPath = join(ROOT, 'src/core/events/event.aggregate.ts');
const agg = read(aggPath);
if (agg === null) {
  failures.push(`arquivo ausente: src/core/events/event.aggregate.ts (guard não consegue derivar ALLOWED_TRANSITIONS).`);
} else {
  const stripped = stripTs(agg);
  const tableMatch = stripped.match(/ALLOWED_TRANSITIONS[^{]*\{([\s\S]*?)\n\};/);
  if (!tableMatch) {
    failures.push('ALLOWED_TRANSITIONS não encontrado/forma inesperada em event.aggregate.ts — guard não pode derivar o conjunto de status válidos.');
  } else {
    const body = tableMatch[1];
    // cada linha: `estado: ['destino1', 'destino2'],`
    const entryRe = /(\w+):\s*\[([^\]]*)\]/g;
    const canReachPublished = new Set();
    // 🔴 2026-08-04 — O VOCABULÁRIO DE STATUS DE EVENTO, derivado do MESMO agregado (origens ∪ destinos).
    // Sem ele o guard não sabia o que é status de evento e casava QUALQUER `.status === '...'`: em
    // OrganizerEventsDashboard.tsx ele leu `r.status === 'fulfilled'` de um `Promise.allSettled` e
    // acusou um CTA que não existe. É a assinatura de erro da casa — ferramenta configurada de um
    // jeito, resultado lido como se fosse de outro. Continua derivado, nunca hardcoded.
    const eventStatuses = new Set();
    let m;
    while ((m = entryRe.exec(body))) {
      const from = m[1];
      const targets = m[2].split(',').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
      eventStatuses.add(from);
      for (const t of targets) eventStatuses.add(t);
      if (targets.includes('published')) canReachPublished.add(from);
    }
    if (canReachPublished.size === 0) {
      failures.push('Nenhum status em ALLOWED_TRANSITIONS leva a "published" — máquina de estado parece quebrada (nada publica NUNCA).');
    } else {
      // 2. Varre o frontend inteiro por chamadas a publishEvent( e valida o gate mais próximo ANTES dela.
      function walk(dir, out = []) {
        for (const entry of readdirSync(dir)) {
          if (entry === 'node_modules' || entry === '.git') continue;
          const full = join(dir, entry);
          const st = statSync(full);
          if (st.isDirectory()) walk(full, out);
          else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
        }
        return out;
      }
      const files = existsSync(FRONTEND_ROOT) ? walk(FRONTEND_ROOT) : [];
      if (files.length === 0) {
        failures.push(`Não encontrei frontend/src em ${FRONTEND_ROOT} — guard não pode varrer CTAs.`);
      }
      let sitesChecked = 0;
      const relPath = (f) => f.replace(ROOT + '\\', '').replace(/\\/g, '/');
      const findGateBefore = (src, idx, windowSize) => {
        const windowStart = Math.max(0, idx - windowSize);
        const window = src.slice(windowStart, idx);
        // 🔴 2026-08-04 — Casa QUALQUER comparação contra literal, e o filtro de vocabulário abaixo é
        // que decide se é gate. O padrão anterior exigia `.status ===` literalmente e por isso NÃO
        // enxergava o gate correto de OrganizerEventsDashboard (`st === 'declared'`, com `st` derivado
        // de `statusCanonical ?? status`) — enxergava só o `r.status === 'fulfilled'` do allSettled.
        // Ler pelo NOME do campo era a fraqueza; ler pelo VOCABULÁRIO derivado do agregado é a força.
        const gateRe = /===\s*['"](\w+)['"]/g;
        let lastGate = null;
        let gm;
        // Só conta como GATE a comparação contra um status que o agregado reconhece como de EVENTO.
        // `r.status === 'fulfilled'` (Promise.allSettled), `res.status === 'ok'` etc. não são gates de
        // publicação e não podem sequestrar a leitura. NÃO enfraquece: se sobrar nenhum gate de evento
        // antes da chamada, o guard reporta "sem gate identificável" logo abaixo — que também é falha.
        while ((gm = gateRe.exec(window))) {
          if (eventStatuses.has(gm[1])) lastGate = gm[1];
        }
        return lastGate;
      };
      for (const file of files) {
        const raw = read(file);
        if (raw === null) continue;
        const src = stripTs(raw);
        const callRe = /publishEvent\(/g;
        let cm;
        while ((cm = callRe.exec(src))) {
          const callIdx = cm.index;
          // API de definição (export async function publishEvent) não é um CTA — pula.
          const beforeCall = src.slice(Math.max(0, callIdx - 40), callIdx);
          if (/export\s+async\s+function\s+$/.test(beforeCall) || /^\s*async\s+function\s+publishEvent/.test(src.slice(callIdx - 20, callIdx + 20))) continue;

          // Padrão 1 — inline: `.status === 'X'` aparece perto da própria chamada (mesmo bloco JSX).
          let gate = findGateBefore(src, callIdx, 800);

          // Padrão 2 — indireção: publishEvent( está DENTRO de uma função nomeada (ex.: um
          // `handlePublishEvent`), chamada de outro lugar do arquivo (tipicamente onClick). Acha o
          // nome da função envolvente e procura o gate perto de ONDE ELA É INVOCADA, não onde é
          // definida — é ali que a condição de estado realmente vive.
          if (!gate) {
            const beforeWide = src.slice(Math.max(0, callIdx - 2000), callIdx);
            // 🔴 2026-08-04 — `useCallback(` entra no padrão. Sem ele, `const publicar = useCallback(
            // async (id) => { … publishEvent(id) … })` não casava, o guard subia até a função ANTERIOR
            // do arquivo (`load`) e procurava o gate no lugar errado — reportando "sem gate" num
            // arquivo cujo gate (`st === 'declared'`) está correto. Handler de React é quase sempre
            // useCallback; não reconhecê-lo era não reconhecer o caso comum.
            // 🔴 2026-08-04 — a envolvente é a ÚLTIMA declaração antes da chamada, não a primeira.
            // `.match()` devolve a PRIMEIRA ocorrência: num arquivo com `const load = …` antes de
            // `const publicar = …`, o guard elegia `load` e ia procurar o gate onde ele nunca esteve.
            // Varremos todas e ficamos com a mais próxima da chamada.
            const ultimaDeclaracao = (re) => {
              let achado = null, mm;
              const g = new RegExp(re.source, 'g');
              while ((mm = g.exec(beforeWide))) achado = mm[1];
              return achado;
            };
            const fnName = ultimaDeclaracao(/const\s+(\w+)\s*=\s*(?:useCallback\(\s*)?async\s*\([^)]*\)\s*=>\s*\{/)
              || ultimaDeclaracao(/(?:async\s+)?function\s+(\w+)\s*\([^)]*\)\s*\{/);
            if (fnName) {
              // procura invocações de fnName( no arquivo INTEIRO, exceto a própria definição.
              const invokeRe = new RegExp(`(?<!function\\s)(?<!const\\s)\\b${fnName}\\s*\\(`, 'g');
              let im;
              while ((im = invokeRe.exec(src))) {
                if (im.index === beforeWide.length + (Math.max(0, callIdx - 2000))) continue; // não é a def em si (aprox.)
                // Janela de 1500: o gate costuma ser calculado no topo do `.map(...)` e a invocação
                // fica no `onClick` lá embaixo, com o JSX da linha inteira no meio (em
                // OrganizerEventsDashboard são ~900 caracteres entre `podePublicar` e `publicar(`).
                // 500 cortava antes do gate e produzia "sem gate identificável" num arquivo CORRETO.
                const g = findGateBefore(src, im.index, 1500);
                if (g) { gate = g; break; }
              }
            }
          }

          if (!gate) {
            failures.push(`${relPath(file)}: chamada a publishEvent( (direta ou via handler nomeado) sem gate de status identificável — não dá para provar que só dispara em estado válido.`);
            continue;
          }
          sitesChecked++;
          if (!canReachPublished.has(gate)) {
            failures.push(
              `${relPath(file)}: CTA de publicar condicionado a status === '${gate}', mas ALLOWED_TRANSITIONS NÃO permite '${gate}' -> 'published' (conjunto válido: ${[...canReachPublished].join(', ')}). O botão apareceria num estado onde o backend sempre recusa.`
            );
          }
        }
      }
      if (sitesChecked === 0 && failures.length === 0) {
        failures.push('Nenhum site de publishEvent( encontrado no frontend — guard não mordeu nada (verifique se o padrão de busca ainda bate com o código).');
      }
    }
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [event-publish-cta-state-coherence]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [event-publish-cta-state-coherence] — todo CTA de publicar (publishEvent() no frontend) está condicionado a um status que ALLOWED_TRANSITIONS (event.aggregate.ts, derivado a cada corrida) efetivamente permite levar a \'published\'. Conjunto válido re-derivado do próprio agregado, não hardcoded.');
