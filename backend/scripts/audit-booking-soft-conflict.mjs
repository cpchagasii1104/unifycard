#!/usr/bin/env node
// audit-booking-soft-conflict.mjs — Guard da FATIA 4 do arco fundação eventos (A ÚLTIMA):
// AVISO SUAVE de conflito de agenda POR PESSOA (cross-membership) no confirm de booking.
// Doutrina: "a agenda é universal (por pessoa), mas sem engessar — NOTIFICAÇÃO, nunca bloqueio duro."
// Sink OP-2 (ratificada pela direção 2026-07-23): event_outbox + ActorEffect.AVAILABILITY_CONFLICT_DETECTED
// (notify_queue é FANTASMA DE SCHEMA — DT-NOTIFY-SUBSTRATE-SCHEMA-GHOST).
// MORDE se:
//  (a) o hook virar CRÍTICO: a chamada ao detector sair do try/catch no chokepoint de confirm,
//      ou o catch passar a relançar (throw) — falha de aviso NUNCA pode desfazer/vetar o confirm;
//  (b) a SQL de detecção perder o predicado meio-aberto [start,end) OU o conjunto bloqueante
//      {confirmed,checked_in,checked_out} OU a exclusão do self-booking;
//  (c) nascer tabela de AGENDA MATERIALIZADA por pessoa/membro em migration (§2 do GATE F4:
//      a agenda da pessoa é DERIVADA por composição, nunca armazenada);
//  (d) o hook sumir do chokepoint (ramo SERVICE_OFFERING do confirm) ou rodar ANTES do hard-lock;
//  (e) o hook/helper referenciar os ghosts notify_queue/system_notifications (substratos sem tabela).
// Region-anchored; comment-aware (stripTs). Fail-closed.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stripTs = (s) => s.replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1').replace(/\/\*[\s\S]*?\*\//g, '');
const fails = [];
const note = (marker, m) => fails.push(`[${marker}] ${m}`);

const readOrFail = (rel, marker) => {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) { note(marker, `arquivo material ausente: ${rel}`); return ''; }
  return readFileSync(abs, 'utf8');
};

function region(raw, startRe, endRe, label) {
  const s = raw.search(startRe);
  if (s < 0) { note('REGION', `${label}: ancora de inicio nao encontrada (${startRe})`); return null; }
  const rest = raw.slice(s);
  const e = rest.search(endRe);
  const slice = e < 0 ? rest : rest.slice(0, e);
  return { raw: slice, code: stripTs(slice) };
}

// ══ helper de detecção/emissão ══
const HELPER_PATH = 'src/core/availability/booking-soft-conflict.ts';
const HELPER_RAW = readOrFail(HELPER_PATH, 'FILE');
if (HELPER_RAW) {
  const code = stripTs(HELPER_RAW);
  // (b) forma do predicado selado (mesma FORMA do hard-lock): bloqueantes + meio-aberto + self excluído
  if (!/status IN \('confirmed','checked_in','checked_out'\)/.test(code)) {
    note('PREDICATE', `detecção perdeu o conjunto bloqueante {confirmed,checked_in,checked_out} em ${HELPER_PATH}`);
  }
  if (!/a2\.start_datetime\s*<\s*\$5/.test(code) || !/a2\.end_datetime\s*>\s*\$4/.test(code)) {
    note('PREDICATE', `detecção perdeu o overlap meio-aberto [start,end) (a2.start_datetime < $5 / a2.end_datetime > $4) em ${HELPER_PATH}`);
  }
  if (!/b2\.booking_id\s*<>\s*\$3/.test(code)) {
    note('PREDICATE', `detecção perdeu a exclusão do self-booking (b2.booking_id <> $3) em ${HELPER_PATH}`);
  }
  // composição por PESSOA: memberships ativas nas duas direções (banda→pessoas e pessoa→outras bandas)
  if (!/group_actor_memberships/.test(code) || !/status\s*=\s*'active'/.test(code)) {
    note('PERSON-DERIVED', `detecção perdeu a derivação por memberships ATIVAS (group_actor_memberships status='active') em ${HELPER_PATH}`);
  }
  // sink OP-2: outbox governado + effect do vocabulário existente + dedup determinístico
  if (!/insertEventOutboxRow/.test(code)) {
    note('SINK', `helper não emite pelo writer governado insertEventOutboxRow (${HELPER_PATH})`);
  }
  if (!/ActorEffect\.AVAILABILITY_CONFLICT_DETECTED/.test(code)) {
    note('SINK', `helper não usa o effect governado ActorEffect.AVAILABILITY_CONFLICT_DETECTED (${HELPER_PATH}) — vocabulário paralelo proibido`);
  }
  if (!/outboxEventIdFromSeed/.test(code)) {
    note('DEDUP', `helper perdeu o event_id determinístico (outboxEventIdFromSeed) — dedup do outbox quebrado (${HELPER_PATH})`);
  }
  if (!/booking_confirm_cross_membership/.test(code)) {
    note('SINK', `payload perdeu o discriminador metadata.source='booking_confirm_cross_membership' (${HELPER_PATH})`);
  }
  // (e) ghosts nunca referenciados
  if (/notify_queue|system_notifications|notifyService/.test(code)) {
    note('GHOST', `${HELPER_PATH} referencia substrato fantasma (notify_queue/system_notifications/notifyService) — proibido (DT-NOTIFY-SUBSTRATE-SCHEMA-GHOST)`);
  }
}

// ══ chokepoint de confirm (service) — hook presente, DEPOIS do hard-lock, NÃO-CRÍTICO ══
const SVC_PATH = 'src/core/availability/unified-availability.service.ts';
const SVC_RAW = readOrFail(SVC_PATH, 'FILE');
if (SVC_RAW) {
  const reg = region(
    SVC_RAW,
    /if \(availability\.ownerType === AvailabilityOwnerType\.SERVICE_OFFERING\)/,
    /AvailabilityOwnerType\.ACTOR_ASSET/,
    'ramo SERVICE_OFFERING do confirm'
  );
  if (reg) {
    const { code } = reg;
    const lockIdx = code.indexOf('confirmBookingWithProviderLock');
    const hookIdx = code.indexOf('detectAndEmitCrossMembershipSoftConflict');
    // (d) hook no chokepoint
    if (hookIdx < 0) {
      note('HOOK', `ramo SERVICE_OFFERING do confirm perdeu a chamada a detectAndEmitCrossMembershipSoftConflict (${SVC_PATH})`);
    } else {
      // (d) ordem: hard-lock ANTES do aviso (409 propaga antes de qualquer hook)
      if (lockIdx < 0 || lockIdx > hookIdx) {
        note('ORDER', `o aviso suave não pode rodar ANTES do hard-lock selado (confirmBookingWithProviderLock) em ${SVC_PATH}`);
      }
      // (a) não-crítico: a chamada vive dentro de try { ... } catch e o catch NÃO relança
      const tryIdx = code.lastIndexOf('try', hookIdx);
      const catchIdx = code.indexOf('catch', hookIdx);
      if (tryIdx < 0 || tryIdx < lockIdx || catchIdx < 0) {
        note('NON-CRITICAL', `hook do aviso suave fora de try/catch próprio (após o hard-lock) — falha de aviso viraria falha de confirm (${SVC_PATH})`);
      } else {
        const afterHook = code.slice(hookIdx, code.length);
        const catchBlock = afterHook.slice(afterHook.indexOf('catch'));
        if (/\bthrow\b/.test(catchBlock)) {
          note('NON-CRITICAL', `catch do aviso suave relança (throw) — o aviso virou CRÍTICO no caminho de confirm (${SVC_PATH})`);
        }
      }
    }
    // (e) ghosts nunca referenciados no ramo
    if (/notify_queue|system_notifications|notifyService/.test(code)) {
      note('GHOST', `ramo de confirm referencia substrato fantasma (notify_queue/system_notifications/notifyService) em ${SVC_PATH}`);
    }
  }
}

// ══ (c) §2: NENHUMA agenda materializada por pessoa/membro em migration ══
{
  const MIG_DIR = join(ROOT, 'migrations');
  if (!existsSync(MIG_DIR)) {
    note('MIGRATIONS', 'diretorio migrations ausente');
  } else {
    const NAME_A = /(person|pessoa|member|membro)[a-z_]*(calendar|agenda|schedule)/i;
    const NAME_B = /(calendar|agenda|schedule)[a-z_]*(person|pessoa|member|membro)/i;
    for (const f of readdirSync(MIG_DIR)) {
      if (!f.endsWith('.sql')) continue;
      const raw = readFileSync(join(MIG_DIR, f), 'utf8');
      const sql = raw.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
      const createRe = /CREATE\s+TABLE\s+(IF\s+NOT\s+EXISTS\s+)?([a-z0-9_."]+)/gi;
      let m;
      while ((m = createRe.exec(sql)) !== null) {
        const tableName = m[2];
        if (NAME_A.test(tableName) || NAME_B.test(tableName)) {
          note('NO-STORED-CALENDAR', `migration ${f}: CREATE TABLE ${tableName} parece AGENDA MATERIALIZADA por pessoa/membro — §2 do GATE F4 proíbe (agenda da pessoa é DERIVADA, nunca armazenada).`);
        }
      }
    }
  }
}

if (fails.length) {
  console.error('❌ audit-booking-soft-conflict FALHOU:');
  for (const f of fails) console.error('  - ' + f);
  process.exit(1);
}
console.log('✅ audit-booking-soft-conflict OK — aviso suave cross-membership: hook NÃO-CRÍTICO após o hard-lock no chokepoint único de confirm · predicado meio-aberto + bloqueantes + self-excluído · derivação por memberships ATIVAS (zero agenda materializada) · sink outbox governado com dedup determinístico · zero referência a ghosts notify/system_notifications.');
