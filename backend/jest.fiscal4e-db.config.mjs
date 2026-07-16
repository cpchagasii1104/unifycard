// jest.fiscal4e-db.config.mjs — runner DEDICADO da prova DB/E2E efêmera da FISCAL-4E (PASSE 3).
// Idêntico ao jest.config.mjs, mas alinha o ts-jest ao CONTRATO DE BUILD do projeto (tsconfig.build.json
// usa `strict: false`), para que a cadeia real do sink (bank-transaction → bank-account.service) compile
// sob a MESMA leniência null/undefined do build oficial. NÃO afeta a suíte principal (que segue strict).
// A composição FISCAL-4E é strict-clean (provada pela suíte permanente sob strict); esta leniência só
// tolera um nit pré-existente de strict-null em bank-account.service.ts (válido sob o build do projeto).
import base from './jest.config.mjs';

export default {
  ...base,
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: true,
      tsconfig: { module: 'ESNext', rootDir: '.', noEmit: true, strict: false },
    }],
  },
};
