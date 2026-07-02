// frontend/src/api/companies.ts
// API para gerenciar empresas (PJ)

import { CompanyStatus, CompanyUserRole, CompanyOperationalStatus } from '@unificard/contracts';
import { apiFetch } from './client';

// Re-export para compatibilidade reversa
export type { CompanyUserRole, CompanyStatus, CompanyOperationalStatus };

/**
 * Status de verificação KYB (DECISION-0089) — derivado de `fiscal_identities.kyb_status`.
 * FONTE ÚNICA de "empresa verificada". `companyStatus`/`isVerified` NÃO são fonte.
 */
export type KybVerificationStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'closed';

export interface CompanyAddress {
  cep?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface CompanyContact {
  phone?: string;
  email?: string;
  website?: string;
}

export interface CompanyActivity {
  mainActivityCode?: string; // CNAE principal
  mainActivityDescription?: string;
  secondaryActivities?: Array<{
    code: string;
    description: string;
  }>;
}

export interface CompanyPermissions {
  canManageCompany: boolean;
  canManageFinancial: boolean;
  canManageEmployees: boolean;
  canViewReports: boolean;
  canManageServices: boolean;
}

export interface Company {
  companyId: string;
  globalUserId: string;
  cnpj: string;
  companyName: string;
  tradeName?: string;
  registrationDate?: string;
  address: CompanyAddress;
  contact: CompanyContact;
  activity: CompanyActivity;
  revenueData?: Record<string, any>;
  status: CompanyOperationalStatus;
  /** lifecycle/onboarding — NÃO é fonte de verificação; VERIFIED/APPROVED legados/mortos (DECISION-0092/0093). */
  companyStatus?: CompanyStatus;
  /** DECISION-0093 §4.3 / Fase 3.3-B1: `isVerified` REMOVIDO (vestígio compat, sem leitor vivo). Use `isKybApproved`. */
  /** DECISION-0089 Fase 1 — FONTE ÚNICA de verificação PJ (derivada de fiscal_identities.kyb_status). */
  kybStatus?: KybVerificationStatus | null;
  /** Derivado: `kybStatus === 'approved'`. Único critério visual de "empresa verificada". */
  isKybApproved?: boolean;
  /** Par soberano da ativação (DECISION-0098). Projeção read-only do backend; null = não operacional. */
  primaryCompanyTypeId?: string | null;
  primaryConceptId?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  userRole: {
    companyUserId: string;
    companyId: string;
    globalUserId: string;
    role: CompanyUserRole;
    roleDescription?: string;
    permissions: CompanyPermissions;
    isActive: boolean;
    isPrimary: boolean;
    metadata?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
  };
}

export type MarketplaceDomain = 'market' | 'services' | 'events' | 'real_estate' | 'vehicles' | 'jobs';

export interface CompanyDomain {
  companyDomainId: string;
  companyId: string;
  domain: MarketplaceDomain;
  enabled: boolean;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyInput {
  cnpj: string;
  companyName?: string;
  tradeName?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  activity?: Partial<CompanyActivity>;
  role: CompanyUserRole;
  roleDescription?: string;
  permissions?: Partial<CompanyPermissions>;
  isPrimary?: boolean;
  fetchFromRevenue?: boolean;
  // F-PJ-DOMAIN-SELECTOR-NEUTRALIZE (DECISION-0102): `domains` (livre escolha) REMOVIDO do create —
  // domínio de atuação deriva de CONCEPT + evidência fiscal, governado pelo backend; não é enviado pelo frontend.
}

export interface UpdateCompanyInput {
  companyName?: string;
  tradeName?: string;
  registrationDate?: string;
  address?: Partial<CompanyAddress>;
  contact?: Partial<CompanyContact>;
  activity?: Partial<CompanyActivity>;
  status?: CompanyOperationalStatus;
  metadata?: Record<string, any>;
}

export interface RevenueFederalData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  data_abertura?: string;
  situacao_cadastral?: string;
  tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  telefone?: string;
  email?: string;
  capital_social?: string;
  porte?: string;
  natureza_juridica?: string;
  atividade_principal?: Array<{
    code: string;
    text: string;
  }>;
  atividades_secundarias?: Array<{
    code: string;
    text: string;
  }>;
  qsa?: Array<{
    nome: string;
    qual: string;
    pais_origem?: string;
    nome_rep_legal?: string;
    qual_rep_legal?: string;
  }>;
}

/**
 * Lista todas as empresas do usuário
 */
export async function listCompanies(): Promise<Company[]> {
  const response = await apiFetch('/companies');
  const result = await response.json();
  // Suportar formato antigo e novo
  if (result.ok && result.data) {
    return result.data.companies || [];
  }
  return result.companies || [];
}

/**
 * Busca empresa por ID
 */
export async function getCompany(companyId: string): Promise<Company> {
  const response = await apiFetch(`/companies/${companyId}`);
  return response.json();
}

/**
 * Cria nova empresa
 */
export async function createCompany(input: CreateCompanyInput): Promise<{ company: Company; companyUser: any }> {
  const response = await apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Lista domínios ativos de uma empresa
 */
export async function getCompanyDomains(companyId: string): Promise<{ domains: CompanyDomain[] }> {
  const response = await apiFetch(`/companies/${companyId}/domains`, {
    method: 'GET',
  });
  return response.json();
}

/**
 * Atualiza domínios de uma empresa
 */
export async function updateCompanyDomains(
  companyId: string,
  domains: MarketplaceDomain[]
): Promise<{ domains: CompanyDomain[] }> {
  const response = await apiFetch(`/companies/${companyId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domains }),
  });
  return response.json();
}

/**
 * Atualiza empresa
 */
export async function updateCompany(companyId: string, input: UpdateCompanyInput): Promise<Company> {
  const response = await apiFetch(`/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return response.json();
}

/**
 * Remove empresa (soft delete)
 * apiFetch já lança erro automaticamente com a mensagem do backend
 */
export async function deleteCompany(companyId: string): Promise<void> {
  await apiFetch(`/companies/${companyId}`, {
    method: 'DELETE',
  });
  // Se chegou aqui, foi sucesso (204 No Content)
}

/**
 * Busca dados do CNPJ na Receita Federal
 * 🔴 Retorna { ok: true, data } ou { ok: false, message } - nunca lança erro
 */
export async function fetchCNPJFromRevenue(cnpj: string): Promise<{ ok: boolean; data?: RevenueFederalData; message?: string }> {
  const response = await apiFetch('/companies/fetch-cnpj', {
    method: 'POST',
    body: JSON.stringify({ cnpj }),
  });
  return response.json();
}

/**
 * Upload documento da empresa (PDF)
 */
// F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): os helpers de documento de empresa abaixo
// (upload/list/pending/status) batiam em `company_documents` (substrato FANTASMA) via rotas legadas
// agora tombstonadas (501). O SSOT documental KYB é `fiscal_identity_documents` (rotas /identity/pj/kyb/*).
// Mantidos como stubs que LANÇAM (não constroem mais a request legada) — nenhuma UI viva os chama.
const LEGACY_DOCS_DISABLED =
  'PJ_LEGACY_COMPANY_DOCUMENTS_DISABLED: fluxo documental legado de empresa desativado (DECISION-0087). ' +
  'O SSOT documental KYB é fiscal_identity_documents; a UI canônica depende do provider de storage.';

export async function uploadCompanyDocument(
  _companyId: string,
  _file: File
): Promise<{ ok: boolean; message?: string; data?: { documentId: string; companyStatus: string } }> {
  throw new Error(LEGACY_DOCS_DISABLED);
}

export async function listCompanyDocuments(_companyId: string): Promise<Array<{
  documentId: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}>> {
  throw new Error(LEGACY_DOCS_DISABLED);
}

export async function listPendingDocuments(): Promise<Array<{
  documentId: string;
  companyId: string;
  globalUserId: string;
  companyName: string;
  companyCnpj: string;
  documentType: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}>> {
  throw new Error(LEGACY_DOCS_DISABLED);
}

export async function updateDocumentStatus(
  _documentId: string,
  _status: 'approved' | 'rejected',
  _rejectedReason?: string
): Promise<{ ok: boolean; message?: string; data?: { documentId: string; companyStatus: string } }> {
  throw new Error(LEGACY_DOCS_DISABLED);
}

// ── F-PJ-KYB-DOCUMENTS-WIZARD-FRONTEND ──────────────────────────────────────────────────────
// Client CANÔNICO de submit documental KYB (substitui os helpers legados acima, que LANÇAM).
// Chama a rota viva POST /companies/:companyId/kyb/documents (multipart). A AUTORIA/AUTORIDADE são
// resolvidas no backend (ensureUserActor(req.user) + canManageCompany) — o frontend NÃO envia actorId,
// kyb_status nem company_status; só o arquivo. Validação real (MIME/magic/scan) é do backend; o upload
// NÃO aprova KYB. documentType vai por querystring (a rota lê req.query.documentType primeiro).
export type KybDocumentType = 'cnpj_registration' | 'articles_of_association';

export async function submitCompanyKybDocument(
  companyId: string,
  documentType: KybDocumentType,
  file: File,
): Promise<{ documentId: string; documentType: string; documentStatus: string; mimeType: string; sizeBytes: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await apiFetch(
    `/companies/${companyId}/kyb/documents?documentType=${encodeURIComponent(documentType)}`,
    { method: 'POST', body: formData, headers: {} },
  );
  const json = await response.json().catch(() => ({} as Record<string, unknown>));
  if (!response.ok || (json as { ok?: boolean }).ok === false) {
    throw new Error((json as { message?: string }).message || 'Erro ao enviar documento de verificação.');
  }
  return (json as { data: { documentId: string; documentType: string; documentStatus: string; mimeType: string; sizeBytes: number } }).data;
}

// ── CP2 F-PJ-HUMAN-TO-COMPANY (PJ-B1): "Enviar para análise" + status material do KYB ──────
// O frontend NÃO decide nada: o backend prova autoridade (canManageCompany), exige documentos
// mínimos materialmente enviados e garante 1 request pendente por identidade fiscal. A resposta
// exibe estado MATERIAL (pending/approved/rejected) — nunca afirma aprovação no submit.

export interface CompanyKybRequest {
  kybRequestId: string;
  fiscalIdentityId: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedByActorId: string;
  reviewedByActorId: string | null;
  reviewedAt: string | null;
  decisionReason: string | null;
}

export interface CompanyKybStatus {
  fiscalIdentityId: string;
  kybStatus: string;
  requests: Array<{
    kybRequestId: string;
    status: string;
    submittedAt: string | null;
    reviewedAt: string | null;
    decisionReason: string | null;
  }>;
  documents: Array<{
    documentId: string;
    documentType: string;
    documentStatus: string;
    decisionReason: string | null;
    createdAt: string | null;
  }>;
}

/** Abre o pedido de análise KYB (founder/canManageCompany). Erros relevantes (error.code):
 *  KYB_REQUEST_REQUIRES_DOCUMENTS (422), KYB_REQUEST_ALREADY_PENDING (409),
 *  KYB_REQUEST_FORBIDDEN (403), KYB_REQUEST_NOT_SUBMITTABLE (409). */
export async function submitCompanyKybRequest(companyId: string, reason?: string): Promise<CompanyKybRequest> {
  const response = await apiFetch(`/companies/${companyId}/kyb/requests`, {
    method: 'POST',
    body: JSON.stringify(reason ? { reason } : {}),
  });
  const result = await response.json();
  return result?.data ?? result;
}

/** Status material do KYB da empresa (leitura pura, membership-scoped). */
export async function getCompanyKybStatus(companyId: string): Promise<CompanyKybStatus> {
  const response = await apiFetch(`/companies/${companyId}/kyb/status`);
  const result = await response.json();
  return result?.data ?? result;
}

// ── CP5 F-PJ-HUMAN-TO-COMPANY: publicação controlada (DECISION-0099/0100) ──────────────────
// O frontend NUNCA afirma "público" antes da publicação material: o estado vem do reader; o
// publish é bloqueado pelo backend sem KYB approved (409 KYB_NOT_APPROVED — razão exibida).

export interface CompanyPublication {
  publicationId: string;
  conceptId: string;
  status: string;
  publishedAt: string | null;
  retiredAt: string | null;
}

export async function listCompanyPublications(companyId: string): Promise<CompanyPublication[]> {
  const response = await apiFetch(`/companies/${companyId}/publications`);
  const result = await response.json();
  return result?.data ?? [];
}

export async function publishCompanyConcept(companyId: string, conceptId: string): Promise<{ alreadyPublished: boolean }> {
  const response = await apiFetch(`/companies/${companyId}/publications`, {
    method: 'POST',
    body: JSON.stringify({ conceptId, source: 'company_dashboard' }),
  });
  const result = await response.json();
  return result?.data ?? result;
}

export async function retireCompanyConcept(companyId: string, conceptId: string): Promise<{ alreadyRetired: boolean }> {
  const response = await apiFetch(`/companies/${companyId}/publications/${conceptId}/retire`, {
    method: 'POST',
    body: JSON.stringify({ source: 'company_dashboard' }),
  });
  const result = await response.json();
  return result?.data ?? result;
}

// ── F-PJ-ONBOARDING-FRONTEND-ACTIVATION-PAIR (DECISION-0098) ──────────────────────────────
// Catálogo governado de seleção + rota viva do par. O frontend NÃO inventa concept nem
// classificação: envia o que o backend expôs (precedente Profile C1). businessType/
// businessCategory/serviceCategories/hybrid/metadata NÃO são SSOT da ativação.

export interface OperationalCompanyType {
  companyTypeId: string;
  slug: string;
  name: string;
  defaultDepartmentSlugs: string[];
  defaultBranchSlugs: string[];
}

/**
 * Concept permitido para o company_type. `conceptId`/`slug` = identidade técnica/semântica (usados na
 * ativação). `displayName`/`shortLabel` = apresentação governada (concept_labels, DECISION-0107); podem ser
 * null quando não há label → a UI faz `displayName ?? slug`. Label NUNCA é identidade.
 */
export interface AllowedOperationalConcept {
  conceptId: string;
  slug: string;
  domain: string;
  displayName?: string | null;
  shortLabel?: string | null;
}

export interface OperationalActivationResponse {
  companyId: string;
  pageActorId: string;
  responsibleActorId: string;
  primaryCompanyTypeId: string;
  primaryConceptId: string;
  alreadyActive: boolean;
}

/** Catálogo global governado de company_types (seleção do par no Momento 2). */
export async function getOperationalCompanyTypes(): Promise<OperationalCompanyType[]> {
  const response = await apiFetch('/companies/operational-activation/company-types');
  const result = await response.json();
  return result?.data ?? [];
}

/** Concepts PERMITIDOS para o company_type (company_type_allowed_concepts ⋈ concepts). */
export async function getAllowedConceptsForCompanyType(
  companyTypeId: string
): Promise<AllowedOperationalConcept[]> {
  const response = await apiFetch(`/companies/operational-activation/company-types/${companyTypeId}/concepts`);
  const result = await response.json();
  return result?.data ?? [];
}

/**
 * Ativa operacionalmente a empresa (Momento 2): grava o par soberano
 * (primary_company_type_id, primary_concept_id). Autoridade contextual é resolvida no backend
 * (company_users). Não publica a empresa, não cria offering. Erros relevantes (via error.code):
 * COMPANY_TYPE_CONCEPT_NOT_ALLOWED (400), COMPANY_OPERATIONAL_ACTIVATION_FORBIDDEN (403),
 * COMPANY_ALREADY_OPERATIONAL_WITH_DIFFERENT_CLASSIFICATION (409).
 */
export async function activateCompanyOperationally(
  companyId: string,
  body: { companyTypeId: string; conceptId: string }
): Promise<OperationalActivationResponse> {
  const response = await apiFetch(`/companies/${companyId}/operational-activation`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const result = await response.json();
  return result?.data ?? result;
}

/**
 * F-PJ-ONBOARDING-WIZARD-ECONOMIC-ACTIVITY-SUGGESTION — sugestão de concept derivada da ATIVIDADE FISCAL da empresa.
 * O frontend passa SÓ companyId (NUNCA CNAE cru); o backend resolve a evidência fiscal server-side e devolve a
 * sugestão (ou null honesto com `reason`). CNAE é adapter local (classifierSystem='CNAE', countryCode='BR');
 * CONCEPT é o SSOT semântico. É APENAS sugestão — não ativa nada; o usuário confirma. Read-only.
 */
export interface EconomicActivitySuggestion {
  companyId: string;
  countryCode: string;
  classifierSystem: string;
  suggestion: {
    suggestedConceptId: string;
    suggestedConceptSlug: string;
    label: string | null;
    confidence: string;
    source: string;
    version: string;
    rationale: string;
    companyTypeId: string | null;
    companyTypeSlug: string | null;
  } | null;
  reason?: 'NO_FISCAL_IDENTITY' | 'NO_ECONOMIC_ACTIVITY_EVIDENCE' | 'AMBIGUOUS_ECONOMIC_ACTIVITY' | 'NO_APPROVED_SUGGESTION';
}

export async function getCompanyEconomicActivitySuggestion(
  companyId: string
): Promise<EconomicActivitySuggestion | null> {
  const response = await apiFetch(`/companies/${companyId}/economic-activity-suggestion`);
  const result = await response.json();
  return result?.data ?? null;
}

// DECISION-0096 / Presential UX 2 (higiene): os exports de validação presencial FASE 12 foram
// REMOVIDOS (requestCompanyValidation, getCompanyValidationHistory + tipos ValidationRequest/
// CompanyValidation). O fluxo presencial PJ está reservado/desabilitado (backend 501, UI removida).
// A verificação PJ ocorre pelo fluxo KYB/documental.

/**
 * F-COMPANY-AGENDA-REAL-WIRING: resolve o actor_id da PÁGINA da empresa (GET /companies/:companyId/
 * page-actor). O page-actor nasce atomicamente na criação da empresa — disponível ANTES da ativação
 * operacional (Momento 2). Autoridade = canManageCompany (mesma da rota).
 */
export async function getCompanyPageActorId(companyId: string): Promise<string> {
  const response = await apiFetch(`/companies/${companyId}/page-actor`);
  const result = await response.json();
  if (!result?.ok || !result?.data?.actorId) {
    throw new Error(result?.message || 'Erro ao resolver o actor da empresa');
  }
  return result.data.actorId;
}










