#!/usr/bin/env node
// Guard estrutural — F-COMPANY-AGENDA-REAL-WIRING. A etapa "Configure sua agenda" do wizard de
// empresa salvava só metadado decorativo (companies.metadata.onboarding.calendarConfig, horário
// único p/ todos os dias) — nunca materializava a grade no SSOT temporal real (unified_availability).
//
// Arquitetura final: o wizard usa o MESMO editor rico por dia (AvailabilityScheduleEnhanced) já
// usado em /perfil, materializando de verdade a cada "Salvar" JÁ NA ETAPA 4 — não precisa esperar
// activateCompanyOperationally (Etapa 6), porque o page-actor nasce atomicamente na CRIAÇÃO da
// empresa (F-ATOMIC-COMPANY-BIRTH) e a autoridade (canManageCompany) não depende de company_status.
// Endpoint novo GET /companies/:companyId/page-actor (autoridade canManageCompany) resolve o
// pageActorId sem depender de findAvailableActors (que só lista empresa OPERACIONAL).
//
// MORDE (regressão real):
//   (A) useProfileAgendaLogic.ts: getOwnerType volta a mapear 'page'->'user';
//   (B) ProfileAgenda.tsx: handleSaveSchedule volta a bloquear 'page' OU para de enviar ownerType;
//   (C) ProfileAgendaForm.tsx: editor volta a ficar restrito só a 'user';
//   (D) api/availability.ts: putWeeklyAvailabilityTemplate perde ownerType/actorIdOverride;
//   (E) companies.routes.ts: GET /:companyId/page-actor sumir OU perder o gate canManageCompany;
//   (F) companies.service.ts: getPageActorId sumir;
//   (G) api/companies.ts: getCompanyPageActorId (client) sumir;
//   (H) CompanyOnboardingWizard.tsx: parar de usar AvailabilityScheduleEnhanced na Etapa 4, OU o
//       onSave parar de chamar putWeeklyAvailabilityTemplate com ownerType='page' + actorIdOverride.
// Heurística textual comment-stripped. Em validate:regression-guards. NÃO altera runtime.

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd(); // backend/
const FE_SRC = join(ROOT, '..', 'frontend', 'src');
const stripTs = (s) => s
  .replace(/(^|[^:"'`])\/\/[^\n]*/g, '$1')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const failures = [];
const read = (p, base = ROOT) => {
  const full = join(base, p);
  if (!existsSync(full)) { failures.push(`arquivo ausente: ${full}`); return null; }
  return stripTs(readFileSync(full, 'utf-8'));
};

// (A) getOwnerType mapeia 'page' -> 'page'.
const logic = read(join('hooks', 'useProfileAgendaLogic.ts'), FE_SRC);
if (logic !== null) {
  const fnIdx = logic.indexOf('getOwnerType');
  const body = fnIdx >= 0 ? logic.slice(fnIdx, fnIdx + 500) : '';
  if (!/actor_type === 'page'\)\s*return 'page'/.test(body)) {
    failures.push(`useProfileAgendaLogic.ts: getOwnerType não mapeia mais 'page' -> 'page'.`);
  }
}

// (B) ProfileAgenda.tsx: handleSaveSchedule aceita 'page' e envia ownerType.
const agenda = read(join('components', 'ProfileAgenda.tsx'), FE_SRC);
if (agenda !== null) {
  const fnIdx = agenda.indexOf('handleSaveSchedule');
  const body = fnIdx >= 0 ? agenda.slice(fnIdx, fnIdx + 2000) : '';
  if (!/actor_type !== 'user' && activeActor\.actor_type !== 'page'/.test(body)) {
    failures.push(`ProfileAgenda.tsx: handleSaveSchedule voltou a bloquear 'page'.`);
  }
  if (!/ownerType:\s*getOwnerType\(\)/.test(body)) {
    failures.push(`ProfileAgenda.tsx: handleSaveSchedule parou de enviar ownerType explícito.`);
  }
}

// (C) ProfileAgendaForm.tsx: editor aceita 'page'.
const form = read(join('components', 'ProfileAgendaForm.tsx'), FE_SRC);
if (form !== null) {
  if (!/isEditableActorType\s*=\s*activeActor\?\.\s*actor_type\s*===\s*'user'\s*\|\|\s*activeActor\?\.\s*actor_type\s*===\s*'page'/.test(form)) {
    failures.push(`ProfileAgendaForm.tsx: isEditableActorType não cobre mais 'page'.`);
  }
}

// (D) api/availability.ts: putWeeklyAvailabilityTemplate suporta ownerType + actorIdOverride.
const avail = read(join('api', 'availability.ts'), FE_SRC);
if (avail !== null) {
  const fnIdx = avail.indexOf('async function putWeeklyAvailabilityTemplate');
  const body = fnIdx >= 0 ? avail.slice(fnIdx, fnIdx + 2500) : '';
  if (!/ownerType\?:\s*'user'\s*\|\s*'page'/.test(body)) failures.push(`api/availability.ts: perdeu ownerType.`);
  if (!/actorIdOverride\?:\s*string/.test(body)) failures.push(`api/availability.ts: perdeu actorIdOverride.`);
  if (!/x-action-context/.test(body)) failures.push(`api/availability.ts: construção do header x-action-context sumiu.`);
}

// (E) companies.routes.ts: GET /:companyId/page-actor com gate canManageCompany.
const routes = read(join('src', 'core', 'companies', 'companies.routes.ts'));
if (routes !== null) {
  const idx = routes.indexOf(`'/:companyId/page-actor'`);
  if (idx < 0) {
    failures.push(`companies.routes.ts: rota GET /:companyId/page-actor sumiu.`);
  } else {
    const body = routes.slice(idx, idx + 1500);
    if (!/canManageCompany/.test(body)) failures.push(`companies.routes.ts: GET /:companyId/page-actor perdeu o gate canManageCompany.`);
    if (!/status\(403\)/.test(body)) failures.push(`companies.routes.ts: GET /:companyId/page-actor não recusa fail-closed (403) sem autoridade.`);
  }
}

// (F) companies.service.ts: getPageActorId.
const service = read(join('src', 'core', 'companies', 'companies.service.ts'));
if (service !== null && !/async getPageActorId\(/.test(service)) {
  failures.push(`companies.service.ts: getPageActorId sumiu.`);
}

// (G) api/companies.ts (frontend): getCompanyPageActorId.
const feCompanies = read(join('api', 'companies.ts'), FE_SRC);
if (feCompanies !== null && !/export async function getCompanyPageActorId/.test(feCompanies)) {
  failures.push(`api/companies.ts: getCompanyPageActorId (client) sumiu.`);
}

// (H) CompanyOnboardingWizard.tsx: usa o editor rico + onSave chama putWeeklyAvailabilityTemplate
//     com ownerType='page' + actorIdOverride, resolvido via getCompanyPageActorId (NÃO depende de
//     activateCompanyOperationally nem de findAvailableActors/getAvailableActors).
const wizard = read(join('components', 'company', 'CompanyOnboardingWizard.tsx'), FE_SRC);
if (wizard !== null) {
  if (!/AvailabilityScheduleEnhanced/.test(wizard)) {
    failures.push(`CompanyOnboardingWizard.tsx: parou de usar o editor rico (AvailabilityScheduleEnhanced) — voltaria ao horário único decorativo.`);
  }
  if (!/getCompanyPageActorId\(companyId\)/.test(wizard)) {
    failures.push(`CompanyOnboardingWizard.tsx: parou de resolver o pageActorId via getCompanyPageActorId — dependeria de novo do timing frágil pós-ativação.`);
  }
  const saveIdx = wizard.indexOf('handleSaveCompanySchedule');
  const saveBody = saveIdx >= 0 ? wizard.slice(saveIdx, saveIdx + 1200) : '';
  if (!/ownerType:\s*'page'/.test(saveBody)) failures.push(`CompanyOnboardingWizard.tsx: handleSaveCompanySchedule não declara ownerType:'page'.`);
  if (!/actorIdOverride:\s*pageActorId/.test(saveBody)) failures.push(`CompanyOnboardingWizard.tsx: handleSaveCompanySchedule não passa actorIdOverride.`);
}

if (failures.length > 0) {
  console.error('GATE FAIL [company-agenda-real-wiring]:');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('GATE OK [company-agenda-real-wiring] — agenda de empresa materializa de verdade no SSOT temporal JÁ NA ETAPA 4 (editor rico por dia, ownerType=page, autoridade real via canManageCompany/canRepresentActor), sem depender de activateCompanyOperationally. F-COMPANY-AGENDA-REAL-WIRING blindada.');
