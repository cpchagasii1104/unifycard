// backend/src/scripts/verify-economic-policy-admin-access-http.ts
//
// Prova de aceitação de F-ECONOMIC-POLICY-ADMIN-FRONT (autoridade real, não leitura de código):
// autentica como a conta REAL de Clayton (unificard_dev) e chama GET /economy/admin/policies
// via HTTP de verdade, contra um servidor real já em execução (BOOT.ts). Usa o MESMO payload de
// JWT que `AuthService.generateTokens` (auth.service.ts) emitiria — mesma técnica já usada por
// `validate-pipeline-e2e-economic-policy-authority.ts` (mkHuman) para não depender de senha.
//
// Uso: npx tsx src/scripts/verify-economic-policy-admin-access-http.ts <base_url>
// Ex.:  npx tsx src/scripts/verify-economic-policy-admin-access-http.ts http://localhost:3005

import 'tsconfig-paths/register';
import jwt from 'jsonwebtoken';
import { pool, runQueryWithTenant } from '../core/database/pool';

const TENANT_ID = 'a3859c3e-eca7-4e7d-9df4-324829b368ce';
const USER_ID = '9305ac13-00b2-4ef2-989f-05c04259f18a';
const ACTOR_ID = '213f4903-d0c3-4c03-aa2f-328e11aac807';

async function main(): Promise<void> {
  const baseUrl = process.argv[2];
  if (!baseUrl) throw new Error('Uso: verify-economic-policy-admin-access-http.ts <base_url>');

  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) throw new Error('JWT_SECRET ausente');

  const user = await runQueryWithTenant<{ email: string; token_version: number; global_user_id: string }>(
    TENANT_ID,
    'SELECT email, token_version, global_user_id FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [USER_ID, TENANT_ID]
  );
  if (!user) throw new Error('Clayton não encontrado no tenant esperado');

  const token = jwt.sign(
    {
      sub: USER_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
      email: user.email,
      tokenVersion: user.token_version,
      globalUserId: user.global_user_id,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );

  const actionContext = JSON.stringify({
    actorId: ACTOR_ID,
    intent: 'economic_policy_admin_access_proof',
    source: 'manual_verification',
    scope: `tenant:${TENANT_ID}`,
  });

  console.log(`\n=== GET ${baseUrl}/economy/admin/policies (Clayton, autenticado) ===`);
  const res = await fetch(`${baseUrl}/economy/admin/policies`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'x-action-context': actionContext,
    },
  });
  const body = await res.json();
  console.log('Status:', res.status);
  console.log('Body:', JSON.stringify(body, null, 2));

  // Prova complementar: escrita AUTORIZADA (passa o gate de authority) mas rejeitada na
  // VALIDAÇÃO de aplicação (changeReason ausente, Artigo XI) — sem criar policy alguma.
  // Se o gate estivesse fechado para Clayton, isto voltaria 403, não 400.
  console.log(`\n=== POST ${baseUrl}/economy/admin/policies (changeReason ausente, sem criar dado) ===`);
  const resPost = await fetch(`${baseUrl}/economy/admin/policies`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'x-action-context': actionContext,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ policyCode: 'manual-verification-should-not-exist' }),
  });
  const bodyPost = await resPost.json();
  console.log('Status:', resPost.status, '(400 esperado = passou o gate de autoridade, falhou na validação)');
  console.log('Body:', JSON.stringify(bodyPost, null, 2));
}

main()
  .catch((error) => {
    console.error('💥 Erro:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
