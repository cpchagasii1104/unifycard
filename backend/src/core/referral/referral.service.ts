// src/core/referral/referral.service.ts
// Serviço de código de indicação/afiliado geral para usuários

import { runQueryWithTenant } from '@core/database/pool';
import { withTransaction } from '@core/database/transaction.helper';
import crypto from 'crypto';

class ReferralService {
  /**
   * Gera ou obtém código de indicação do usuário
   */
  async getOrCreateReferralCode(tenantId: string, userId: string): Promise<string> {
    // Verificar se já existe código
    const existing = await runQueryWithTenant<{ referral_code: string | null }>(
      tenantId,
      `
        SELECT referral_code
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (existing && existing.referral_code) {
      return existing.referral_code;
    }

    // Gerar novo código (8 caracteres alfanuméricos)
    let code: string | null = null;
    let attempts = 0;
    const maxAttempts = 10;
    
    // Garantir que o código é único
    while (!code && attempts < maxAttempts) {
      const candidate = crypto.randomBytes(4).toString('hex').toUpperCase();
      
      const check = await runQueryWithTenant<{ id: string }>(
        tenantId,
        `
          SELECT id
          FROM users
          WHERE tenant_id = $1 AND referral_code = $2
          LIMIT 1
        `,
        [tenantId, candidate]
      );
      
      if (!check) {
        code = candidate;
      }
      attempts++;
    }

    if (!code) {
      throw new Error('Falha ao gerar código de indicação único');
    }

    // Atualizar usuário com o código
    await runQueryWithTenant(
      tenantId,
      `
        UPDATE users
        SET referral_code = $2
        WHERE id = $1
      `,
      [userId, code]
    );

    return code;
  }

  /**
   * Busca código de indicação do usuário
   */
  async getReferralCode(tenantId: string, userId: string): Promise<string | null> {
    const result = await runQueryWithTenant<{ referral_code: string | null }>(
      tenantId,
      `
        SELECT referral_code
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [userId]
    );

    return result ? (result.referral_code || null) : null;
  }

  /**
   * Materializa o VÍNCULO PURO de indicação A→B (DECISION-0119).
   *
   * Writer TRANSACIONAL: recebe o MESMO `client` do nascimento (register) e grava
   * em `user_referral_links` DENTRO da transação. Relação imutável referrer→referred;
   * NÃO grava percentual/janela/status/política (isso é do split-engine — engine-neutro);
   * NÃO escreve Bank; NÃO usa users.metadata nem a tabela `referrals` (arqueologia).
   *
   * FAIL-CLOSED (D2): código VÁLIDO sem vínculo materializado ⇒ lança ⇒ a transação
   * de nascimento faz ROLLBACK total. Não engole falha de gravação do vínculo.
   * Idempotente (D5): ON CONFLICT (tenant_id, referred_user_id) DO NOTHING.
   */
  async applyReferralCodeTx(
    client: { query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }> },
    tenantId: string,
    referredUserId: string,
    referralCode: string
  ): Promise<{ referrerUserId: string }> {
    // Resolver o referrer pelo código no tenant correto (tenant-safe).
    const referrerRes = await client.query(
      `SELECT id FROM users
        WHERE tenant_id = $1 AND UPPER(referral_code) = UPPER($2)
        LIMIT 1`,
      [tenantId, referralCode]
    );
    const referrerUserId: string | undefined = referrerRes.rows[0]?.id;
    if (!referrerUserId) {
      // Código deveria existir (validado pré-tx); ausência aqui (corrida) é FAIL-CLOSED.
      throw new Error('Código de indicação inválido — vínculo não materializado');
    }

    // D5: sem autoindicação (CHECK no banco também rejeita; aqui falha cedo e claro).
    if (referrerUserId === referredUserId) {
      throw new Error('Autoindicação não permitida');
    }

    // Inserir o vínculo PURO (idempotente). A janela/percentual NÃO entram aqui.
    await client.query(
      `INSERT INTO user_referral_links (tenant_id, referrer_user_id, referred_user_id, referral_code_used)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, referred_user_id) DO NOTHING`,
      [tenantId, referrerUserId, referredUserId, referralCode]
    );

    // FAIL-CLOSED: confirmar que o vínculo existe para (tenant, referred). Ausência
    // (ex.: tabela faltando / falha silenciosa) ⇒ lança ⇒ rollback do nascimento.
    const linkRes = await client.query(
      `SELECT referrer_user_id FROM user_referral_links
        WHERE tenant_id = $1 AND referred_user_id = $2
        LIMIT 1`,
      [tenantId, referredUserId]
    );
    const materialized: string | undefined = linkRes.rows[0]?.referrer_user_id;
    if (!materialized) {
      throw new Error('Falha ao materializar vínculo de indicação (user_referral_links)');
    }

    return { referrerUserId: materialized };
  }

  /**
   * Aplicação NÃO-transacional (POST /referral/apply pós-cadastro): abre a própria
   * transação tenant-safe e delega ao writer puro `applyReferralCodeTx`. Mesmo
   * contrato/idempotência/fail-closed do caminho de nascimento. O vínculo é
   * imutável (D5): reaplicação com outro código não troca o referrer existente.
   */
  async applyReferralCode(
    tenantId: string,
    referredUserId: string,
    referralCode: string
  ): Promise<{ referrerUserId: string }> {
    return withTransaction(tenantId, (client) =>
      this.applyReferralCodeTx(client, tenantId, referredUserId, referralCode)
    );
  }
}

export const referralService = new ReferralService();


