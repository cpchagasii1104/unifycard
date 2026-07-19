// Imprime o digest canônico do catálogo empresarial (DECISION-0189 R16).
// Usado pelo guard audit-company-access-authority-foundation.mjs para comparar
// código soberano × materialização da migration.
import { computeCompanyCatalogDigest } from '../src/core/authorization/company-policy-registry';

console.log(computeCompanyCatalogDigest());
