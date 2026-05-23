/**
 * Guard SSOT: valores monetários persistidos no Bank devem ser centavos inteiros não-negativos.
 */
export function assertIntegerCents(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `SSOT violation: ${field} deve ser inteiro não-negativo em centavos. Recebido: ${value}`
    );
  }
}