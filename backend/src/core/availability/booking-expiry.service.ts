// backend/src/core/availability/booking-expiry.service.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — o MOTOR que faltava para o estado `expired`
// ║ NORMA:   SSOT temporal (Agenda) · Δbank=0 — expirar pedido NÃO toca dinheiro
// ║ NÃO:     NÃO expirar `confirmed` (compromisso aceito não caduca por tempo);
// ║          NÃO criar worker sem caller — foi assim que este buraco nasceu.
// ║ EM VEZ:  chamada no caminho que JÁ roda quando alguém olha os próprios pedidos.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O ESTADO QUE EXISTIA SEM MOTOR (2026-08-04) ═══
// `UnifiedBookingStatus.EXPIRED` e a coluna `expired_at` existem, e `updateBooking` preenche
// `expired_at` SE alguém pedir a transição — mas nada, em lugar nenhum, pedia. Achado levantado
// pela instância de ARQUITETURA e confirmado por mim: zero cron, zero scheduler, zero worker.
//
// ⚠️ A primeira medição minha disse o contrário e estava errada: meu `grep -rilE "cron|scheduler"`
// casou dentro da palavra "sín·CRON·o", em comentário. Ferramenta configurada de um jeito, leitura
// feita de outro — o erro que este repositório documenta como o mais repetido dele.
//
// 🔴 POR QUE ISTO NÃO É UM WORKER. `startIdempotencyCleanupWorker` existe e tem **zero callers**:
// worker parado é exatamente a mesma doença de "estado sem motor", com outro nome. Um motor só é
// motor se alguém der partida. O caller aqui é o painel de compromissos — a tela onde os DOIS
// lados (quem pediu e quem recebeu) olham seus pedidos pendentes. Quem sofre o estado vencido é
// quem o corrige ao olhar.
//
// ═══ O QUE EXPIRA, E POR QUE ISSO NÃO É DECISÃO DE NEGÓCIO ═══
// Só `requested` cuja JANELA JÁ COMEÇOU. Não é política: é aritmética sobre o tempo. Um pedido
// para um horário que já passou não pode mais ser honrado — recusar-se a registrar isso é manter
// uma promessa que o relógio já desfez. `confirmed` NÃO expira: compromisso aceito que não
// aconteceu é assunto de no-show/cancelamento, com regra própria e dono próprio.

import { runQueriesWithTenant } from '@core/database/pool';

export interface BookingExpiryResult {
  /** Quantos pedidos venceram nesta passagem. `0` é afirmação MEDIDA, não falha. */
  expirados: number;
}

/**
 * Expira pedidos cuja janela já começou. Idempotente e limitado: roda sobre `requested` e nada
 * mais, e a segunda chamada não encontra nada porque a primeira já mudou o estado.
 *
 * Δbank=0 — mudar `requested` → `expired` não move dinheiro nem toca o Bank.
 */
export async function expirePastDueBookings(tenantId: string): Promise<BookingExpiryResult> {
  const linhas = await runQueriesWithTenant<{ booking_id: string }>(
    tenantId,
    // O UPDATE é a própria checagem: `status = 'requested'` no WHERE torna a operação atômica e
    // idempotente sem precisar ler-antes-de-escrever (que abriria janela de corrida).
    `UPDATE bookings b
        SET status = 'expired',
            expired_at = now(),
            updated_at = now()
       FROM availability av
      WHERE av.availability_id = b.availability_id
        AND b.tenant_id = $1::uuid
        AND b.status = 'requested'
        AND av.start_datetime <= now()
      RETURNING b.booking_id::text`,
    [tenantId]
  );
  return { expirados: linhas.length };
}
