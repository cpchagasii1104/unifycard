/**
 * Institutional Test Harness - Main Entry Point
 * 
 * Este arquivo importa e executa todos os testes de invariantes.
 * 
 * REGRA: Se qualquer teste passar sem erro, o build DEVE falhar.
 * Todos os testes devem FALHAR (esperar erro explícito) para provar que os invariantes estão protegidos.
 */

// Importar todos os testes de invariantes
import './auth-invariants.test';
import './tenant-invariants.test';
import './rbac-invariants.test';
import './permission-invariants.test';
import './event-invariants.test';
import './log-completeness.test';

describe('Institutional Test Harness - All Invariants', () => {
  it('deve executar todos os testes de invariantes', () => {
    // Este teste apenas garante que todos os arquivos são importados
    // Os testes reais estão nos arquivos importados acima
    expect(true).toBe(true);
  });
});


