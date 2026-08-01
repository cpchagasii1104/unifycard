#!/usr/bin/env node
// Guard estrutural — F-ERP-TWO-SIDED (GO Clayton 2026-08-01).
//
// A DOUTRINA QUE ESTE GUARD PROTEGE (actorContextConfig.ts:505 já a escrevia):
//   MODO      = o que APARECE  (projeção, cliente, ZERO autoridade)
//   PERMISSÃO = o que PODE     (servidor, fail-closed)
//   Eixos ORTOGONAIS. Nunca derivar autoridade do modo; nunca esconder por permissão o que
//   deveria sumir por modo.
//
// O DEFEITO CORRIGIDO: o bloco 'erp' inteiro — incluindo `purchase_orders`, que é o lado de
// COMPRA — só existia sob `mode === 'operating'`. COMPRAR É CONSUMIR: o lado de compra da
// empresa estava trancado dentro do modo de vender. O CRM já tinha resolvido o mesmo problema
// (aba `cliente` = operar × aba `fornecedor` = consumir); o ERP virou irmão dele.
//
// MORDE regressão real:
//   (A) sumiu uma das DUAS caras (`side:'sales'` / `side:'supply'`) → ERP voltou a ser de um lado só;
//   (B) a existência do bloco voltou a depender SÓ de `mode === 'operating'`;
//   (C) a face de consuming perdeu a trava de autoridade (`viewerActorId === actorId`) → vazamento:
//       visitante veria pedido de compra de empresa alheia;
//   (D) a face de VENDA perdeu estoque/agenda (não-regressão do que já aparecia);
//   (E) alguém compôs `listSuppliers` no bloco — esse reader filtra por TENANT e NÃO por
//       `owner_actor_id`, então vazaria a lista de fornecedores da empresa B para a empresa A;
//   (F) o E2E perdeu o caso que prova a face de compra ou o que prova que o hint não provado é ignorado.
//
// NÃO valida render visual. Roda no agregador do validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const SERVICE = join(ROOT, 'src', 'modules', 'actor-page', 'actor-page.service.ts');
const E2E = join(ROOT, 'src', 'scripts', 'validate-pipeline-e2e-erp-composed-view.ts');

const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const read = (p) => {
  if (!existsSync(p)) { failures.push(`arquivo ausente: ${p}`); return null; }
  return readFileSync(p, 'utf-8');
};

const service = read(SERVICE);
if (service !== null) {
  const code = stripTs(service);

  // (A) as DUAS caras existem
  if (!/side:\s*'sales'/.test(code)) {
    failures.push(`${SERVICE}: face de VENDA (side:'sales') ausente — o ERP perdeu um dos lados.`);
  }
  if (!/side:\s*'supply'/.test(code)) {
    failures.push(`${SERVICE}: face de COMPRA (side:'supply') ausente — COMPRAR É CONSUMIR; o lado de compra voltou a ficar trancado no modo de vender.`);
  }

  // (B) a existência do bloco NÃO depende só de operating
  if (/if\s*\(\s*mode\s*===\s*'operating'\s*&&\s*actor\.actor_type\s*===\s*'page'/.test(code)) {
    failures.push(`${SERVICE}: a existência do bloco 'erp' voltou a ser gated SÓ por mode==='operating' — regressão de F-ERP-TWO-SIDED.`);
  }
  if (!/actingAsThisPage/.test(code)) {
    failures.push(`${SERVICE}: 'actingAsThisPage' sumiu — sem ele a face de compra não tem como existir em consuming.`);
  }
  if (!/operatesThisPage\s*\|\|\s*actingAsThisPage/.test(code)) {
    failures.push(`${SERVICE}: a condição de existência do ERP não é mais (operatesThisPage || actingAsThisPage).`);
  }

  // (C) 🔴 trava de AUTORIDADE da face de consuming — o eixo que não pode afrouxar
  if (!/actingAsThisPage\s*=\s*!!viewerActorId\s*&&\s*viewerActorId\s*===\s*actorId/.test(code)) {
    failures.push(`${SERVICE}: a face de consuming perdeu a trava 'viewerActorId === actorId'. viewerActorId só é honrado se canRepresentActor JÁ provou na rota (DECISION-0113 D4/D9); sem essa igualdade, um VISITANTE veria os pedidos de compra da empresa.`);
  }

  // (D) não-regressão da face de venda
  const salesFace = code.slice(code.indexOf("side: 'sales'"), code.indexOf("side: 'supply'"));
  if (salesFace.length > 0) {
    for (const key of ['stock', 'agenda', 'purchaseOrders', 'financeiro']) {
      if (!new RegExp(`${key}:`).test(salesFace)) {
        failures.push(`${SERVICE}: a face de VENDA perdeu '${key}' — em operar NADA do que já aparecia pode sumir.`);
      }
    }
  }

  // (E) fornecedores NÃO podem ser compostos aqui (listSuppliers não filtra por owner_actor_id)
  if (/listSuppliers/.test(code)) {
    failures.push(`${SERVICE}: 'listSuppliers' foi composto no actor-page. Esse reader filtra por TENANT e NÃO por owner_actor_id — vazaria os fornecedores da empresa B na página da empresa A. Use um reader escopado por dono (como purchaseOrderRepository.listByOwner) ou nada.`);
  }
}

// (F) as provas que não podem ser apagadas em silêncio
const e2e = read(E2E);
if (e2e !== null) {
  if (!/side\s*===\s*'supply'/.test(e2e)) {
    failures.push(`${E2E}: sumiu a asserção da face de COMPRA (side==='supply') — a fatia ficaria sem prova.`);
  }
  if (!/hint não provado é ignorado|x-test-acting-actor-id/.test(e2e)) {
    failures.push(`${E2E}: sumiu o caso que prova que actionContext DECLARADO por estranho é ignorado — é a prova de que a face de compra não afrouxou autoridade.`);
  }
  if (!/NÃO-REGRESSÃO/.test(e2e)) {
    failures.push(`${E2E}: sumiu o caso de NÃO-REGRESSÃO da face de venda.`);
  }
}

// (G) o CLIENTE espelha o contrato: honra `data.side` e NÃO afirma "estoque vazio" na face de
// compra (ali estoque é NÃO-APLICÁVEL; ausência não pode virar afirmação falsa).
const PAGE = join(ROOT, '..', 'frontend', 'src', 'pages', 'ActorPage.tsx');
const page = read(PAGE);
if (page !== null) {
  if (!/block\.data\.side/.test(page)) {
    failures.push(`${PAGE}: ActorPage não lê 'block.data.side' — o cliente voltou a renderizar UMA cara só, inventando "Estoque: nenhum produto publicado" na face de compra.`);
  }
  if (!/isSupply/.test(page) || !/\{!isSupply &&/.test(page)) {
    failures.push(`${PAGE}: os cards exclusivos da face de VENDA (estoque/agenda) não estão mais condicionados a !isSupply.`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [erp-two-sided-mode-projection]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log("GATE OK [erp-two-sided-mode-projection] — ERP com DUAS caras (side sales|supply); existência = (operatesThisPage || actingAsThisPage), não só operating; face de consuming travada por viewerActorId===actorId (autoridade da rota, não nova); face de venda intacta (stock+agenda+purchaseOrders+financeiro); listSuppliers NÃO composto (não é escopado por dono); E2E com as 3 provas.");
