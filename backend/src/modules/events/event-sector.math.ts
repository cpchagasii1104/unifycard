// backend/src/modules/events/event-sector.math.ts
// SLICE S3 (SETORES) — helper CANÔNICO da derivação meia_quota_bps → CONTAGEM de ingressos.
//
// A lei (Lei 12.933/2013 + Decreto 8.537/2015) conta ingresso como PISO/MÍNIMO GARANTIDO: a meia-entrada
// tem que cobrir NO MÍNIMO 40% (meia_quota_bps) da capacidade do setor. Um PISO/MÍNIMO nunca pode ser
// arredondado PARA BAIXO — arredondar para baixo devolveria MENOS do que a lei garante. A derivação
// correta arredonda o PISO PARA CIMA (Math.ceil), NUNCA para baixo (Math.floor).
//
// Confirmado empiricamente (capacity=7, meiaQuotaBps=4000 = 40%): floor(7*4000/10000) = 2 ingressos =
// 28,6% da capacidade — ABAIXO do piso legal de 40% (ILEGAL). ceil(7*4000/10000) = 3 ingressos = 42,9%
// — cumpre o piso (≥ 40%). A venda/decremento real do pool (PORTA-01, Fatia 2) ainda não existe; este
// helper fixa a CONVENÇÃO correta ANTES que ela fossilize errada em algum caller futuro.
//
// Bank-free: pura função matemática sobre valores DECLARADOS de catálogo (capacity/meia_quota_bps),
// Δbank=0. Nenhuma leitura/escrita de banco aqui.

/**
 * Deriva o PISO/MÍNIMO GARANTIDO de ingressos que devem ficar reservados para a meia-entrada, dado
 * a capacidade do setor e a cota de meia em bps (40%–100% = 4000–10000).
 *
 * Arredonda PARA CIMA (Math.ceil) — nunca para baixo. Um piso/mínimo legal arredondado para baixo
 * devolveria uma garantia MENOR que a lei exige; arredondar para cima é a leitura conservadora/
 * compliant (mesmo que um setor de 1 ingresso tenha que reservar esse único ingresso como meia —
 * ver caso capacity=1 no teste unitário: um setor minúsculo AINDA tem que respeitar o piso mínimo
 * da lei, mesmo que isso signifique reservar 100% dele).
 */
export function deriveMeiaTicketFloor(capacity: number, meiaQuotaBps: number): number {
  return Math.ceil((capacity * meiaQuotaBps) / 10000);
}
