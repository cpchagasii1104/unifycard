// TESTE BINÁRIO - Identificar qual import trava
// Este arquivo testa imports incrementalmente

console.log('🔵 STEP 1: server.ts started');
console.log('🔵 PID:', process.pid);

// Teste 1: Imports básicos do Node/Fastify
console.log('🔵 STEP 2: Importing Fastify...');
import Fastify, { FastifyInstance } from 'fastify';
console.log('🔵 STEP 3: Fastify imported');

import sensible from '@fastify/sensible';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import dotenv from 'dotenv';
console.log('🔵 STEP 4: Basic imports done');

dotenv.config();
console.log('🔵 STEP 5: dotenv.config() done');

// Teste 2: Plugins (comentar um por vez se travar)
console.log('🔵 STEP 6: Importing plugins...');
import tenantPlugin from './plugins/tenant.plugin';
console.log('🔵 STEP 7: tenantPlugin imported');

import authPlugin from '@core/auth/auth.plugin';
console.log('🔵 STEP 8: authPlugin imported');

import errorHandlerPlugin from './plugins/error-handler.plugin';
console.log('🔵 STEP 9: errorHandlerPlugin imported');

import rbacPlugin from './plugins/rbac.plugin';
console.log('🔵 STEP 10: rbacPlugin imported');

// Teste 3: Módulos públicos
console.log('🔵 STEP 11: Importing public modules...');
import authModule from './core/auth/auth.module';
console.log('🔵 STEP 12: authModule imported');

import healthModule from './core/health/health.module';
console.log('🔵 STEP 13: healthModule imported');

// Teste 4: Módulos protegidos - Core
console.log('🔵 STEP 14: Importing core modules...');
import economyModule from './core/economy/economy.module';
console.log('🔵 STEP 15: economyModule imported');

import rbacModule from './core/rbac/rbac.module';
console.log('🔵 STEP 16: rbacModule imported');

import configModule from './core/config/config.module';
console.log('🔵 STEP 17: configModule imported');

import notifyModule from './core/notify/notify.module';
console.log('🔵 STEP 18: notifyModule imported');

import reviewModule from './core/reviews/review.module';
console.log('🔵 STEP 19: reviewModule imported');

import reputationModule from './core/reputation/reputation.module';
console.log('🔵 STEP 20: reputationModule imported');

import coreModule from './core/core.module';
console.log('🔵 STEP 21: coreModule imported');

import dashboardModule from './core/dashboard/dashboard.module';
console.log('🔵 STEP 22: dashboardModule imported');

import fundModule from './core/economy/fund/fund.module';
console.log('🔵 STEP 23: fundModule imported');

import categoriesModule from './core/categories/categories.module';
console.log('🔵 STEP 24: categoriesModule imported');

import profileModule from './core/profile/profile.module';
console.log('🔵 STEP 25: profileModule imported');

import companiesModule from './core/companies/companies.module';
console.log('🔵 STEP 26: companiesModule imported');

import referralModule from './core/referral/referral.module';
console.log('🔵 STEP 27: referralModule imported');

import planModule from './core/plan/plan.module';
console.log('🔵 STEP 28: planModule imported');

import assistantModule from './modules/assistant/assistant.module';
console.log('🔵 STEP 29: assistantModule imported');

import socialActionsModule from './modules/social-actions/social-actions.module';
console.log('🔵 STEP 30: socialActionsModule imported');

// Teste 5: Módulos protegidos - Business
console.log('🔵 STEP 31: Importing business modules...');
import workModule from './modules/work/work.module';
console.log('🔵 STEP 32: workModule imported');

import ridesModule from './modules/rides/rides.module';
console.log('🔵 STEP 33: ridesModule imported');

import socialModule from './modules/social/social.module';
console.log('🔵 STEP 34: socialModule imported');

import mediaModule from './modules/media/media.module';
console.log('🔵 STEP 35: mediaModule imported');

import culturalModule from './modules/cultural/cultural.module';
console.log('🔵 STEP 36: culturalModule imported');

console.log('🔵 STEP 37: ALL IMPORTS COMPLETED - Exiting');
process.exit(0);













