#!/usr/bin/env node
// Guard estrutural — F-COMPANY-AGENDA-REAL-WIRING. A etapa "Configure sua agenda inicial" do wizard
// de empresa salvava só metadado decorativo (companies.metadata.onboarding) — nunca materializava a
// grade no SSOT temporal real (unified_availability). O backend JÁ suportava ownerType='page' em
// PUT /availability/weekly-template (unified-availability.routes.ts restringe a user/page, autoridade
// real via canRepresentActor) — o gap era 100% frontend: getOwnerType mapeava 'page'→'user' por
// engano, e ProfileAgendaForm bloqueava qualquer actor não-user do editor rico.
//
// MORDE (regressão real), em CADA um dos 5 arquivos:
//   (A) useProfileAgendaLogic.ts: getOwnerType volta a mapear 'page'→'user';
//   (B) ProfileAgenda.tsx: handleSaveSchedule volta a bloquear 'page' OU para de enviar ownerType;
//   (C) ProfileAgendaForm.tsx: editor volta a ficar restrito só a 'user' (isEditableActorType some);
//   (D) api/availability.ts: putWeeklyAvailabilityTemplate perde o suporte a ownerType/actorIdOverride
//       (a construção do header x-action-context some);
//   (E) CompanyOnboardingWizard.tsx: handleSubmit para de chamar putWeeklyAvailabilityTemplate após
//       activateCompanyOperationally (a agenda volta a ser só decorativa).
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE_SRC = join(ROOT, '..', 'frontend', 'src');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const read = (p) => { if (!existsSync(p)) { failures.push(`arquivo ausente: ${p}`); return null; } return stripTs(readFileSync(p, 'utf-8')); };

// (A) getOwnerType mapeia 'page' -> 'page'.
const logicPath = join(FE_SRC, 'hooks', 'useProfileAgendaLogic.ts');
const logic = read(logicPath);
if (logic !== null) {
  const fnIdx = logic.indexOf('getOwnerType');
  const body = fnIdx >= 0 ? logic.slice(fnIdx, fnIdx + 500) : '';
  if (!/actor_type === 'page'\)\s*return 'page'/.test(body)) {
    failures.push(`${logicPath}: getOwnerType não mapeia mais 'page' -> 'page' (regrediu para 'user' ou removido).`);
  }
}

// (B) ProfileAgenda.tsx: handleSaveSchedule aceita 'page' e envia ownerType.
const agendaPath = join(FE_SRC, 'components', 'ProfileAgenda.tsx');
const agenda = read(agendaPath);
if (agenda !== null) {
  const fnIdx = agenda.indexOf('handleSaveSchedule');
  const body = fnIdx >= 0 ? agenda.slice(fnIdx, fnIdx + 2000) : '';
  if (!/actor_type !== 'user' && activeActor\.actor_type !== 'page'/.test(body)) {
    failures.push(`${agendaPath}: handleSaveSchedule voltou a bloquear 'page' (guarda de tipo não permite mais empresa).`);
  }
  if (!/ownerType:\s*getOwnerType\(\)/.test(body)) {
    failures.push(`${agendaPath}: handleSaveSchedule parou de enviar ownerType explícito ao salvar — backend assumiria 'user' por default.`);
  }
}

// (C) ProfileAgendaForm.tsx: editor aceita 'page'.
const formPath = join(FE_SRC, 'components', 'ProfileAgendaForm.tsx');
const form = read(formPath);
if (form !== null) {
  if (!/isEditableActorType\s*=\s*activeActor\?\.\s*actor_type\s*===\s*'user'\s*\|\|\s*activeActor\?\.\s*actor_type\s*===\s*'page'/.test(form)) {
    failures.push(`${formPath}: isEditableActorType não cobre mais 'page' — editor voltaria a bloquear empresa.`);
  }
  if (!/isEditableActorType\s*\?/.test(form)) {
    failures.push(`${formPath}: render condicional não usa mais isEditableActorType para decidir editor vs bloqueio.`);
  }
}

// (D) api/availability.ts: putWeeklyAvailabilityTemplate suporta ownerType + actorIdOverride.
const availPath = join(FE_SRC, 'api', 'availability.ts');
const avail = read(availPath);
if (avail !== null) {
  const fnIdx = avail.indexOf('async function putWeeklyAvailabilityTemplate');
  const body = fnIdx >= 0 ? avail.slice(fnIdx, fnIdx + 2500) : '';
  if (!/ownerType\?:\s*'user'\s*\|\s*'page'/.test(body)) {
    failures.push(`${availPath}: putWeeklyAvailabilityTemplate perdeu o parâmetro ownerType.`);
  }
  if (!/actorIdOverride\?:\s*string/.test(body)) {
    failures.push(`${availPath}: putWeeklyAvailabilityTemplate perdeu o parâmetro actorIdOverride.`);
  }
  if (!/x-action-context/.test(body)) {
    failures.push(`${availPath}: construção do header x-action-context sumiu — actorIdOverride ficaria sem efeito.`);
  }
}

// (E) CompanyOnboardingWizard.tsx: handleSubmit chama putWeeklyAvailabilityTemplate após activation.
const wizardPath = join(FE_SRC, 'components', 'company', 'CompanyOnboardingWizard.tsx');
const wizard = read(wizardPath);
if (wizard !== null) {
  const actIdx = wizard.indexOf('activateCompanyOperationally(companyId');
  const putIdx = wizard.indexOf('putWeeklyAvailabilityTemplate(', actIdx + 1);
  if (actIdx < 0) {
    failures.push(`${wizardPath}: chamada a activateCompanyOperationally não encontrada — âncora de ordem quebrada.`);
  } else if (putIdx < 0 || putIdx < actIdx) {
    failures.push(`${wizardPath}: putWeeklyAvailabilityTemplate não é chamado DEPOIS de activateCompanyOperationally — agenda real da empresa não seria materializada, ou seria chamada antes da empresa virar operacional (page-actor ainda não existiria em findAvailableActors).`);
  }
  if (!/ownerType:\s*'page'/.test(wizard)) {
    failures.push(`${wizardPath}: chamada não declara ownerType:'page'.`);
  }
  if (!/actorIdOverride:\s*pageActor\.actor_id/.test(wizard)) {
    failures.push(`${wizardPath}: chamada não passa actorIdOverride (dependeria do actor ativo no React state, frágil/assíncrono).`);
  }
}

if (failures.length > 0) {
  console.error('GATE FAIL [company-agenda-real-wiring]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [company-agenda-real-wiring] — agenda de empresa materializa de verdade no SSOT temporal (ownerType=page, autoridade real via canRepresentActor); editor rico destravado para page; wizard chama após ativação com actorIdOverride explícito. F-COMPANY-AGENDA-REAL-WIRING blindada.');
