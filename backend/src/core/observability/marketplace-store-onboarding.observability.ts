// Observabilidade: store onboarding + validação marketplace (sem alterar SSOT).
// Logs via Pino (Fastify); requestId + tenantId + actorId em todos os eventos.

import type { FastifyBaseLogger } from 'fastify';
import pino from 'pino';

export type StoreOnboardingCategorySource = 'company_type_inherited' | 'request_body';

export type GovernanceFailureKind =
  | 'category_not_found'
  | 'category_not_marketplace_domain'
  | 'seed_category_out_of_scope'
  | 'missing_department_category';

/** Propagado: route → service → logs (correlação por request). */
export interface StoreOnboardingLogContext {
  logger: FastifyBaseLogger;
  requestId: string;
  tenantId: string;
  /** Actor da loja (body `actorId`). */
  actorId: string;
  /** PK `actors.id` do utilizador que executa o import (quando conhecido na rota). */
  importerActorId?: string;
}

const metrics = {
  onboardingCompletedCompanyTypeInherited: 0,
  onboardingCompletedRequestBody: 0,
  marketplaceValidationFailures: 0,
  governanceCategoryMissingN1Warnings: 0,
  categoryImportCounts: new Map<string, number>(),
};

let fallbackLogger: pino.Logger | null = null;

function getFallbackLogger(): FastifyBaseLogger {
  if (!fallbackLogger) {
    const silent = Boolean(process.env.JEST_WORKER_ID);
    fallbackLogger = pino({
      name: 'store-onboarding-fallback',
      level: silent ? 'silent' : 'info',
    });
  }
  return fallbackLogger as unknown as FastifyBaseLogger;
}

function bumpCategoryCounts(categoryIds: string[]) {
  for (const id of categoryIds) {
    metrics.categoryImportCounts.set(id, (metrics.categoryImportCounts.get(id) ?? 0) + 1);
  }
}

function topCategoryImports(limit: number): { categoryId: string; count: number }[] {
  return [...metrics.categoryImportCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([categoryId, count]) => ({ categoryId, count }));
}

function emit(
  ctx: StoreOnboardingLogContext | undefined,
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Record<string, unknown>
): void {
  const logger = ctx?.logger ?? getFallbackLogger();
  const requestId = ctx?.requestId ?? 'unknown';
  const tenantId = ctx?.tenantId ?? (fields.tenantId as string | undefined) ?? 'unknown';
  const actorId =
    ctx?.actorId ??
    (fields.storeActorId as string | undefined) ??
    (fields.actorId as string | undefined) ??
    'unknown';

  const importerActorId =
    ctx?.importerActorId ??
    (fields.importerActorId as string | undefined);

  const payload: Record<string, unknown> = {
    level,
    event,
    module: 'marketplace.store_onboarding',
    requestId,
    tenantId,
    actorId,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  if (importerActorId) {
    payload.importerActorId = importerActorId;
  }

  if (level === 'error') {
    logger.error(payload, event);
  } else if (level === 'warn') {
    logger.warn(payload, event);
  } else {
    logger.info(payload, event);
  }
}

export function logStoreOnboardingCompleted(
  ctx: StoreOnboardingLogContext | undefined,
  payload: {
    tenantId: string;
    companyTypeId: string | null;
    conceptIds: string[];
    storeActorId: string;
    importerActorId: string;
    categorySource: StoreOnboardingCategorySource;
    departmentCategoryId: string;
    importedCategoryIds: string[];
    selectedBranchCount: number;
    importedProductsCount: number;
    createdOffersCount: number;
  }
): void {
  emit(ctx, 'info', 'store_onboarding_completed', {
    ...payload,
    importerActorId: payload.importerActorId,
  });

  bumpCategoryCounts(payload.importedCategoryIds);
  if (payload.categorySource === 'company_type_inherited') {
    metrics.onboardingCompletedCompanyTypeInherited++;
  } else {
    metrics.onboardingCompletedRequestBody++;
  }
}

export function logStoreOnboardingFailed(
  ctx: StoreOnboardingLogContext | undefined,
  payload: {
    tenantId: string;
    companyTypeId: string | null;
    conceptIds: string[];
    reason: string;
    categorySource?: StoreOnboardingCategorySource;
    detail?: Record<string, unknown>;
  }
): void {
  emit(ctx, 'error', 'store_onboarding_failed', payload);
  metrics.marketplaceValidationFailures++;
}

export function logGovernanceCategoryValidationFailed(
  ctx: StoreOnboardingLogContext | undefined,
  payload: {
    tenantId: string;
    kind: GovernanceFailureKind;
    categoryId: string;
    categorySlug?: string | null;
    message: string;
  }
): void {
  emit(ctx, 'error', 'marketplace_category_governance_validation_failed', payload);
  metrics.marketplaceValidationFailures++;
}

export function logGovernanceCategoryMissingN1(
  ctx: StoreOnboardingLogContext | undefined,
  payload: {
    tenantId: string;
    categoryId: string;
    categorySlug?: string | null;
  }
): void {
  emit(ctx, 'warn', 'marketplace_category_missing_n1_mapping', payload);
  metrics.governanceCategoryMissingN1Warnings++;
}

export function getMarketplaceStoreOnboardingMetricsSnapshot(): {
  onboardingCompletedCompanyTypeInherited: number;
  onboardingCompletedRequestBody: number;
  marketplaceValidationFailures: number;
  governanceCategoryMissingN1Warnings: number;
  topImportedCategoriesByOnboarding: { categoryId: string; count: number }[];
} {
  return {
    onboardingCompletedCompanyTypeInherited: metrics.onboardingCompletedCompanyTypeInherited,
    onboardingCompletedRequestBody: metrics.onboardingCompletedRequestBody,
    marketplaceValidationFailures: metrics.marketplaceValidationFailures,
    governanceCategoryMissingN1Warnings: metrics.governanceCategoryMissingN1Warnings,
    topImportedCategoriesByOnboarding: topCategoryImports(25),
  };
}