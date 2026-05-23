// Complemento READ-ONLY: provar que canActAs atravessa o ramo Delegation
// usando a delegation que acabou de ser criada pela energização.

import 'dotenv/config';
import { authorizationService } from '../src/core/authorization/authorization.service';
import { pool } from '../src/core/database/pool';
import { socialPortsRegistry } from '../src/core/social/ports-registry';

const TENANT = 'fbe13b78-4516-493d-905a-363796aea1d1';
const PAGE_ACTOR = 'ad5a60b7-7ea1-4d79-a7f4-4c86438ea73a';
const STAFF_USER_ID = 'beb7b5e4-2d22-4782-83c9-6e006da53713';
const STAFF_ACTOR = '751a4fe0-2f33-4053-bfa8-3dcad39b3b30';

async function bootstrap() {
  const {
    actorRepositoryAdapter,
    actorUtilsAdapter,
    socialRepositoryAdapter,
    socialServiceAdapter,
    eventFeedHandlersAdapter,
  } = await import('../src/modules/social/adapters');
  socialPortsRegistry.setActorRepository(actorRepositoryAdapter);
  socialPortsRegistry.setActorUtils(actorUtilsAdapter);
  socialPortsRegistry.setSocialRepository(socialRepositoryAdapter);
  socialPortsRegistry.setSocialService(socialServiceAdapter);
  socialPortsRegistry.setEventFeedHandlers(eventFeedHandlersAdapter);
}

async function main() {
  await bootstrap();
  console.log('=== TESTE canActAs ATRAVESSANDO RAMO DELEGATION ===');
  console.log(`User: ${STAFF_USER_ID} (staff convidado)`);
  console.log(`Actuando como page: ${PAGE_ACTOR} (Clinica Sorrisos)`);
  console.log('');

  // Teste 1: publish_feed (deveria allow via delegation — scope inclui publish_feed)
  console.log('[TESTE 1] canActAs(staff_user, clinica_page, publish_feed)');
  const result1 = await authorizationService.canActAs(
    TENANT,
    STAFF_USER_ID,
    PAGE_ACTOR,
    'publish_feed' as any,
  );
  console.log(`  allowed=${result1.allowed} authoritySource=${result1.authoritySource} reason=${result1.reason ?? '-'}`);

  // Teste 2: create_events (deveria allow via delegation — scope inclui create_events)
  console.log('[TESTE 2] canActAs(staff_user, clinica_page, create_events)');
  const result2 = await authorizationService.canActAs(
    TENANT,
    STAFF_USER_ID,
    PAGE_ACTOR,
    'create_events' as any,
  );
  console.log(`  allowed=${result2.allowed} authoritySource=${result2.authoritySource} reason=${result2.reason ?? '-'}`);

  // Teste 3: capability fora do scope (deveria deny — não está em ["publish_feed","create_events"])
  console.log('[TESTE 3] canActAs(staff_user, clinica_page, manage_financial) [esperado DENY]');
  try {
    const result3 = await authorizationService.canActAs(
      TENANT,
      STAFF_USER_ID,
      PAGE_ACTOR,
      'manage_financial' as any,
    );
    console.log(`  allowed=${result3.allowed} authoritySource=${result3.authoritySource} reason=${result3.reason ?? '-'}`);
  } catch (err: any) {
    console.log(`  threw: ${err.message}`);
  }

  console.log('');
  console.log('=== RESULTADO ===');
  console.log(`Ramo Delegation atravessado: ${result1.allowed && result1.authoritySource === 'delegation' ? 'SIM' : 'NAO'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FALHA:', err);
    process.exit(1);
  })
  .finally(() => pool.end());
