/**
 * SEMEADURA DE AGENDA DE LOCAÇÃO EM DESENVOLVIMENTO — publica janelas para os itens locáveis das
 * empresas de demonstração, para que o pedido de locação possa ser exercitado ponta a ponta.
 *
 * ═══ POR QUE ESTE SCRIPT EXISTE (2026-08-04) ═══
 * Fricção de Clayton: *"quando chego na página dela eu não tenho interação com o que ela oferece"*.
 * Ao ir atrás da causa, o contrato da página dizia que nenhuma das 3 locações da Rio Verde era
 * pedível — com o motivo ERRADO (*"locação não tem caminho de pedido"*; tem, e é asset-first).
 * O motivo verdadeiro, medido: **0 linhas de `availability` com `owner_type='actor_asset'`**,
 * contra 58 de `service_offering`. Ninguém nunca publicou agenda para um bem locável.
 *
 * Publicar agenda é ato do DONO. Aqui o dono é uma empresa de demonstração que o próprio seed
 * criou, no `unificard_dev` — mesmo enquadramento da semeadura de recursos, que Clayton autorizou:
 * o mecanismo é real, o caminho é o do sistema, e o que se semeia é dado de demonstração.
 *
 * 🔴 NÃO ESCREVE SQL PRÓPRIO. Usa `unifiedAvailabilityService.createAvailability` — o writer do
 * módulo dono da SSOT temporal. Um segundo escritor de agenda seria uma segunda verdade sobre
 * "quando este bem está livre", e é exatamente esse tipo de paralelo que esta casa passou a vida
 * desfazendo.
 *
 * ⛔ NUNCA fora do `unificard_dev` — aborta lendo o nome do banco da própria conexão, não da
 * variável de ambiente (a variável diz a intenção; a conexão diz o FATO).
 *
 * ═══ COMO USAR ═══
 *   npx tsx src/scripts/semear-agenda-locacao-dev.ts              → ensaio (não escreve nada)
 *   npx tsx src/scripts/semear-agenda-locacao-dev.ts --confirmar  → publica
 *   npx tsx src/scripts/semear-agenda-locacao-dev.ts --dias 45 --confirmar
 */

import 'dotenv/config';
import { pool } from '../core/database/pool';
import { unifiedAvailabilityService } from '../core/availability/unified-availability.service';
import {
  AvailabilityOwnerType,
  UnifiedAvailabilityType,
  UnifiedAvailabilityStatus,
} from '../core/availability/unified-availability.types';

const BANCO_ESPERADO = 'unificard_dev';

interface AssetLocavel {
  asset_id: string;
  label: string;
  owner_actor_id: string;
  owner_name: string;
  tenant_id: string;
  janelas_existentes: number;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirmar = args.includes('--confirmar');
  const diasIdx = args.indexOf('--dias');
  const dias = diasIdx >= 0 ? Number(args[diasIdx + 1]) : 30;
  if (!Number.isFinite(dias) || dias < 1 || dias > 180) {
    throw new Error(`--dias inválido: ${args[diasIdx + 1]}. Use um número entre 1 e 180.`);
  }

  // O FATO, não a intenção: pergunta ao banco como ele se chama.
  const { rows: db } = await pool.query<{ current_database: string }>('SELECT current_database()');
  const banco = db[0]?.current_database;
  if (banco !== BANCO_ESPERADO) {
    throw new Error(
      `⛔ ABORTADO: conectado em '${banco}', e este script só roda em '${BANCO_ESPERADO}'. ` +
      'Semear agenda em outro banco criaria compromisso de disponibilidade que ninguém prometeu.'
    );
  }

  // Itens locáveis vivos, pela cadeia CANÔNICA (asset-first) — nunca por `rentable_resources`,
  // que é o substrato legado com 0 linhas.
  const { rows: assets } = await pool.query<AssetLocavel>(
    `SELECT a.id::text            AS asset_id,
            a.label               AS label,
            a.owner_actor_id::text AS owner_actor_id,
            ac.display_name       AS owner_name,
            a.tenant_id::text     AS tenant_id,
            (SELECT count(*)::int FROM availability av
              WHERE av.tenant_id = a.tenant_id
                AND av.owner_type = 'actor_asset'
                AND av.owner_id = a.id
                AND av.status = 'active'
                AND av.end_datetime >= now()) AS janelas_existentes
       FROM actor_assets a
       JOIN actor_asset_modes mo
         ON mo.asset_id = a.id AND mo.activation_mode = 'rental' AND mo.enabled = true
       JOIN actor_asset_rental_terms te
         ON te.asset_id = a.id AND te.is_active = true
       JOIN actors ac ON ac.id = a.owner_actor_id
      ORDER BY ac.display_name, a.label`
  );

  if (assets.length === 0) {
    console.log('Nenhum item locável ativo encontrado — nada a fazer.');
    return;
  }

  console.log(`banco ................ ${banco}`);
  console.log(`itens locáveis ....... ${assets.length}`);
  console.log(`janela ............... hoje + ${dias} dias, 08:00–18:00 (America/Sao_Paulo)\n`);

  let publicadas = 0;
  let puladas = 0;

  for (const a of assets) {
    if (a.janelas_existentes > 0) {
      console.log(`  = ${a.owner_name} · ${a.label}: já tem ${a.janelas_existentes} janela(s) futura(s) — pulado`);
      puladas++;
      continue;
    }

    // Uma janela contínua cobrindo o período. Locação é por período (o pedido manda um subperíodo
    // dentro dela), então uma janela larga é o desenho certo — não 30 janelas diárias.
    const inicio = new Date();
    inicio.setHours(8, 0, 0, 0);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + dias);
    fim.setHours(18, 0, 0, 0);

    if (!confirmar) {
      console.log(`  + ${a.owner_name} · ${a.label}: publicaria ${inicio.toISOString()} → ${fim.toISOString()}`);
      publicadas++;
      continue;
    }

    // `userId` do writer é quem REGISTRA o ato (auditoria). Sem autor real, não se inventa um:
    // pula o item e diz por quê.
    //
    // ⚠️ DOIS CAMINHOS, porque autoridade sobre actor de EMPRESA não mora em `actors.user_id` —
    // medido: o actor da Rio Verde tem `user_id = NULL` e `company_id` preenchido. Quem representa
    // vem de `company_users.can_manage_company`, exatamente o que `canRepresentActor` consulta
    // (authorization.service.ts:597). Ler o mesmo substrato que a autorização lê é o que impede
    // este script de "conseguir" o que um humano não conseguiria pela tela.
    const { rows: donos } = await pool.query<{ user_id: string }>(
      `SELECT ac.user_id::text AS user_id
         FROM actors ac
        WHERE ac.id = $1::uuid AND ac.user_id IS NOT NULL
        UNION ALL
       SELECT u.id::text AS user_id
         FROM actors ac
         JOIN company_users cu
           ON cu.company_id = ac.company_id
          AND cu.tenant_id = ac.tenant_id
          AND cu.can_manage_company = true
         JOIN users u
           ON u.global_user_id = cu.global_user_id
          AND u.tenant_id = ac.tenant_id
        WHERE ac.id = $1::uuid AND ac.company_id IS NOT NULL
        LIMIT 1`,
      [a.owner_actor_id]
    );
    const userId = donos[0]?.user_id;
    if (!userId) {
      console.log(`  ! ${a.owner_name} · ${a.label}: actor sem user_id — sem autor para o ato, pulado`);
      puladas++;
      continue;
    }

    await unifiedAvailabilityService.createAvailability(a.tenant_id, userId, {
      ownerType: AvailabilityOwnerType.ACTOR_ASSET,
      ownerId: a.asset_id,
      availabilityType: UnifiedAvailabilityType.FIXED,
      status: UnifiedAvailabilityStatus.ACTIVE,
      startDatetime: inicio,
      endDatetime: fim,
      timezone: 'America/Sao_Paulo',
      capacity: 1,
      metadata: { origem: 'semear-agenda-locacao-dev', semeadoEm: new Date().toISOString() },
    } as Parameters<typeof unifiedAvailabilityService.createAvailability>[2]);

    console.log(`  ✓ ${a.owner_name} · ${a.label}: janela publicada`);
    publicadas++;
  }

  console.log(`\n${confirmar ? 'publicadas' : 'publicaria'}: ${publicadas} · pulados: ${puladas}`);
  if (!confirmar) console.log('ENSAIO — nada foi escrito. Rode de novo com --confirmar.');
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await pool.end();
    process.exit(1);
  });
